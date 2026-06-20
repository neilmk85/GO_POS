package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type MachineService struct {
	db *gorm.DB
}

func NewMachineService(db *gorm.DB) *MachineService {
	return &MachineService{db: db}
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

type CreateMachineRequest struct {
	MachineCode     string                `json:"machineCode"`
	Name            string                `json:"name"`
	MachineType     models.MachineType    `json:"machineType"`
	OutletID        int                   `json:"outletId"`
	Capacity        int                   `json:"capacity"`
	HourlyRate      decimal.Decimal       `json:"hourlyRate"`
	Description     *string               `json:"description"`
	PurchaseDate    *string               `json:"purchaseDate"`    // "YYYY-MM-DD"
	LastServiceDate *string               `json:"lastServiceDate"` // "YYYY-MM-DD"
	NextServiceDate *string               `json:"nextServiceDate"` // "YYYY-MM-DD"
}

type UpdateMachineRequest struct {
	Name            string                `json:"name"`
	MachineType     models.MachineType    `json:"machineType"`
	Capacity        int                   `json:"capacity"`
	HourlyRate      decimal.Decimal       `json:"hourlyRate"`
	Description     *string               `json:"description"`
	Status          models.MachineStatus  `json:"status"`
	LastServiceDate *string               `json:"lastServiceDate"`
	NextServiceDate *string               `json:"nextServiceDate"`
}

// ── Query ─────────────────────────────────────────────────────────────────────

func (s *MachineService) GetAll(outletID *int, machineType *models.MachineType, active *bool, page, size int) ([]models.ProductionMachine, int64, error) {
	q := s.db.Model(&models.ProductionMachine{})
	if outletID != nil {
		q = q.Where("outlet_id = ?", *outletID)
	}
	if machineType != nil {
		q = q.Where("machine_type = ?", *machineType)
	}
	if active != nil {
		q = q.Where("is_active = ?", *active)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var machines []models.ProductionMachine
	err := q.
		Preload("Outlet").
		Order("name ASC").
		Offset(page * size).Limit(size).
		Find(&machines).Error
	return machines, total, err
}

func (s *MachineService) GetByID(id int) (*models.ProductionMachine, error) {
	var m models.ProductionMachine
	err := s.db.Preload("Outlet").First(&m, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Machine %d not found", id)}
	}
	return &m, err
}

// ── Mutation ──────────────────────────────────────────────────────────────────

func (s *MachineService) Create(req CreateMachineRequest, createdBy string) (*models.ProductionMachine, error) {
	if req.MachineCode == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "machineCode is required"}
	}
	if req.Name == "" {
		return nil, &util.BusinessException{StatusCode: 400, Message: "name is required"}
	}
	if req.OutletID <= 0 {
		return nil, &util.BusinessException{StatusCode: 400, Message: "outletId is required"}
	}

	var count int64
	s.db.Model(&models.ProductionMachine{}).Where("machine_code = ?", req.MachineCode).Count(&count)
	if count > 0 {
		return nil, &util.BusinessException{StatusCode: 409, Message: fmt.Sprintf("Machine with code %q already exists", req.MachineCode)}
	}

	m := &models.ProductionMachine{
		MachineCode: req.MachineCode,
		Name:        req.Name,
		MachineType: req.MachineType,
		OutletID:    req.OutletID,
		Status:      models.MachineActive,
		Capacity:    req.Capacity,
		HourlyRate:  req.HourlyRate,
		Description: req.Description,
		Active:      true,
		CreatedBy:   &createdBy,
		UpdatedBy:   &createdBy,
	}
	if err := s.db.Create(m).Error; err != nil {
		return nil, err
	}
	return s.GetByID(m.ID)
}

func (s *MachineService) Update(id int, req UpdateMachineRequest, updatedBy string) (*models.ProductionMachine, error) {
	m, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		m.Name = req.Name
	}
	if req.MachineType != "" {
		m.MachineType = req.MachineType
	}
	if req.Status != "" {
		m.Status = req.Status
	}
	m.Capacity = req.Capacity
	m.HourlyRate = req.HourlyRate
	m.Description = req.Description
	m.UpdatedBy = &updatedBy
	if err := s.db.Save(m).Error; err != nil {
		return nil, err
	}
	return s.GetByID(m.ID)
}

func (s *MachineService) ToggleActive(id int, updatedBy string) (*models.ProductionMachine, error) {
	m, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	m.Active = !m.Active
	m.UpdatedBy = &updatedBy
	if err := s.db.Save(m).Error; err != nil {
		return nil, err
	}
	return m, nil
}
