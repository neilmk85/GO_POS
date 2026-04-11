package models

import "github.com/shopspring/decimal"

type SalesOrderItem struct {
	ID               int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SalesOrderID     int             `gorm:"column:sales_order_id" json:"salesOrderId"`
	ProductID        int             `gorm:"column:product_id" json:"productId"`
	VariantID        *int            `gorm:"column:variant_id" json:"variantId"`
	ProductName      string          `gorm:"column:product_name" json:"productName"`
	SKU              *string         `gorm:"column:sku" json:"sku"`
	Quantity         decimal.Decimal `gorm:"column:quantity;type:decimal(10,2)" json:"quantity"`
	DeliveredQuantity decimal.Decimal `gorm:"column:delivered_quantity;type:decimal(10,2);default:0" json:"deliveredQuantity"`
	InvoicedQuantity decimal.Decimal `gorm:"column:invoiced_quantity;type:decimal(10,2);default:0" json:"invoicedQuantity"`
	UnitPrice        decimal.Decimal `gorm:"column:unit_price;type:decimal(10,2)" json:"unitPrice"`
	DiscountPercent  decimal.Decimal `gorm:"column:discount_percent;type:decimal(5,2);default:0" json:"discountPercent"`
	DiscountAmount   decimal.Decimal `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxRate          decimal.Decimal `gorm:"column:tax_rate;type:decimal(5,2);default:0" json:"taxRate"`
	TaxAmount        decimal.Decimal `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	LineTotal        decimal.Decimal `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`
	Notes            *string         `gorm:"column:notes" json:"notes"`

	SalesOrder *SalesOrder     `gorm:"foreignKey:SalesOrderID" json:"salesOrder"`
	Product    *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant    *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
}

func (SalesOrderItem) TableName() string {
	return "sales_order_items"
}
