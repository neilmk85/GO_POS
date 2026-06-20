package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type BulkPurchase struct {
	ID                int               `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ReferenceNumber   string            `gorm:"uniqueIndex;size:191;column:reference_number" json:"referenceNumber"`
	ProductID         int               `gorm:"column:product_id" json:"productId"`
	OutletID          int               `gorm:"column:outlet_id" json:"outletId"`
	PurchaseUOM       *string           `gorm:"column:purchase_uom" json:"purchaseUom"`
	PurchaseQty       decimal.Decimal   `gorm:"column:purchase_qty;type:decimal(10,4)" json:"purchaseQty"`
	PurchaseFactor    *decimal.Decimal  `gorm:"column:purchase_factor;type:decimal(10,4)" json:"purchaseFactor"`
	BaseQty           *decimal.Decimal  `gorm:"column:base_qty;type:decimal(10,4)" json:"baseQty"`
	BaseUOM           *string           `gorm:"column:base_uom" json:"baseUom"`
	CostPerUnit       *decimal.Decimal  `gorm:"column:cost_per_unit;type:decimal(10,2)" json:"costPerUnit"`
	TotalCost         *decimal.Decimal  `gorm:"column:total_cost;type:decimal(10,2)" json:"totalCost"`
	Supplier          *string           `gorm:"column:supplier" json:"supplier"`
	InvoiceNumber     *string           `gorm:"column:invoice_number" json:"invoiceNumber"`
	PurchaseDate      *time.Time        `gorm:"column:purchase_date;type:date" json:"purchaseDate"`
	Notes             *string           `gorm:"column:notes" json:"notes"`
	ConvertedBaseQty  decimal.Decimal   `gorm:"column:converted_base_qty;type:decimal(10,4);default:0" json:"convertedBaseQty"`
	ConversionStatus  ConversionStatus  `gorm:"column:conversion_status;default:NOT_CONVERTED" json:"conversionStatus"`
	CreatedAt         time.Time         `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time         `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy         *string           `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy         *string           `gorm:"column:updated_by" json:"updatedBy"`

	Product     *Product                   `gorm:"foreignKey:ProductID" json:"product"`
	Outlet      *Outlet                    `gorm:"foreignKey:OutletID" json:"outlet"`
	Conversions []BulkPurchaseConversion   `gorm:"foreignKey:BulkPurchaseID" json:"conversions,omitempty"`
}

func (BulkPurchase) TableName() string {
	return "bulk_purchases"
}
