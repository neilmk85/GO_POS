package models

import "time"

type UserPreference struct {
	ID        int       `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	UserID    int       `gorm:"column:user_id;uniqueIndex:idx_user_pref_key" json:"userId"`
	Key       string    `gorm:"column:pref_key;uniqueIndex:idx_user_pref_key;size:100" json:"key"`
	Value     string    `gorm:"column:pref_value;type:text" json:"value"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"-"`
}

func (UserPreference) TableName() string { return "user_preferences" }
