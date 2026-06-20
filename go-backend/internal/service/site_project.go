package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type SiteProjectService struct {
	db *gorm.DB
}

func NewSiteProjectService(db *gorm.DB) *SiteProjectService {
	return &SiteProjectService{db: db}
}

func (s *SiteProjectService) GetAll(search *string, status *string) ([]models.SiteProject, error) {
	query := s.db.Model(&models.SiteProject{}).Where("is_active = ?", true)

	if search != nil && *search != "" {
		p := "%" + *search + "%"
		query = query.Where("name LIKE ? OR client_name LIKE ? OR location LIKE ? OR contract_no LIKE ?", p, p, p, p)
	}
	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	var projects []models.SiteProject
	err := query.Order("created_at DESC").Find(&projects).Error
	return projects, err
}

func (s *SiteProjectService) GetByID(id int) (*models.SiteProject, error) {
	var p models.SiteProject
	err := s.db.Where("id = ? AND is_active = ?", id, true).First(&p).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Site project with ID %d not found", id)}
	}
	return &p, err
}

func (s *SiteProjectService) Create(data models.SiteProject) (*models.SiteProject, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *SiteProjectService) Update(id int, data models.SiteProject) (*models.SiteProject, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.SiteProject{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *SiteProjectService) UpdateStatus(id int, status string) (*models.SiteProject, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.SiteProject{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *SiteProjectService) Delete(id int) error {
	p, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Model(p).Update("is_active", false).Error
}
