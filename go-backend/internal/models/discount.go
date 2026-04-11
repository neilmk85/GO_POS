package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Discount struct {
	ID               int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name             string           `gorm:"column:name" json:"name"`
	Description      *string          `gorm:"column:description" json:"description"`
	DiscountType     DiscountType     `gorm:"column:discount_type" json:"discountType"`
	ApplyOn          ApplyOn          `gorm:"column:apply_on" json:"applyOn"`
	ValueType        ValueType        `gorm:"column:value_type" json:"valueType"`
	Value            decimal.Decimal  `gorm:"column:value;type:decimal(10,2)" json:"value"`
	MaxDiscountAmount *decimal.Decimal `gorm:"column:max_discount_amount;type:decimal(10,2)" json:"maxDiscountAmount"`
	MinOrderAmount   decimal.Decimal  `gorm:"column:min_order_amount;type:decimal(10,2);default:0" json:"minOrderAmount"`
	StartDate        *time.Time       `gorm:"column:start_date" json:"startDate"`
	EndDate          *time.Time       `gorm:"column:end_date" json:"endDate"`
	ActiveDays       *string          `gorm:"column:active_days" json:"activeDays"`
	StartTime        *string          `gorm:"column:start_time" json:"startTime"`
	EndTime          *string          `gorm:"column:end_time" json:"endTime"`
	Stackable        bool             `gorm:"column:is_stackable;default:false" json:"stackable"`
	Priority         int              `gorm:"column:priority;default:0" json:"priority"`
	Active           bool             `gorm:"column:is_active;default:true" json:"active"`
	BuyQuantity      *int             `gorm:"column:buy_quantity" json:"buyQuantity"`
	GetQuantity      *int             `gorm:"column:get_quantity" json:"getQuantity"`
	GetProductID     *int             `gorm:"column:get_product_id" json:"getProductId"`
	CreatedAt        time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string          `gorm:"column:updated_by" json:"updatedBy"`

	Products   []DiscountProduct  `gorm:"foreignKey:DiscountID" json:"products,omitempty"`
	Categories []DiscountCategory `gorm:"foreignKey:DiscountID" json:"categories,omitempty"`
}

func (Discount) TableName() string {
	return "discounts"
}
