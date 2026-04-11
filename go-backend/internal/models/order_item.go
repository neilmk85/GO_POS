package models

import "github.com/shopspring/decimal"

type OrderItem struct {
	ID               int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OrderID          int              `gorm:"column:order_id" json:"orderId"`
	ProductID        int              `gorm:"column:product_id" json:"productId"`
	VariantID        *int             `gorm:"column:variant_id" json:"variantId"`
	ProductName      string           `gorm:"column:product_name" json:"productName"`
	VariantName      *string          `gorm:"column:variant_name" json:"variantName"`
	SKU              *string          `gorm:"column:sku" json:"sku"`
	Quantity         decimal.Decimal  `gorm:"column:quantity;type:decimal(10,2)" json:"quantity"`
	UnitPrice        decimal.Decimal  `gorm:"column:unit_price;type:decimal(10,2)" json:"unitPrice"`
	CostPrice        *decimal.Decimal `gorm:"column:cost_price;type:decimal(10,2)" json:"costPrice"`
	DiscountPercent  decimal.Decimal  `gorm:"column:discount_percent;type:decimal(5,2);default:0" json:"discountPercent"`
	DiscountAmount   decimal.Decimal  `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxAmount        decimal.Decimal  `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	TaxRate          decimal.Decimal  `gorm:"column:tax_rate;type:decimal(5,2);default:0" json:"taxRate"`
	LineTotal        decimal.Decimal  `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`
	Notes            *string          `gorm:"column:notes" json:"notes"`
	ReturnedQuantity decimal.Decimal  `gorm:"column:returned_quantity;type:decimal(10,2);default:0" json:"returnedQuantity"`

	Order   *Order          `gorm:"foreignKey:OrderID" json:"order"`
	Product *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
}

func (OrderItem) TableName() string {
	return "order_items"
}
