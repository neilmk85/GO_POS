package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type MaterialIssueService struct {
	db *gorm.DB
}

func NewMaterialIssueService(db *gorm.DB) *MaterialIssueService {
	return &MaterialIssueService{db: db}
}

type MaterialIssueFilters struct {
	SiteProjectID *int
	WorkOrderID   *int
	ContractorID  *int
	IssuedTo      string
}

func (s *MaterialIssueService) GetAll(f MaterialIssueFilters) ([]models.MaterialIssue, error) {
	query := s.db.Model(&models.MaterialIssue{})
	if f.SiteProjectID != nil {
		query = query.Where("site_project_id = ?", *f.SiteProjectID)
	}
	if f.WorkOrderID != nil {
		query = query.Where("work_order_id = ?", *f.WorkOrderID)
	}
	if f.ContractorID != nil {
		query = query.Where("contractor_id = ?", *f.ContractorID)
	}
	if f.IssuedTo != "" {
		query = query.Where("issued_to = ?", f.IssuedTo)
	}
	var issues []models.MaterialIssue
	err := query.Order("issue_date DESC, id DESC").Find(&issues).Error
	return issues, err
}

func (s *MaterialIssueService) GetByID(id int) (*models.MaterialIssue, error) {
	var m models.MaterialIssue
	err := s.db.First(&m, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Material issue with ID %d not found", id)}
	}
	return &m, err
}

func (s *MaterialIssueService) Create(data models.MaterialIssue) (*models.MaterialIssue, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *MaterialIssueService) Update(id int, data models.MaterialIssue) (*models.MaterialIssue, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.MaterialIssue{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *MaterialIssueService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.MaterialIssue{}, id).Error
}
