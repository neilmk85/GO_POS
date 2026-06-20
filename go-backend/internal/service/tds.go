package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TDSService struct {
	db *gorm.DB
}

func NewTDSService(db *gorm.DB) *TDSService {
	return &TDSService{db: db}
}

// ─── TDS Sections ─────────────────────────────────────────────────────────────

func (s *TDSService) GetAllSections() ([]models.TDSSection, error) {
	var sections []models.TDSSection
	err := s.db.Order("section_code").Find(&sections).Error
	return sections, err
}

func (s *TDSService) CreateSection(code, description string, rate, threshold decimal.Decimal) (*models.TDSSection, error) {
	sec := &models.TDSSection{
		SectionCode: code,
		Description: description,
		Rate:        rate,
		Threshold:   threshold,
		IsActive:    true,
	}
	err := s.db.Create(sec).Error
	return sec, err
}

func (s *TDSService) UpdateSection(id int, code, description string, rate, threshold decimal.Decimal, active bool) (*models.TDSSection, error) {
	var sec models.TDSSection
	if err := s.db.First(&sec, id).Error; err != nil {
		return nil, err
	}
	sec.SectionCode = code
	sec.Description = description
	sec.Rate = rate
	sec.Threshold = threshold
	sec.IsActive = active
	err := s.db.Save(&sec).Error
	return &sec, err
}

func (s *TDSService) DeleteSection(id int) error {
	return s.db.Delete(&models.TDSSection{}, id).Error
}

// ─── TDS Deductions ───────────────────────────────────────────────────────────

func financialYear(t time.Time) string {
	y := t.Year()
	if t.Month() < 4 {
		return fmt.Sprintf("%d-%d", y-1, y%100)
	}
	return fmt.Sprintf("%d-%d", y, (y+1)%100)
}

func (s *TDSService) RecordDeduction(
	vendorPaymentID, supplierID, outletID, billID, tdsSectionID int,
	paymentDate time.Time,
	baseAmount, tdsRate, tdsAmount decimal.Decimal,
	createdBy string,
) (*models.TDSDeduction, error) {
	d := &models.TDSDeduction{
		VendorPaymentID: vendorPaymentID,
		SupplierID:      supplierID,
		OutletID:        outletID,
		BillID:          billID,
		TDSSectionID:    tdsSectionID,
		PaymentDate:     paymentDate,
		BaseAmount:      baseAmount,
		TDSRate:         tdsRate,
		TDSAmount:       tdsAmount,
		FinancialYear:   financialYear(paymentDate),
		Status:          "DEDUCTED",
		CreatedBy:       &createdBy,
	}
	err := s.db.Create(d).Error
	return d, err
}

// ─── TDS Report ───────────────────────────────────────────────────────────────

type TDSSectionSummary struct {
	SectionCode  string          `json:"sectionCode"`
	Description  string          `json:"description"`
	Rate         decimal.Decimal `json:"rate"`
	TotalBase    decimal.Decimal `json:"totalBase"`
	TotalTDS     decimal.Decimal `json:"totalTds"`
	Deposited    decimal.Decimal `json:"deposited"`
	Pending      decimal.Decimal `json:"pending"`
	Transactions int             `json:"transactions"`
}

type TDSPartyRow struct {
	SupplierID   int             `json:"supplierId"`
	SupplierName string          `json:"supplierName"`
	PAN          string          `json:"pan"`
	SectionCode  string          `json:"sectionCode"`
	TotalBase    decimal.Decimal `json:"totalBase"`
	TotalTDS     decimal.Decimal `json:"totalTds"`
	Deposited    decimal.Decimal `json:"deposited"`
	Pending      decimal.Decimal `json:"pending"`
	Transactions int             `json:"transactions"`
}

type TDSReportResponse struct {
	BySection []TDSSectionSummary `json:"bySection"`
	ByParty   []TDSPartyRow       `json:"byParty"`
	TotalBase decimal.Decimal     `json:"totalBase"`
	TotalTDS  decimal.Decimal     `json:"totalTds"`
}

func (s *TDSService) GetReport(outletID int, from, to time.Time) (TDSReportResponse, error) {
	var res TDSReportResponse

	// Section-wise summary
	type sectionRow struct {
		SectionCode  string
		Description  string
		Rate         decimal.Decimal
		TotalBase    decimal.Decimal
		TotalTDS     decimal.Decimal
		Deposited    decimal.Decimal
		Transactions int
	}
	var sRows []sectionRow
	if err := s.db.Raw(`
		SELECT ts.section_code, ts.description, ts.rate,
		       SUM(td.base_amount) as total_base,
		       SUM(td.tds_amount) as total_tds,
		       SUM(CASE WHEN td.status = 'DEPOSITED' THEN td.tds_amount ELSE 0 END) as deposited,
		       COUNT(*) as transactions
		FROM tds_deductions td
		JOIN tds_sections ts ON td.tds_section_id = ts.id
		WHERE td.outlet_id = ? AND td.payment_date >= ? AND td.payment_date <= ?
		GROUP BY ts.id, ts.section_code, ts.description, ts.rate
		ORDER BY ts.section_code`, outletID, from, to).Scan(&sRows).Error; err != nil {
		return res, err
	}
	for _, r := range sRows {
		pending := r.TotalTDS.Sub(r.Deposited)
		res.BySection = append(res.BySection, TDSSectionSummary{
			SectionCode:  r.SectionCode,
			Description:  r.Description,
			Rate:         r.Rate,
			TotalBase:    r.TotalBase,
			TotalTDS:     r.TotalTDS,
			Deposited:    r.Deposited,
			Pending:      pending,
			Transactions: r.Transactions,
		})
		res.TotalBase = res.TotalBase.Add(r.TotalBase)
		res.TotalTDS = res.TotalTDS.Add(r.TotalTDS)
	}

	// Party-wise summary
	type partyRow struct {
		SupplierID   int
		SupplierName string
		PAN          string
		SectionCode  string
		TotalBase    decimal.Decimal
		TotalTDS     decimal.Decimal
		Deposited    decimal.Decimal
		Transactions int
	}
	var pRows []partyRow
	if err := s.db.Raw(`
		SELECT td.supplier_id, s.name as supplier_name,
		       COALESCE(s.pan, '') as pan,
		       ts.section_code,
		       SUM(td.base_amount) as total_base,
		       SUM(td.tds_amount) as total_tds,
		       SUM(CASE WHEN td.status = 'DEPOSITED' THEN td.tds_amount ELSE 0 END) as deposited,
		       COUNT(*) as transactions
		FROM tds_deductions td
		JOIN suppliers s ON td.supplier_id = s.id
		JOIN tds_sections ts ON td.tds_section_id = ts.id
		WHERE td.outlet_id = ? AND td.payment_date >= ? AND td.payment_date <= ?
		GROUP BY td.supplier_id, s.name, s.pan, ts.section_code
		ORDER BY s.name`, outletID, from, to).Scan(&pRows).Error; err != nil {
		return res, err
	}
	for _, r := range pRows {
		res.ByParty = append(res.ByParty, TDSPartyRow{
			SupplierID:   r.SupplierID,
			SupplierName: r.SupplierName,
			PAN:          r.PAN,
			SectionCode:  r.SectionCode,
			TotalBase:    r.TotalBase,
			TotalTDS:     r.TotalTDS,
			Deposited:    r.Deposited,
			Pending:      r.TotalTDS.Sub(r.Deposited),
			Transactions: r.Transactions,
		})
	}

	return res, nil
}

// GetTDSPayable returns total TDS deducted but not yet deposited (for ledger).
func (s *TDSService) GetTDSPayable(outletID int, from, to time.Time) (decimal.Decimal, error) {
	var total decimal.Decimal
	err := s.db.Raw(`
		SELECT COALESCE(SUM(tds_amount), 0)
		FROM tds_deductions
		WHERE outlet_id = ? AND payment_date >= ? AND payment_date <= ?
		  AND status = 'DEDUCTED'`, outletID, from, to).Scan(&total).Error
	return total, err
}
