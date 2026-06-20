package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type WorkPackage struct {
	ID            int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SiteProjectID int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	// EXCAVATION | CONCRETE | PSC_PCCP | HDPE | MS_SPECIALS | WUA | TESTING | OTHER
	Phase         string          `gorm:"column:phase;not null" json:"phase"`
	Description   string          `gorm:"column:description;not null" json:"description"`
	Location      *string         `gorm:"column:location" json:"location"`
	Unit          string          `gorm:"column:unit;default:LS" json:"unit"`
	PlannedQty    decimal.Decimal `gorm:"column:planned_qty;type:decimal(12,3);default:0" json:"plannedQty"`
	// INHOUSE | SUBCONTRACTED
	ExecutionType string          `gorm:"column:execution_type;not null" json:"executionType"`
	// PLANNED | IN_PROGRESS | COMPLETED | ON_HOLD
	Status        string          `gorm:"column:status;default:PLANNED" json:"status"`
	Notes         *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string         `gorm:"column:updated_by" json:"updatedBy"`
}

func (WorkPackage) TableName() string { return "work_packages" }
