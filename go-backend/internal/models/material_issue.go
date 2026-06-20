package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type MaterialIssue struct {
	ID             int             `gorm:"primaryKey;autoIncrement" json:"id"`
	SiteProjectID  int             `gorm:"column:site_project_id;index;not null" json:"siteProjectId"`
	WorkOrderID    *int            `gorm:"column:work_order_id;index" json:"workOrderId"`
	WorkPackageID  *int            `gorm:"column:work_package_id;index" json:"workPackageId"`
	// SUBCONTRACTOR | INHOUSE
	IssuedTo       string          `gorm:"column:issued_to;not null" json:"issuedTo"`
	ContractorID   *int            `gorm:"column:contractor_id" json:"contractorId"`
	ContractorName *string         `gorm:"column:contractor_name" json:"contractorName"`
	MaterialName   string          `gorm:"column:material_name;not null" json:"materialName"`
	Specification  *string         `gorm:"column:specification" json:"specification"`
	Unit           string          `gorm:"column:unit;default:Nos" json:"unit"`
	Qty            decimal.Decimal `gorm:"column:qty;type:decimal(12,3);default:0" json:"qty"`
	IssueDate      string          `gorm:"column:issue_date;type:date" json:"issueDate"`
	IssuedBy       *string         `gorm:"column:issued_by" json:"issuedBy"`
	VehicleNo      *string         `gorm:"column:vehicle_no" json:"vehicleNo"`
	Notes          *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt      time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy      *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy      *string         `gorm:"column:updated_by" json:"updatedBy"`
}

func (MaterialIssue) TableName() string { return "material_issues" }
