package models

import "time"

// ProductionShiftTemplate defines the start/end times for a named production shift per outlet.
// This is separate from the POS shift table.
type ProductionShiftTemplate struct {
	ID        int           `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID  int           `gorm:"index;column:outlet_id" json:"outletId"`
	ShiftName ProdShiftName `gorm:"column:shift_name" json:"shiftName"` // A / B / C
	StartTime string        `gorm:"column:start_time" json:"startTime"` // "HH:MM" (24h)
	EndTime   string        `gorm:"column:end_time" json:"endTime"`     // "HH:MM" (24h)
	Active    bool          `gorm:"column:is_active;default:true" json:"active"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
}

func (ProductionShiftTemplate) TableName() string { return "production_shift_templates" }
