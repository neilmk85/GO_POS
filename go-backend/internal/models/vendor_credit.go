package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type VendorCreditStatus string

const (
	VendorCreditOpen    VendorCreditStatus = "OPEN"
	VendorCreditPartial VendorCreditStatus = "PARTIAL"
	VendorCreditUsed    VendorCreditStatus = "USED"
)

type VendorCredit struct {
	ID              int                `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ReferenceNumber string             `gorm:"column:reference_number;uniqueIndex;size:50" json:"referenceNumber"`
	SupplierID      int                `gorm:"column:supplier_id;index" json:"supplierId"`
	OutletID        int                `gorm:"column:outlet_id;index" json:"outletId"`
	CreditDate      time.Time          `gorm:"column:credit_date;type:date" json:"creditDate"`
	Amount          decimal.Decimal    `gorm:"column:amount;type:decimal(10,2)" json:"amount"`
	UsedAmount      decimal.Decimal    `gorm:"column:used_amount;type:decimal(10,2);default:0" json:"usedAmount"`
	RemainingAmount decimal.Decimal    `gorm:"column:remaining_amount;type:decimal(10,2)" json:"remainingAmount"`
	Reason          string             `gorm:"column:reason" json:"reason"`
	Status          VendorCreditStatus `gorm:"column:status;default:OPEN" json:"status"`
	Notes           *string            `gorm:"column:notes" json:"notes"`
	CreatedAt       time.Time          `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time          `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string            `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy       *string            `gorm:"column:updated_by" json:"updatedBy"`
	Supplier        *Supplier          `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

func (VendorCredit) TableName() string { return "vendor_credits" }
