package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type MaterialReceiptService struct {
	db *gorm.DB
}

func NewMaterialReceiptService(db *gorm.DB) *MaterialReceiptService {
	return &MaterialReceiptService{db: db}
}

func (s *MaterialReceiptService) GetByProject(siteProjectID int) ([]models.MaterialReceipt, error) {
	var records []models.MaterialReceipt
	err := s.db.Where("site_project_id = ?", siteProjectID).
		Order("received_date DESC, id DESC").Find(&records).Error
	return records, err
}

func (s *MaterialReceiptService) GetByID(id int) (*models.MaterialReceipt, error) {
	var r models.MaterialReceipt
	err := s.db.First(&r, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Material receipt %d not found", id)}
	}
	return &r, err
}

func (s *MaterialReceiptService) Create(data models.MaterialReceipt) (*models.MaterialReceipt, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(data.ID)
}

func (s *MaterialReceiptService) Update(id int, data models.MaterialReceipt) (*models.MaterialReceipt, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.MaterialReceipt{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *MaterialReceiptService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.MaterialReceipt{}, id).Error
}

// GetStockRegister computes balance = received - issued_contractor - issued_inhouse per material
func (s *MaterialReceiptService) GetStockRegister(siteProjectID int) ([]models.MaterialStockEntry, error) {
	// Aggregate receipts
	type receiptRow struct {
		MaterialName  string
		Specification string
		Unit          string
		TotalReceived decimal.Decimal
	}
	var receipts []receiptRow
	if err := s.db.Model(&models.MaterialReceipt{}).
		Select("material_name, COALESCE(specification, '') as specification, unit, SUM(qty) as total_received").
		Where("site_project_id = ?", siteProjectID).
		Group("material_name, specification, unit").
		Scan(&receipts).Error; err != nil {
		return nil, err
	}

	// Aggregate issues
	type issueRow struct {
		MaterialName string
		Unit         string
		IssuedTo     string
		TotalQty     decimal.Decimal
	}
	var issues []issueRow
	if err := s.db.Model(&models.MaterialIssue{}).
		Select("material_name, unit, issued_to, SUM(qty) as total_qty").
		Where("site_project_id = ?", siteProjectID).
		Group("material_name, unit, issued_to").
		Scan(&issues).Error; err != nil {
		return nil, err
	}

	// Build index of issues
	type issueKey struct{ name, unit, issuedTo string }
	issueMap := make(map[issueKey]decimal.Decimal)
	for _, i := range issues {
		issueMap[issueKey{i.MaterialName, i.Unit, i.IssuedTo}] = i.TotalQty
	}

	// Merge
	entries := make([]models.MaterialStockEntry, 0, len(receipts))
	for _, r := range receipts {
		contractor := issueMap[issueKey{r.MaterialName, r.Unit, "SUBCONTRACTOR"}]
		inhouse := issueMap[issueKey{r.MaterialName, r.Unit, "INHOUSE"}]
		balance := r.TotalReceived.Sub(contractor).Sub(inhouse)
		entries = append(entries, models.MaterialStockEntry{
			MaterialName:     r.MaterialName,
			Specification:    r.Specification,
			Unit:             r.Unit,
			TotalReceived:    r.TotalReceived,
			IssuedContractor: contractor,
			IssuedInhouse:    inhouse,
			Balance:          balance,
		})
	}

	// Also include materials only in issues (no receipts yet)
	receiptSet := make(map[string]bool)
	for _, r := range receipts {
		receiptSet[r.MaterialName+"|"+r.Unit] = true
	}
	for k, qty := range issueMap {
		if receiptSet[k.name+"|"+k.unit] {
			continue
		}
		e := findOrCreate(&entries, k.name, k.unit)
		if k.issuedTo == "SUBCONTRACTOR" {
			e.IssuedContractor = e.IssuedContractor.Add(qty)
		} else {
			e.IssuedInhouse = e.IssuedInhouse.Add(qty)
		}
		e.Balance = e.TotalReceived.Sub(e.IssuedContractor).Sub(e.IssuedInhouse)
	}

	return entries, nil
}

func findOrCreate(entries *[]models.MaterialStockEntry, name, unit string) *models.MaterialStockEntry {
	for i := range *entries {
		if (*entries)[i].MaterialName == name && (*entries)[i].Unit == unit {
			return &(*entries)[i]
		}
	}
	*entries = append(*entries, models.MaterialStockEntry{MaterialName: name, Unit: unit})
	return &(*entries)[len(*entries)-1]
}
