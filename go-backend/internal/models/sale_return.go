package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type SaleReturn struct {
	ID           int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ReturnNumber string           `gorm:"uniqueIndex;size:191;column:return_number" json:"returnNumber"`
	OutletID     int              `gorm:"column:outlet_id" json:"outletId"`
	CustomerID   *int             `gorm:"column:customer_id" json:"customerId"`
	CustomerName *string          `gorm:"column:customer_name;size:255" json:"customerName"`
	RefNo        *string          `gorm:"column:ref_no;size:255" json:"refNo"`
	ReturnDate   *time.Time       `gorm:"column:return_date" json:"returnDate"`
	TotalAmount  decimal.Decimal  `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	ReturnMethod *string          `gorm:"column:return_method;size:50" json:"returnMethod"`
	Reason       *string          `gorm:"column:reason" json:"reason"`
	CreatedBy    *string          `gorm:"column:created_by;size:191" json:"createdBy"`
	CreatedAt    time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Customer *Customer        `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Items    []SaleReturnItem `gorm:"foreignKey:SaleReturnID" json:"items,omitempty"`
}

func (SaleReturn) TableName() string { return "sale_returns" }

type SaleReturnItem struct {
	ID           int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SaleReturnID int             `gorm:"column:sale_return_id" json:"saleReturnId"`
	ProductName  string          `gorm:"column:product_name;size:255" json:"productName"`
	Quantity     decimal.Decimal `gorm:"column:quantity;type:decimal(10,2)" json:"quantity"`
	UnitPrice    decimal.Decimal `gorm:"column:unit_price;type:decimal(10,2)" json:"unitPrice"`
	LineTotal    decimal.Decimal `gorm:"column:line_total;type:decimal(10,2)" json:"lineTotal"`
}

func (SaleReturnItem) TableName() string { return "sale_return_items" }
