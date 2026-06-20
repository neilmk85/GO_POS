package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type OverheadConfigService struct {
	db *gorm.DB
}

func NewOverheadConfigService(db *gorm.DB) *OverheadConfigService {
	return &OverheadConfigService{db: db}
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

type CreateOverheadConfigRequest struct {
	OutletID    int             `json:"outletId"`
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	RatePerPipe decimal.Decimal `json:"ratePerPipe"`
}

type UpdateOverheadConfigRequest struct {
	Name        string          `json:"name"`
	Description *string         `json:"description"`
	RatePerPipe decimal.Decimal `json:"ratePerPipe"`
	Active      *bool           `json:"active"`
}

// ── Query ─────────────────────────────────────────────────────────────────────

func (s *OverheadConfigService) GetAll(outletID *int, active *bool, page, size int) ([]models.OverheadConfig, int64, error) {
	q := s.db.Model(&models.OverheadConfig{})
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if active != nil {
		q = q.Where("is_active = ?", *active)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var configs []models.OverheadConfig
	err := q.
		Preload("Outlet").
		Order("name ASC").
		Offset(page * size).Limit(size).
		Find(&configs).Error
	return configs, total, err
}

func (s *OverheadConfigService) GetByID(id int) (*models.OverheadConfig, error) {
	var cfg models.OverheadConfig
	err := s.db.Preload("Outlet").First(&cfg, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("OverheadConfig %d not found", id)}
	}
	return &cfg, err
}

func (s *OverheadConfigService) GetActiveByOutlet(outletID int) ([]models.OverheadConfig, error) {
	var configs []models.OverheadConfig
	err := s.db.
		Where("outlet_id = ? AND is_active = true", outletID).
		Order("name ASC").
		Find(&configs).Error
	return configs, err
}

// ── Mutation ──────────────────────────────────────────────────────────────────

func (s *OverheadConfigService) Create(req CreateOverheadConfigRequest, createdBy string) (*models.OverheadConfig, error) {
	if req.Name == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "name is required"}
	}
	if req.OutletID <= 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "outletId is required"}
	}
	if req.RatePerPipe.LessThanOrEqual(decimal.Zero) {
		return nil, &util.BusinessException{StatusCode: 400, Message: "ratePerPipe must be > 0"}
	}

	cfg := &models.OverheadConfig{
		OutletID:    req.OutletID,
		Name:        req.Name,
		Description: req.Description,
		RatePerPipe: req.RatePerPipe,
		Active:      true,
		CreatedBy:   &createdBy,
		UpdatedBy:   &createdBy,
	}
	if err := s.db.Create(cfg).Error; err != nil {
		return nil, err
	}
	return s.GetByID(cfg.ID)
}

func (s *OverheadConfigService) Update(id int, req UpdateOverheadConfigRequest, updatedBy string) (*models.OverheadConfig, error) {
	cfg, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		cfg.Name = req.Name
	}
	cfg.Description = req.Description
	if !req.RatePerPipe.IsZero() {
		cfg.RatePerPipe = req.RatePerPipe
	}
	if req.Active != nil {
		cfg.Active = *req.Active
	}
	cfg.UpdatedBy = &updatedBy
	if err := s.db.Save(cfg).Error; err != nil {
		return nil, err
	}
	return s.GetByID(cfg.ID)
}

func (s *OverheadConfigService) ToggleActive(id int, updatedBy string) (*models.OverheadConfig, error) {
	cfg, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	cfg.Active = !cfg.Active
	cfg.UpdatedBy = &updatedBy
	if err := s.db.Save(cfg).Error; err != nil {
		return nil, err
	}
	return cfg, nil
}
