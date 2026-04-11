package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Inventory struct {
	ID                int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductID         int              `gorm:"uniqueIndex:idx_product_variant_outlet;column:product_id" json:"productId"`
	VariantID         *int             `gorm:"uniqueIndex:idx_product_variant_outlet;column:variant_id" json:"variantId"`
	OutletID          int              `gorm:"uniqueIndex:idx_product_variant_outlet;column:outlet_id" json:"outletId"`
	QuantityOnHand    decimal.Decimal  `gorm:"column:quantity_on_hand;type:decimal(10,2);default:0" json:"quantityOnHand"`
	QuantityReserved  decimal.Decimal  `gorm:"column:quantity_reserved;type:decimal(10,2);default:0" json:"quantityReserved"`
	QuantityInTransit decimal.Decimal  `gorm:"column:quantity_in_transit;type:decimal(10,2);default:0" json:"quantityInTransit"`
	ReorderLevel      int              `gorm:"column:reorder_level;default:10" json:"reorderLevel"`
	ReorderQuantity   int              `gorm:"column:reorder_quantity;default:50" json:"reorderQuantity"`
	LastStockUpdate   *time.Time       `gorm:"column:last_stock_update" json:"lastStockUpdate"`
	AverageCost       *decimal.Decimal `gorm:"column:average_cost;type:decimal(10,2)" json:"averageCost"`
	CreatedAt         time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy         *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy         *string          `gorm:"column:updated_by" json:"updatedBy"`

	Product *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
	Outlet  *Outlet         `gorm:"foreignKey:OutletID" json:"outlet"`
}

func (Inventory) TableName() string {
	return "inventory"
}
