package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type PurchaseReturn struct {
	ID              int                  `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ReturnNumber    string               `gorm:"uniqueIndex;size:191;column:return_number" json:"returnNumber"`
	PurchaseOrderID *int                 `gorm:"column:purchase_order_id" json:"purchaseOrderId"`
	OutletID        int                  `gorm:"column:outlet_id" json:"outletId"`
	Reason          *string              `gorm:"column:reason" json:"reason"`
	CreditMethod    *CreditMethod        `gorm:"column:credit_method" json:"creditMethod"`
	Status          PurchaseReturnStatus `gorm:"column:status;default:COMPLETED" json:"status"`
	TotalAmount     decimal.Decimal      `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	Notes           *string              `gorm:"column:notes" json:"notes"`
	CreatedAt       time.Time            `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time            `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string              `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy       *string              `gorm:"column:updated_by" json:"updatedBy"`

	PurchaseOrder *PurchaseOrder       `gorm:"foreignKey:PurchaseOrderID" json:"purchaseOrder"`
	Outlet        *Outlet              `gorm:"foreignKey:OutletID" json:"outlet"`
	Items         []PurchaseReturnItem `gorm:"foreignKey:PurchaseReturnID" json:"items,omitempty"`
}

func (PurchaseReturn) TableName() string {
	return "purchase_returns"
}
