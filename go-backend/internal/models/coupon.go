package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Coupon struct {
	ID                int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Code              string          `gorm:"uniqueIndex;size:191;column:code" json:"code"`
	Description       *string         `gorm:"column:description" json:"description"`
	ValueType         ValueType       `gorm:"column:value_type" json:"valueType"`
	Value             decimal.Decimal `gorm:"column:value;type:decimal(10,2)" json:"value"`
	MaxDiscountAmount *decimal.Decimal `gorm:"column:max_discount_amount;type:decimal(10,2)" json:"maxDiscountAmount"`
	MinOrderAmount    decimal.Decimal `gorm:"column:min_order_amount;type:decimal(10,2);default:0" json:"minOrderAmount"`
	UsageLimit        *int            `gorm:"column:usage_limit" json:"usageLimit"`
	UsagePerCustomer  int             `gorm:"column:usage_per_customer;default:1" json:"usagePerCustomer"`
	TimesUsed         int             `gorm:"column:times_used;default:0" json:"timesUsed"`
	StartDate         *time.Time      `gorm:"column:start_date" json:"startDate"`
	ExpiryDate        *time.Time      `gorm:"column:expiry_date" json:"expiryDate"`
	Active            bool            `gorm:"column:is_active;default:true" json:"active"`
	CustomerID        *int            `gorm:"column:customer_id" json:"customerId"`
	CreatedAt         time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy         *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy         *string         `gorm:"column:updated_by" json:"updatedBy"`

	Customer *Customer `gorm:"foreignKey:CustomerID" json:"customer"`
}

func (Coupon) TableName() string {
	return "coupons"
}
