package models

import "time"

type IntegrationConfig struct {
	ID            int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID      int        `gorm:"uniqueIndex;column:outlet_id" json:"outletId"`
	ChannelConfig *string    `gorm:"column:channel_config;type:json" json:"channelConfig"`
	Templates     *string    `gorm:"column:templates;type:json" json:"templates"`
	CreatedAt     time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet"`
}

func (IntegrationConfig) TableName() string {
	return "integration_config"
}
