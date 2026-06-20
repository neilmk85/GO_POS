package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type DailyProgressService struct {
	db *gorm.DB
}

func NewDailyProgressService(db *gorm.DB) *DailyProgressService {
	return &DailyProgressService{db: db}
}

func (s *DailyProgressService) GetByProject(siteProjectID int, date string) ([]models.DailyProgress, error) {
	query := s.db.Preload("WorkPackage").Where("site_project_id = ?", siteProjectID)
	if date != "" {
		query = query.Where("date = ?", date)
	}
	var records []models.DailyProgress
	err := query.Order("date DESC, work_package_id ASC").Find(&records).Error
	return records, err
}

func (s *DailyProgressService) GetByPackage(workPackageID int) ([]models.DailyProgress, error) {
	var records []models.DailyProgress
	err := s.db.Where("work_package_id = ?", workPackageID).
		Order("date DESC").Find(&records).Error
	return records, err
}

func (s *DailyProgressService) GetByID(id int) (*models.DailyProgress, error) {
	var r models.DailyProgress
	err := s.db.Preload("WorkPackage").First(&r, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Daily progress record %d not found", id)}
	}
	return &r, err
}

func (s *DailyProgressService) Create(data models.DailyProgress) (*models.DailyProgress, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(data.ID)
}

func (s *DailyProgressService) Update(id int, data models.DailyProgress) (*models.DailyProgress, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.DailyProgress{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *DailyProgressService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.DailyProgress{}, id).Error
}
