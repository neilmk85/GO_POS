package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ProgressClaimService struct {
	db *gorm.DB
}

func NewProgressClaimService(db *gorm.DB) *ProgressClaimService {
	return &ProgressClaimService{db: db}
}

func (s *ProgressClaimService) GetByWorkOrder(workOrderID int) ([]models.ProgressClaim, error) {
	var claims []models.ProgressClaim
	err := s.db.
		Preload("Items").
		Where("work_order_id = ?", workOrderID).
		Order("claim_date DESC, id DESC").
		Find(&claims).Error
	return claims, err
}

func (s *ProgressClaimService) GetAll(workOrderID *int, status string) ([]models.ProgressClaim, error) {
	query := s.db.Preload("Items").Preload("WorkOrder")
	if workOrderID != nil {
		query = query.Where("work_order_id = ?", *workOrderID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var claims []models.ProgressClaim
	err := query.Order("claim_date DESC, id DESC").Find(&claims).Error
	return claims, err
}

func (s *ProgressClaimService) GetByID(id int) (*models.ProgressClaim, error) {
	var c models.ProgressClaim
	err := s.db.Preload("Items").Preload("WorkOrder").First(&c, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Progress claim with ID %d not found", id)}
	}
	return &c, err
}

func (s *ProgressClaimService) Create(data models.ProgressClaim) (*models.ProgressClaim, error) {
	if err := s.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return s.GetByID(data.ID)
}

func (s *ProgressClaimService) Update(id int, data models.ProgressClaim) (*models.ProgressClaim, error) {
	existing, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	// Replace items: delete old, insert new
	if err := s.db.Where("progress_claim_id = ?", id).Delete(&models.ProgressClaimItem{}).Error; err != nil {
		return nil, err
	}
	existing.ClaimDate = data.ClaimDate
	existing.Notes = data.Notes
	existing.Items = data.Items
	for i := range existing.Items {
		existing.Items[i].ProgressClaimID = id
	}
	if err := s.db.Session(&gorm.Session{FullSaveAssociations: true}).Save(existing).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *ProgressClaimService) Verify(id int, verifiedBy string, items []models.ProgressClaimItem, status string) (*models.ProgressClaim, error) {
	existing, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	existing.Status = status
	existing.VerifiedBy = &verifiedBy
	existing.VerifiedAt = &now

	// Update verified qty per item
	for _, item := range items {
		if err := s.db.Model(&models.ProgressClaimItem{}).
			Where("id = ? AND progress_claim_id = ?", item.ID, id).
			Updates(map[string]any{
				"verified_qty": item.VerifiedQty,
				"remark":       item.Remark,
			}).Error; err != nil {
			return nil, err
		}
	}

	if err := s.db.Save(existing).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *ProgressClaimService) Delete(id int) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	return s.db.Select("Items").Delete(&models.ProgressClaim{}, id).Error
}
