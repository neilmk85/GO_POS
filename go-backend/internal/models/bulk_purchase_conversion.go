package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type BulkPurchaseConversion struct {
	ID             int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	BulkPurchaseID int             `gorm:"column:bulk_purchase_id" json:"bulkPurchaseId"`
	TargetProductID int            `gorm:"column:target_product_id" json:"targetProductId"`
	OutletID       int             `gorm:"column:outlet_id" json:"outletId"`
	FromBaseQty    decimal.Decimal `gorm:"column:from_base_qty;type:decimal(10,4)" json:"fromBaseQty"`
	SaleQty        decimal.Decimal `gorm:"column:sale_qty;type:decimal(10,4)" json:"saleQty"`
	SaleUOM        *string         `gorm:"column:sale_uom" json:"saleUom"`
	Notes          *string         `gorm:"column:notes" json:"notes"`
	ConvertedAt    time.Time       `gorm:"column:converted_at;autoCreateTime" json:"convertedAt"`

	BulkPurchase  *BulkPurchase `gorm:"foreignKey:BulkPurchaseID" json:"bulkPurchase"`
	TargetProduct *Product      `gorm:"foreignKey:TargetProductID;references:ID" json:"targetProduct"`
}

func (BulkPurchaseConversion) TableName() string {
	return "bulk_purchase_conversions"
}
