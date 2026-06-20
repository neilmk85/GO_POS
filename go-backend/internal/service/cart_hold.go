package service

import (
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

type CartHoldService struct{ db *gorm.DB }

func NewCartHoldService(db *gorm.DB) *CartHoldService {
	return &CartHoldService{db: db}
}

func (s *CartHoldService) GetAll(userID, outletID int) ([]models.CartHold, error) {
	var holds []models.CartHold
	err := s.db.Where("user_id = ? AND outlet_id = ?", userID, outletID).
		Order("held_at DESC").Find(&holds).Error
	return holds, err
}

func (s *CartHoldService) Create(userID, outletID int, cartData, note string) (*models.CartHold, error) {
	h := &models.CartHold{
		UserID: userID, OutletID: outletID,
		CartData: cartData, Note: note, HeldAt: time.Now(),
	}
	return h, s.db.Create(h).Error
}

func (s *CartHoldService) Delete(id, userID int) error {
	return s.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.CartHold{}).Error
}
