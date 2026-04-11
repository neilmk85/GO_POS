package models

import "github.com/shopspring/decimal"

type InvoiceItem struct {
	ID              int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	InvoiceID       int              `gorm:"column:invoice_id" json:"invoiceId"`
	ProductID       *int             `gorm:"column:product_id" json:"productId"`
	ProductName     string           `gorm:"column:product_name" json:"productName"`
	ProductSKU      *string          `gorm:"column:product_sku" json:"productSku"`
	Quantity        decimal.Decimal  `gorm:"column:quantity;type:decimal(10,2)" json:"quantity"`
	UnitPrice       decimal.Decimal  `gorm:"column:unit_price;type:decimal(10,2)" json:"unitPrice"`
	DiscountPercent decimal.Decimal  `gorm:"column:discount_percent;type:decimal(5,2);default:0" json:"discountPercent"`
	TaxRate         decimal.Decimal  `gorm:"column:tax_rate;type:decimal(5,2);default:0" json:"taxRate"`
	LineTotal       decimal.Decimal  `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`

	Invoice *Invoice  `gorm:"foreignKey:InvoiceID" json:"invoice"`
	Product *Product  `gorm:"foreignKey:ProductID" json:"product"`
}

func (InvoiceItem) TableName() string {
	return "invoice_items"
}
