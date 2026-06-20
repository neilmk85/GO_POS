package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ContractorService struct {
	db *gorm.DB
}

func NewContractorService(db *gorm.DB) *ContractorService {
	return &ContractorService{db: db}
}

func (s *ContractorService) GetAll(search *string, active *bool) ([]models.Contractor, error) {
	query := s.db.Model(&models.Contractor{})

	if search != nil && *search != "" {
		p := "%" + *search + "%"
		query = query.Where("name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR gstin LIKE ?", p, p, p, p)
	}
	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	var contractors []models.Contractor
	err := query.Order("name ASC").Find(&contractors).Error
	return contractors, err
}

func (s *ContractorService) GetByID(id int) (*models.Contractor, error) {
	var c models.Contractor
	err := s.db.First(&c, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Contractor with ID %d not found", id)}
	}
	return &c, err
}

func (s *ContractorService) Create(data models.Contractor) (*models.Contractor, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *ContractorService) Update(id int, data models.Contractor) (*models.Contractor, error) {
	if _, err := s.GetByID(id); err != nil {
		return nil, err
	}
	if err := s.db.Model(&models.Contractor{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *ContractorService) Delete(id int) error {
	c, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return s.db.Model(c).Update("is_active", false).Error
}
