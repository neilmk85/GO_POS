package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type CreditNote struct {
	ID               int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	CreditNoteNumber string           `gorm:"uniqueIndex;size:191;column:credit_note_number" json:"creditNoteNumber"`
	CustomerID       int              `gorm:"column:customer_id" json:"customerId"`
	OriginalOrderID  *int             `gorm:"column:original_order_id" json:"originalOrderId"`
	OutletID         int              `gorm:"column:outlet_id" json:"outletId"`
	TotalAmount      decimal.Decimal  `gorm:"column:total_amount;type:decimal(10,2)" json:"totalAmount"`
	UsedAmount       decimal.Decimal  `gorm:"column:used_amount;type:decimal(10,2);default:0" json:"usedAmount"`
	RemainingAmount  decimal.Decimal  `gorm:"column:remaining_amount;type:decimal(10,2)" json:"remainingAmount"`
	ExpiryDate       *time.Time       `gorm:"column:expiry_date" json:"expiryDate"`
	Status           CreditNoteStatus `gorm:"column:status;default:ACTIVE" json:"status"`
	Reason           *string          `gorm:"column:reason" json:"reason"`
	Notes            *string          `gorm:"column:notes" json:"notes"`
	CreatedAt        time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string          `gorm:"column:updated_by" json:"updatedBy"`

	Customer      *Customer `gorm:"foreignKey:CustomerID" json:"customer"`
	OriginalOrder *Order    `gorm:"foreignKey:OriginalOrderID;references:ID" json:"originalOrder"`
	Outlet        *Outlet   `gorm:"foreignKey:OutletID" json:"outlet"`
}

func (CreditNote) TableName() string {
	return "credit_notes"
}
