package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// LabourCategory values
const (
	LabourCategoryEngineer   = "ENGINEER"
	LabourCategorySupervisor = "SUPERVISOR"
	LabourCategorySkilled    = "SKILLED"
	LabourCategoryUnskilled  = "UNSKILLED"
	LabourCategoryOperator   = "OPERATOR"
)

type LabourAttendance struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	WorkPackageID *int            `gorm:"column:work_package_id;index" json:"workPackageId"`
	Date          string          `gorm:"column:date;type:date;not null" json:"date"`
	// ENGINEER | SUPERVISOR | SKILLED | UNSKILLED | OPERATOR
	Category      string          `gorm:"column:category;not null" json:"category"`
	Count         int             `gorm:"column:count;default:0" json:"count"`
	WagePerHead   decimal.Decimal `gorm:"column:wage_per_head;type:decimal(10,2);default:0" json:"wagePerHead"`
	TotalWages    decimal.Decimal `gorm:"column:total_wages;type:decimal(12,2);default:0" json:"totalWages"`
	RecordedBy    *string         `gorm:"column:recorded_by" json:"recordedBy"`
	Notes         *string         `gorm:"column:notes" json:"notes"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string         `gorm:"column:updated_by" json:"updatedBy"`
}

func (LabourAttendance) TableName() string { return "labour_attendance" }
