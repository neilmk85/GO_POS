package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type WorkPackageService struct {
	db *gorm.DB
}

func NewWorkPackageService(db *gorm.DB) *WorkPackageService {
	return &WorkPackageService{db: db}
}

func (s *WorkPackageService) GetByProject(siteProjectID int, executionType *string, phase *string) ([]models.WorkPackage, error) {
	query := s.db.Where("site_project_id = ?", siteProjectID)
	if executionType != nil && *executionType != "" {
		query = query.Where("execution_type = ?", *executionType)
	}
	if phase != nil && *phase != "" {
		query = query.Where("phase = ?", *phase)
	}
	var pkgs []models.WorkPackage
	err := query.Order("phase ASC, created_at ASC").Find(&pkgs).Error
	return pkgs, err
}

func (s *WorkPackageService) GetByID(id int) (*models.WorkPackage, error) {
	var p models.WorkPackage
	err := s.db.First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Work package with ID %d not found", id)}
	}
	return &p, err
}

func (s *WorkPackageService) Create(data models.WorkPackage) (*models.WorkPackage, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *WorkPackageService) Update(id int, data models.WorkPackage) (*models.WorkPackage, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.WorkPackage{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *WorkPackageService) UpdateStatus(id int, status string) (*models.WorkPackage, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.WorkPackage{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *WorkPackageService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.WorkPackage{}, id).Error
}
