package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type VendorCreditService struct{ db *gorm.DB }

func NewVendorCreditService(db *gorm.DB) *VendorCreditService {
	return &VendorCreditService{db: db}
}

func (s *VendorCreditService) GetAll(outletID, supplierID *int, page, size int) ([]models.VendorCredit, int64, error) {
	q := s.db.Model(&models.VendorCredit{}).Preload("Supplier")
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if supplierID != nil {
		q = q.Where("supplier_id = ?", *supplierID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []models.VendorCredit
	err := q.Order("credit_date DESC, id DESC").Offset(page * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

func (s *VendorCreditService) Create(supplierID, outletID int, amount decimal.Decimal,
	reason string, date time.Time, notes *string, createdBy string) (*models.VendorCredit, error) {
	var count int64
	s.db.Model(&models.VendorCredit{}).Count(&count)
	ref := fmt.Sprintf("VC-%05d", count+1)
	vc := &models.VendorCredit{
		ReferenceNumber: ref, SupplierID: supplierID, OutletID: outletID,
		CreditDate: date, Amount: amount, UsedAmount: decimal.Zero,
		RemainingAmount: amount, Reason: reason, Status: models.VendorCreditOpen,
		Notes: notes, CreatedBy: &createdBy,
	}
	return vc, s.db.Create(vc).Error
}

func (s *VendorCreditService) Apply(id int, amount decimal.Decimal) (*models.VendorCredit, error) {
	var vc models.VendorCredit
	if err := s.db.First(&vc, id).Error; err != nil {
		return nil, err
	}
	if vc.Status == models.VendorCreditUsed {
		return nil, &util.BusinessException{StatusCode: 400, Message: "Credit already fully used"}
	}
	if amount.GreaterThan(vc.RemainingAmount) {
		return nil, &util.BusinessException{StatusCode: 400, Message: "Amount exceeds remaining credit"}
	}
	newUsed := vc.UsedAmount.Add(amount)
	newRemaining := vc.Amount.Sub(newUsed)
	status := models.VendorCreditPartial
	if newRemaining.LessThanOrEqual(decimal.Zero) {
		status = models.VendorCreditUsed
	}
	err := s.db.Model(&vc).Updates(map[string]interface{}{
		"used_amount": newUsed, "remaining_amount": newRemaining, "status": status,
	}).Error
	if err != nil {
		return nil, err
	}
	return &vc, nil
}
