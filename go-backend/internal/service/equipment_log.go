package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type EquipmentLogService struct {
	db *gorm.DB
}

func NewEquipmentLogService(db *gorm.DB) *EquipmentLogService {
	return &EquipmentLogService{db: db}
}

func (s *EquipmentLogService) GetByProject(siteProjectID int, date string) ([]models.EquipmentLog, error) {
	query := s.db.Where("site_project_id = ?", siteProjectID)
	if date != "" {
		query = query.Where("date = ?", date)
	}
	var records []models.EquipmentLog
	err := query.Order("date DESC, equipment_name ASC").Find(&records).Error
	return records, err
}

func (s *EquipmentLogService) GetByID(id int) (*models.EquipmentLog, error) {
	var r models.EquipmentLog
	err := s.db.First(&r, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Equipment log %d not found", id)}
	}
	return &r, err
}

func (s *EquipmentLogService) Create(data models.EquipmentLog) (*models.EquipmentLog, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(data.ID)
}

func (s *EquipmentLogService) Update(id int, data models.EquipmentLog) (*models.EquipmentLog, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.EquipmentLog{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *EquipmentLogService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Delete(&models.EquipmentLog{}, id).Error
}
