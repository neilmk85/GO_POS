package service

import (
	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserPreferenceService struct{ db *gorm.DB }

func NewUserPreferenceService(db *gorm.DB) *UserPreferenceService {
	return &UserPreferenceService{db: db}
}

func (s *UserPreferenceService) GetAll(userID int) (map[string]string, error) {
	var prefs []models.UserPreference
	if err := s.db.Where("user_id = ?", userID).Find(&prefs).Error; err != nil {
		return nil, err
	}
	result := make(map[string]string, len(prefs))
	for _, p := range prefs {
		result[p.Key] = p.Value
	}
	return result, nil
}

func (s *UserPreferenceService) Set(userID int, key, value string) error {
	pref := models.UserPreference{UserID: userID, Key: key, Value: value}
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "pref_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"pref_value", "updated_at"}),
	}).Create(&pref).Error
}

func (s *UserPreferenceService) Delete(userID int, key string) error {
	return s.db.Where("user_id = ? AND pref_key = ?", userID, key).Delete(&models.UserPreference{}).Error
}
