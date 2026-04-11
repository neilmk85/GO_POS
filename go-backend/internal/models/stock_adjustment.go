package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type StockAdjustment struct {
	ID                 int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductID          int              `gorm:"column:product_id" json:"productId"`
	VariantID          *int             `gorm:"column:variant_id" json:"variantId"`
	OutletID           int              `gorm:"column:outlet_id" json:"outletId"`
	AdjustedByID       *int             `gorm:"column:adjusted_by" json:"adjustedById"`
	QuantityBefore     *decimal.Decimal `gorm:"column:quantity_before;type:decimal(10,2)" json:"quantityBefore"`
	AdjustmentQuantity decimal.Decimal  `gorm:"column:adjustment_quantity;type:decimal(10,2)" json:"adjustmentQuantity"`
	QuantityAfter      *decimal.Decimal `gorm:"column:quantity_after;type:decimal(10,2)" json:"quantityAfter"`
	Reason             AdjustmentReason `gorm:"column:reason" json:"reason"`
	Notes              *string          `gorm:"column:notes" json:"notes"`
	CreatedAt          time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy          *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy          *string          `gorm:"column:updated_by" json:"updatedBy"`

	Product   *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant   *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
	Outlet    *Outlet         `gorm:"foreignKey:OutletID" json:"outlet"`
	AdjustedBy *User          `gorm:"foreignKey:AdjustedByID;references:ID" json:"adjustedBy"`
}

func (StockAdjustment) TableName() string {
	return "stock_adjustments"
}
