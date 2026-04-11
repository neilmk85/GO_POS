package models

import "time"

type ActivityLog struct {
	ID          int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Action      string     `gorm:"column:action" json:"action"`
	Module      string     `gorm:"column:module" json:"module"`
	EntityID    *int       `gorm:"column:entity_id" json:"entityId"`
	Description string     `gorm:"column:description" json:"description"`
	UserID      *int       `gorm:"column:user_id" json:"userId"`
	UserName    *string    `gorm:"column:user_name" json:"userName"`
	UserEmail   *string    `gorm:"column:user_email" json:"userEmail"`
	OutletID    *int       `gorm:"column:outlet_id" json:"outletId"`
	IPAddress   *string    `gorm:"column:ip_address" json:"ipAddress"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (ActivityLog) TableName() string {
	return "activity_logs"
}
