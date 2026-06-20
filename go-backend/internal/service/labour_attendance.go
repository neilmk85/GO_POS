package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type LabourAttendanceService struct {
	db *gorm.DB
}

func NewLabourAttendanceService(db *gorm.DB) *LabourAttendanceService {
	return &LabourAttendanceService{db: db}
}

func (s *LabourAttendanceService) GetByProject(siteProjectID int, date string) ([]models.LabourAttendance, error) {
	query := s.db.Where("site_project_id = ?", siteProjectID)
	if date != "" {
		query = query.Where("date = ?", date)
	}
	var records []models.LabourAttendance
	err := query.Order("date DESC, category ASC").Find(&records).Error
	return records, err
}

func (s *LabourAttendanceService) GetByID(id int) (*models.LabourAttendance, error) {
	var r models.LabourAttendance
	err := s.db.First(&r, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Labour attendance record %d not found", id)}
	}
	return &r, err
}

func (s *LabourAttendanceService) Create(data models.LabourAttendance) (*models.LabourAttendance, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(data.ID)
}

func (s *LabourAttendanceService) Update(id int, data models.LabourAttendance) (*models.LabourAttendance, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.LabourAttendance{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *LabourAttendanceService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.LabourAttendance{}, id).Error
}
