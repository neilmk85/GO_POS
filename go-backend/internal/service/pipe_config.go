package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PipeConfigService struct {
	db *gorm.DB
}

func NewPipeConfigService(db *gorm.DB) *PipeConfigService {
	return &PipeConfigService{db: db}
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

type CreatePipeConfigRequest struct {
	Name          string  `json:"name"`
	DiameterMM    int     `json:"diameterMm"`
	PressureClass string  `json:"pressureClass"`
	Description   *string `json:"description"`
	Active        *bool   `json:"active"`
}

type UpdatePipeConfigRequest struct {
	Name          string  `json:"name"`
	Description   *string `json:"description"`
	Active        *bool   `json:"active"`
}

type PipeConfigMaterialRequest struct {
	StageType         string          `json:"stageType"`
	MaterialProductID int             `json:"materialProductId"`
	QuantityPerPipe   decimal.Decimal `json:"quantityPerPipe"`
	UOM               string          `json:"uom"`
	ScrapPercent      decimal.Decimal `json:"scrapPercent"`
	Notes             *string         `json:"notes"`
}

type UpsertMaterialsRequest struct {
	Materials []PipeConfigMaterialRequest `json:"materials"`
}

// ── Query methods ─────────────────────────────────────────────────────────────

func (s *PipeConfigService) GetAll(diameterMM *int, pressureClass *string, active *bool, page, size int) ([]models.PipeConfig, int64, error) {
	q := s.db.Model(&models.PipeConfig{})
	if diameterMM != nil {
		q = q.Where("diameter_mm = ?", *diameterMM)
	}
	if pressureClass != nil {
		q = q.Where("pressure_class = ?", *pressureClass)
	}
	if active != nil {
		q = q.Where("is_active = ?", *active)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var configs []models.PipeConfig
	err := q.
		Preload("Materials").
		Preload("Materials.MaterialProduct").
		Order("diameter_mm ASC, pressure_class ASC").
		Offset(page * size).Limit(size).
		Find(&configs).Error
	return configs, total, err
}

func (s *PipeConfigService) GetByID(id int) (*models.PipeConfig, error) {
	var cfg models.PipeConfig
	err := s.db.
		Preload("Materials").
		Preload("Materials.MaterialProduct").
		First(&cfg, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("PipeConfig %d not found", id)}
	}
	return &cfg, err
}

func (s *PipeConfigService) GetByDiameterAndPressure(diamMM int, pressClass string) (*models.PipeConfig, error) {
	var cfg models.PipeConfig
	err := s.db.
		Where("diameter_mm = ? AND pressure_class = ?", diamMM, pressClass).
		Preload("Materials").
		Preload("Materials.MaterialProduct").
		First(&cfg).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{
			Message: fmt.Sprintf("PipeConfig for %dmm / %s not found", diamMM, pressClass),
		}
	}
	return &cfg, err
}

// ── Mutation methods ──────────────────────────────────────────────────────────

func (s *PipeConfigService) Create(req CreatePipeConfigRequest, createdBy string) (*models.PipeConfig, error) {
	if req.DiameterMM <= 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "diameterMm must be > 0"}
	}
	if req.PressureClass == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "pressureClass is required"}
	}

	// Check duplicate
	var count int64
	s.db.Model(&models.PipeConfig{}).
		Where("diameter_mm = ? AND pressure_class = ?", req.DiameterMM, req.PressureClass).
		Count(&count)
	if count > 0 {
		return nil, &util.BusinessException{
			StatusCode: 409,
			Message:    fmt.Sprintf("PipeConfig for %dmm / %s already exists", req.DiameterMM, req.PressureClass),
		}
	}

	name := req.Name
	if name == "" {
		name = fmt.Sprintf("PCCP %dmm %s", req.DiameterMM, req.PressureClass)
	}

	active := true
	if req.Active != nil {
		active = *req.Active
	}

	cfg := &models.PipeConfig{
		Name:          name,
		DiameterMM:    req.DiameterMM,
		PressureClass: req.PressureClass,
		Description:   req.Description,
		Active:        active,
		CreatedBy:     &createdBy,
		UpdatedBy:     &createdBy,
	}
	if err := s.db.Create(cfg).Error; err != nil {
		return nil, err
	}
	return cfg, nil
}

func (s *PipeConfigService) Update(id int, req UpdatePipeConfigRequest, updatedBy string) (*models.PipeConfig, error) {
	cfg, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		cfg.Name = req.Name
	}
	cfg.Description = req.Description
	if req.Active != nil {
		cfg.Active = *req.Active
	}
	cfg.UpdatedBy = &updatedBy
	if err := s.db.Save(cfg).Error; err != nil {
		return nil, err
	}
	return cfg, nil
}

func (s *PipeConfigService) ToggleActive(id int, updatedBy string) (*models.PipeConfig, error) {
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

// UpsertMaterials replaces all PipeConfigMaterial rows for a given config and stage set.
// It deletes all existing materials for this config and inserts the new list.
func (s *PipeConfigService) UpsertMaterials(pipeConfigID int, req UpsertMaterialsRequest, updatedBy string) error {
	_, err := s.GetByID(pipeConfigID)
	if err != nil {
		return err
	}

	// Validate stage types
	for _, m := range req.Materials {
		stage := models.ProdStageType(m.StageType)
		if !models.MaterialStages[stage] {
			return &util.BusinessException{
				StatusCode: 400,
				Message:    fmt.Sprintf("stage %q does not consume materials (only FABRICATION, SPINNING, WINDING, COATING)", m.StageType),
			}
		}
		if m.QuantityPerPipe.LessThanOrEqual(decimal.Zero) {
			return &util.BusinessException{StatusCode: 400, Message: "quantityPerPipe must be > 0"}
		}
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// Delete existing
		if err := tx.Where("pipe_config_id = ?", pipeConfigID).
			Delete(&models.PipeConfigMaterial{}).Error; err != nil {
			return err
		}
		// Insert new
		for _, m := range req.Materials {
			mat := models.PipeConfigMaterial{
				PipeConfigID:      pipeConfigID,
				StageType:         models.ProdStageType(m.StageType),
				MaterialProductID: m.MaterialProductID,
				QuantityPerPipe:   m.QuantityPerPipe,
				UOM:               m.UOM,
				ScrapPercent:      m.ScrapPercent,
				Notes:             m.Notes,
			}
			if mat.UOM == "" {
				mat.UOM = "kg"
			}
			if err := tx.Create(&mat).Error; err != nil {
				return err
			}
		}
		// Update config's UpdatedBy/UpdatedAt
		return tx.Model(&models.PipeConfig{}).Where("id = ?", pipeConfigID).
			Updates(map[string]interface{}{"updated_by": updatedBy}).Error
	})
}
