package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type CreditNoteService struct {
	db *gorm.DB
}

func NewCreditNoteService(db *gorm.DB) *CreditNoteService {
	return &CreditNoteService{db: db}
}

type CreditNoteCreateRequest struct {
	CustomerID      int             `json:"customerId"`
	OriginalOrderID *int            `json:"originalOrderId,omitempty"`
	OutletID        int             `json:"outletId"`
	TotalAmount     decimal.Decimal `json:"totalAmount"`
	Reason          *string         `json:"reason,omitempty"`
	ExpiryDays      *int            `json:"expiryDays,omitempty"`
}

func (cs *CreditNoteService) Create(req CreditNoteCreateRequest) (*models.CreditNote, error) {
	creditNoteNum, err := util.GenerateCreditNoteNumber(cs.db)
	if err != nil {
		return nil, err
	}

	creditNote := &models.CreditNote{
		CreditNoteNumber: creditNoteNum,
		CustomerID:       req.CustomerID,
		OriginalOrderID:  req.OriginalOrderID,
		OutletID:         req.OutletID,
		TotalAmount:      req.TotalAmount,
		RemainingAmount:  req.TotalAmount,
		UsedAmount:       decimal.Zero,
		Reason:           req.Reason,
		Status:           models.CreditNoteStatusActive,
	}

	// Set expiry date if provided
	if req.ExpiryDays != nil && *req.ExpiryDays > 0 {
		expiryDate := time.Now().AddDate(0, 0, *req.ExpiryDays)
		creditNote.ExpiryDate = &expiryDate
	}

	if err := cs.db.Create(creditNote).Error; err != nil {
		return nil, err
	}

	// Reload with relations
	if err := cs.db.Preload("Customer").Preload("Outlet").First(creditNote, creditNote.ID).Error; err != nil {
		return nil, err
	}

	return creditNote, nil
}

func (cs *CreditNoteService) GetAll(outletId int, status *string, page, size int) ([]models.CreditNote, int64, error) {
	query := cs.db.Where("outlet_id = ?", outletId)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	var creditNotes []models.CreditNote
	var total int64

	if err := query.Model(&models.CreditNote{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Customer").
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&creditNotes).Error

	return creditNotes, total, err
}

func (cs *CreditNoteService) GetByCustomer(customerId int) ([]models.CreditNote, error) {
	var creditNotes []models.CreditNote
	err := cs.db.Where("customer_id = ?", customerId).
		Preload("Customer").Preload("OriginalOrder").
		Order("created_at DESC").
		Find(&creditNotes).Error

	return creditNotes, err
}

func (cs *CreditNoteService) GetActiveByCustomer(customerId int) ([]models.CreditNote, error) {
	var creditNotes []models.CreditNote
	err := cs.db.Where("customer_id = ? AND status = ? AND remaining_amount > ?", customerId, models.CreditNoteStatusActive, decimal.Zero).
		Preload("Customer").Preload("OriginalOrder").
		Order("created_at DESC").
		Find(&creditNotes).Error

	return creditNotes, err
}

func (cs *CreditNoteService) Cancel(id int, reason string) (*models.CreditNote, error) {
	creditNote := &models.CreditNote{}
	if err := cs.db.First(creditNote, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("CreditNote with ID %d not found", id)}
		}
		return nil, err
	}

	if creditNote.Status != models.CreditNoteStatusActive {
		return nil, &util.BusinessException{Message: "Only active credit notes can be cancelled"}
	}

	updates := map[string]interface{}{
		"status": models.CreditNoteStatusCancelled,
		"notes":  reason,
	}

	if err := cs.db.Model(creditNote).Updates(updates).Error; err != nil {
		return nil, err
	}

	return cs.GetByID(id)
}

func (cs *CreditNoteService) GetByID(id int) (*models.CreditNote, error) {
	creditNote := &models.CreditNote{}
	err := cs.db.Preload("Customer").Preload("OriginalOrder").
		First(creditNote, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("CreditNote with ID %d not found", id)}
	}

	return creditNote, err
}

func (cs *CreditNoteService) Apply(creditNoteId int, amount decimal.Decimal) (*models.CreditNote, error) {
	creditNote := &models.CreditNote{}
	if err := cs.db.First(creditNote, creditNoteId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("CreditNote with ID %d not found", creditNoteId)}
		}
		return nil, err
	}

	if creditNote.Status != models.CreditNoteStatusActive {
		return nil, &util.BusinessException{Message: "Credit note is not active"}
	}

	if amount.GreaterThan(creditNote.RemainingAmount) {
		return nil, &util.BusinessException{Message: "Insufficient credit note balance"}
	}

	newRemaining := creditNote.RemainingAmount.Sub(amount)
	newUsed := creditNote.UsedAmount.Add(amount)
	newStatus := models.CreditNoteStatusActive
	if newRemaining.LessThanOrEqual(decimal.Zero) {
		newStatus = models.CreditNoteStatusFullyUsed
	}

	updates := map[string]interface{}{
		"used_amount":      newUsed,
		"remaining_amount": newRemaining,
		"status":           newStatus,
	}

	if err := cs.db.Model(creditNote).Updates(updates).Error; err != nil {
		return nil, err
	}

	return cs.GetByID(creditNoteId)
}
