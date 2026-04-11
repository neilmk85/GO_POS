package models

import "github.com/shopspring/decimal"

type StockTransferItem struct {
	ID                int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	TransferID        int              `gorm:"column:transfer_id" json:"transferId"`
	ProductID         int              `gorm:"column:product_id" json:"productId"`
	VariantID         *int             `gorm:"column:variant_id" json:"variantId"`
	RequestedQuantity decimal.Decimal  `gorm:"column:requested_quantity;type:decimal(10,2)" json:"requestedQuantity"`
	ShippedQuantity   decimal.Decimal  `gorm:"column:shipped_quantity;type:decimal(10,2);default:0" json:"shippedQuantity"`
	ReceivedQuantity  decimal.Decimal  `gorm:"column:received_quantity;type:decimal(10,2);default:0" json:"receivedQuantity"`
	Notes             *string          `gorm:"column:notes" json:"notes"`

	Transfer *StockTransfer  `gorm:"foreignKey:TransferID" json:"transfer"`
	Product  *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant  *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
}

func (StockTransferItem) TableName() string {
	return "stock_transfer_items"
}
