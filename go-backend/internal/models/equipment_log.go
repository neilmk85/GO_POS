package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type EquipmentLog struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	WorkPackageID *int            `gorm:"column:work_package_id;index" json:"workPackageId"`
	Date          string          `gorm:"column:date;type:date;not null" json:"date"`
	EquipmentName string          `gorm:"column:equipment_name;not null" json:"equipmentName"`
	EquipmentType *string         `gorm:"column:equipment_type" json:"equipmentType"`
	HoursWorked   decimal.Decimal `gorm:"column:hours_worked;type:decimal(6,2);default:0" json:"hoursWorked"`
	IdleHours     decimal.Decimal `gorm:"column:idle_hours;type:decimal(6,2);default:0" json:"idleHours"`
	FuelConsumed  decimal.Decimal `gorm:"column:fuel_consumed;type:decimal(8,2);default:0" json:"fuelConsumed"`
	OperatorName  *string         `gorm:"column:operator_name" json:"operatorName"`
	Remarks       *string         `gorm:"column:remarks" json:"remarks"`
	RecordedBy    *string         `gorm:"column:recorded_by" json:"recordedBy"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string         `gorm:"column:updated_by" json:"updatedBy"`
}

func (EquipmentLog) TableName() string { return "equipment_logs" }
