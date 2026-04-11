package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ShiftService struct {
	db *gorm.DB
}

func NewShiftService(db *gorm.DB) *ShiftService {
	return &ShiftService{db: db}
}

type ShiftOpenRequest struct {
	OutletID     int             `json:"outletId"`
	CashierID    int             `json:"cashierId"`
	OpeningCash  decimal.Decimal `json:"openingCash"`
}

type ShiftCloseRequest struct {
	ClosingCash decimal.Decimal `json:"closingCash"`
	Notes       *string         `json:"notes,omitempty"`
}

func (ss *ShiftService) Open(req ShiftOpenRequest) (*models.Shift, error) {
	// Check if an open shift already exists
	existingShift := &models.Shift{}
	result := ss.db.Where("outlet_id = ? AND cashier_id = ? AND status = ?",
		req.OutletID, req.CashierID, models.ShiftStatusOpen).First(existingShift)

	if result.Error == nil {
		return nil, &util.BusinessException{Message: "A shift is already open for this cashier"}
	} else if result.Error != gorm.ErrRecordNotFound {
		return nil, result.Error
	}

	now := time.Now()
	shift := &models.Shift{
		OutletID:    req.OutletID,
		CashierID:   req.CashierID,
		OpenedAt:    now,
		OpeningCash: req.OpeningCash,
		Status:      models.ShiftStatusOpen,
		TotalSales:  decimal.Zero,
		TotalOrders: 0,
		TotalDiscounts: decimal.Zero,
		ExpectedCash:   req.OpeningCash,
	}

	if err := ss.db.Create(shift).Error; err != nil {
		return nil, err
	}

	// Reload with relations
	if err := ss.db.Preload("Outlet").Preload("Cashier").First(shift, shift.ID).Error; err != nil {
		return nil, err
	}

	return shift, nil
}

func (ss *ShiftService) Close(shiftId int, req ShiftCloseRequest) (*models.Shift, error) {
	shift := &models.Shift{}
	if err := ss.db.Preload("Orders").First(shift, shiftId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Shift with ID %d not found", shiftId)}
		}
		return nil, err
	}

	if shift.Status != models.ShiftStatusOpen {
		return nil, &util.BusinessException{Message: "Shift is not open"}
	}

	now := time.Now()
	variance := req.ClosingCash.Sub(shift.ExpectedCash)

	updates := map[string]interface{}{
		"closed_at":      &now,
		"closing_cash":   req.ClosingCash,
		"cash_variance":  variance,
		"status":         models.ShiftStatusClosed,
		"notes":          req.Notes,
	}

	if err := ss.db.Model(shift).Updates(updates).Error; err != nil {
		return nil, err
	}

	return ss.GetByID(shiftId)
}

func (ss *ShiftService) GetCurrent(cashierId int) (*models.Shift, error) {
	shift := &models.Shift{}
	result := ss.db.Where("cashier_id = ? AND status = ?", cashierId, models.ShiftStatusOpen).
		Preload("Outlet").Preload("Cashier").First(shift)

	if result.Error == gorm.ErrRecordNotFound {
		return nil, nil // No open shift
	}

	return shift, result.Error
}

func (ss *ShiftService) GetByOutlet(outletId int, page, size int, from, to *time.Time) ([]models.Shift, int64, error) {
	query := ss.db.Where("outlet_id = ?", outletId)

	if from != nil && to != nil {
		query = query.Where("opened_at >= ? AND opened_at <= ?", from, to)
	}

	var shifts []models.Shift
	var total int64

	if err := query.Model(&models.Shift{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Cashier").
		Order("opened_at DESC").
		Offset(offset).Limit(size).
		Find(&shifts).Error

	return shifts, total, err
}

func (ss *ShiftService) GetByID(id int) (*models.Shift, error) {
	shift := &models.Shift{}
	err := ss.db.Preload("Outlet").Preload("Cashier").
		First(shift, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Shift with ID %d not found", id)}
	}

	return shift, err
}

func (ss *ShiftService) UpdateTotals(shiftId int, saleAmount, discountAmount decimal.Decimal) error {
	shift := &models.Shift{}
	if err := ss.db.First(shift, shiftId).Error; err != nil {
		return err
	}

	updates := map[string]interface{}{
		"total_sales":     gorm.Expr("total_sales + ?", saleAmount),
		"total_discounts": gorm.Expr("total_discounts + ?", discountAmount),
		"total_orders":    gorm.Expr("total_orders + 1"),
		"expected_cash":   gorm.Expr("expected_cash + ?", saleAmount),
	}

	return ss.db.Model(shift).Updates(updates).Error
}
