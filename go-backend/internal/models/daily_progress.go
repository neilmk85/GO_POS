package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type DailyProgress struct {
	ID               int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID    int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	WorkPackageID    int             `gorm:"column:work_package_id;index;not null" json:"workPackageId"`
	Date             string          `gorm:"column:date;type:date;not null" json:"date"`
	QtyCompleted     decimal.Decimal `gorm:"column:qty_completed;type:decimal(12,3);default:0" json:"qtyCompleted"`
	Unit             string          `gorm:"column:unit;default:LS" json:"unit"`
	WeatherCondition *string         `gorm:"column:weather_condition" json:"weatherCondition"`
	Remarks          *string         `gorm:"column:remarks;type:text" json:"remarks"`
	RecordedBy       *string         `gorm:"column:recorded_by" json:"recordedBy"`
	CreatedAt        time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string         `gorm:"column:updated_by" json:"updatedBy"`

	WorkPackage *WorkPackage `gorm:"foreignKey:WorkPackageID" json:"workPackage,omitempty"`
}

func (DailyProgress) TableName() string { return "daily_progress" }
