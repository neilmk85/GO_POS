package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type ProductVariant struct {
	ID                int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductID         int              `gorm:"column:product_id" json:"productId"`
	Name              string           `gorm:"column:name" json:"name"`
	SKU               *string          `gorm:"uniqueIndex;column:sku" json:"sku"`
	Barcode           *string          `gorm:"column:barcode" json:"barcode"`
	Attribute1Name    *string          `gorm:"column:attribute1_name" json:"attribute1Name"`
	Attribute1Value   *string          `gorm:"column:attribute1_value" json:"attribute1Value"`
	Attribute2Name    *string          `gorm:"column:attribute2_name" json:"attribute2Name"`
	Attribute2Value   *string          `gorm:"column:attribute2_value" json:"attribute2Value"`
	PriceAdjustment   decimal.Decimal  `gorm:"column:price_adjustment;type:decimal(10,2);default:0" json:"priceAdjustment"`
	CostPrice         *decimal.Decimal `gorm:"column:cost_price;type:decimal(10,2)" json:"costPrice"`
	ImageURL          *string          `gorm:"column:image_url" json:"imageUrl"`
	Active            bool             `gorm:"column:is_active;default:true" json:"active"`
	CreatedAt         time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy         *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy         *string          `gorm:"column:updated_by" json:"updatedBy"`

	Product            *Product           `gorm:"foreignKey:ProductID" json:"product"`
	OrderItems         []OrderItem        `gorm:"foreignKey:VariantID" json:"orderItems,omitempty"`
	Inventories        []Inventory        `gorm:"foreignKey:VariantID" json:"inventories,omitempty"`
	PurchaseOrderItems []PurchaseOrderItem `gorm:"foreignKey:VariantID" json:"purchaseOrderItems,omitempty"`
	StockAdjustments   []StockAdjustment  `gorm:"foreignKey:VariantID" json:"stockAdjustments,omitempty"`
	StockTransferItems []StockTransferItem `gorm:"foreignKey:VariantID" json:"stockTransferItems,omitempty"`
	PriceListItems     []PriceListItem    `gorm:"foreignKey:VariantID" json:"priceListItems,omitempty"`
	SalesOrderItems    []SalesOrderItem   `gorm:"foreignKey:VariantID" json:"salesOrderItems,omitempty"`
}

func (ProductVariant) TableName() string {
	return "product_variants"
}
