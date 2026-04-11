package models

import "github.com/shopspring/decimal"

type PurchaseReturnItem struct {
	ID                   int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PurchaseReturnID     int             `gorm:"column:purchase_return_id" json:"purchaseReturnId"`
	ProductID            int             `gorm:"column:product_id" json:"productId"`
	PurchaseOrderItemID  *int            `gorm:"column:purchase_order_item_id" json:"purchaseOrderItemId"`
	ProductName          *string         `gorm:"column:product_name" json:"productName"`
	ReturnedQuantity     decimal.Decimal `gorm:"column:returned_quantity;type:decimal(10,2)" json:"returnedQuantity"`
	UnitCost             decimal.Decimal `gorm:"column:unit_cost;type:decimal(10,2)" json:"unitCost"`
	LineTotal            decimal.Decimal `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`

	PurchaseReturn *PurchaseReturn `gorm:"foreignKey:PurchaseReturnID" json:"purchaseReturn"`
	Product        *Product        `gorm:"foreignKey:ProductID" json:"product"`
}

func (PurchaseReturnItem) TableName() string {
	return "purchase_return_items"
}
