package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ShiftTemplateService struct {
	db *gorm.DB
}

func NewShiftTemplateService(db *gorm.DB) *ShiftTemplateService {
	return &ShiftTemplateService{db: db}
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

type UpsertShiftTemplateRequest struct {
	OutletID  int                   `json:"outletId"`
	ShiftName models.ProdShiftName  `json:"shiftName"`
	StartTime string                `json:"startTime"` // "HH:MM"
	EndTime   string                `json:"endTime"`   // "HH:MM"
	Active    *bool                 `json:"active"`
}

// ── Query ─────────────────────────────────────────────────────────────────────

func (s *ShiftTemplateService) GetByOutlet(outletID int) ([]models.ProductionShiftTemplate, error) {
	var shifts []models.ProductionShiftTemplate
	err := s.db.
		Where("outlet_id = ?", outletID).
		Order("FIELD(shift_name, 'A', 'B', 'C')").
		Find(&shifts).Error
	return shifts, err
}

func (s *ShiftTemplateService) GetAll(page, size int) ([]models.ProductionShiftTemplate, int64, error) {
	var total int64
	if err := s.db.Model(&models.ProductionShiftTemplate{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var shifts []models.ProductionShiftTemplate
	err := s.db.
		Preload("Outlet").
		Order("outlet_id ASC, FIELD(shift_name, 'A', 'B', 'C')").
		Offset(page * size).Limit(size).
		Find(&shifts).Error
	return shifts, total, err
}

func (s *ShiftTemplateService) GetByID(id int) (*models.ProductionShiftTemplate, error) {
	var sh models.ProductionShiftTemplate
	err := s.db.Preload("Outlet").First(&sh, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("ShiftTemplate %d not found", id)}
	}
	return &sh, err
}

// ── Mutation ──────────────────────────────────────────────────────────────────

// Upsert creates or updates the shift template for (outletID, shiftName).
func (s *ShiftTemplateService) Upsert(req UpsertShiftTemplateRequest) (*models.ProductionShiftTemplate, error) {
	if req.OutletID <= 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "outletId is required"}
	}
	if req.ShiftName == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "shiftName is required (A, B, or C)"}
	}
	if req.StartTime == "" || req.EndTime == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "startTime and endTime are required (HH:MM)"}
	}

	active := true
	if req.Active != nil {
		active = *req.Active
	}

	var sh models.ProductionShiftTemplate
	result := s.db.Where("outlet_id = ? AND shift_name = ?", req.OutletID, req.ShiftName).First(&sh)
	if result.Error == gorm.ErrRecordNotFound {
		sh = models.ProductionShiftTemplate{
			OutletID:  req.OutletID,
			ShiftName: req.ShiftName,
			StartTime: req.StartTime,
			EndTime:   req.EndTime,
			Active:    active,
		}
		if err := s.db.Create(&sh).Error; err != nil {
			return nil, err
		}
	} else {
		sh.StartTime = req.StartTime
		sh.EndTime = req.EndTime
		sh.Active = active
		if err := s.db.Save(&sh).Error; err != nil {
			return nil, err
		}
	}
	return &sh, nil
}

func (s *ShiftTemplateService) Delete(id int) error {
	sh, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Delete(sh).Error
}
