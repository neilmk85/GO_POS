package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Quotation struct {
	ID               int               `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	QuotationNumber  string            `gorm:"uniqueIndex;size:191;column:quotation_number" json:"quotationNumber"`
	CustomerID       *int              `gorm:"column:customer_id" json:"customerId"`
	OutletID         int               `gorm:"column:outlet_id" json:"outletId"`
	ValidUntil       *time.Time        `gorm:"column:valid_until;type:date" json:"validUntil"`
	Status           QuotationStatus   `gorm:"column:status;default:DRAFT" json:"status"`
	Subtotal         decimal.Decimal   `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	DiscountAmount   decimal.Decimal   `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxAmount        decimal.Decimal   `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	TotalAmount      decimal.Decimal   `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	Notes            *string           `gorm:"column:notes" json:"notes"`
	TermsConditions  *string           `gorm:"column:terms_conditions;type:text" json:"termsConditions"`
	CreatedAt        time.Time         `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string           `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string           `gorm:"column:updated_by" json:"updatedBy"`

	Customer *Customer         `gorm:"foreignKey:CustomerID" json:"customer"`
	Outlet   *Outlet           `gorm:"foreignKey:OutletID" json:"outlet"`
	Items    []QuotationItem   `gorm:"foreignKey:QuotationID" json:"items,omitempty"`
}

func (Quotation) TableName() string {
	return "quotations"
}
