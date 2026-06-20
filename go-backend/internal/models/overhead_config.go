package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// OverheadConfig defines a fixed overhead cost applied per finished pipe for a production order.
// Used when computing the cost sheet.
type OverheadConfig struct {
	ID          int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID    int             `gorm:"column:outlet_id" json:"outletId"`
	Name        string          `gorm:"column:name" json:"name"`
	Description *string         `gorm:"column:description" json:"description"`
	RatePerPipe decimal.Decimal `gorm:"column:rate_per_pipe;type:decimal(10,2)" json:"ratePerPipe"`
	Active      bool            `gorm:"column:is_active;default:true" json:"active"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
}

func (OverheadConfig) TableName() string { return "overhead_configs" }
