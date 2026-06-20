package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// ProductionMachine represents a physical machine used in the PCCP production process.
type ProductionMachine struct {
	ID              int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	MachineCode     string          `gorm:"uniqueIndex;size:191;column:machine_code" json:"machineCode"`
	Name            string          `gorm:"column:name" json:"name"`
	MachineType     MachineType     `gorm:"column:machine_type" json:"machineType"`
	OutletID        int             `gorm:"column:outlet_id" json:"outletId"`
	Status          MachineStatus   `gorm:"column:status;default:ACTIVE" json:"status"`
	Capacity        int             `gorm:"column:capacity;default:0" json:"capacity"` // pipes per shift
	HourlyRate      decimal.Decimal `gorm:"column:hourly_rate;type:decimal(10,2);default:0" json:"hourlyRate"`
	Description     *string         `gorm:"column:description" json:"description"`
	PurchaseDate    *time.Time      `gorm:"column:purchase_date" json:"purchaseDate"`
	LastServiceDate *time.Time      `gorm:"column:last_service_date" json:"lastServiceDate"`
	NextServiceDate *time.Time      `gorm:"column:next_service_date" json:"nextServiceDate"`
	Active          bool            `gorm:"column:is_active;default:true" json:"active"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
}

func (ProductionMachine) TableName() string { return "production_machines" }
