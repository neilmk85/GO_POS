package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Shift struct {
	ID            int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID      int              `gorm:"column:outlet_id" json:"outletId"`
	CashierID     int              `gorm:"column:cashier_id" json:"cashierId"`
	OpenedAt      time.Time        `gorm:"column:opened_at" json:"openedAt"`
	ClosedAt      *time.Time       `gorm:"column:closed_at" json:"closedAt"`
	OpeningCash   decimal.Decimal  `gorm:"column:opening_cash;type:decimal(10,2);default:0" json:"openingCash"`
	ClosingCash   *decimal.Decimal `gorm:"column:closing_cash;type:decimal(10,2)" json:"closingCash"`
	ExpectedCash  decimal.Decimal  `gorm:"column:expected_cash;type:decimal(10,2);default:0" json:"expectedCash"`
	CashVariance  *decimal.Decimal `gorm:"column:cash_variance;type:decimal(10,2)" json:"cashVariance"`
	TotalSales    decimal.Decimal  `gorm:"column:total_sales;type:decimal(10,2);default:0" json:"totalSales"`
	TotalOrders   int              `gorm:"column:total_orders;default:0" json:"totalOrders"`
	TotalReturns  decimal.Decimal  `gorm:"column:total_returns;type:decimal(10,2);default:0" json:"totalReturns"`
	TotalDiscounts decimal.Decimal `gorm:"column:total_discounts;type:decimal(10,2);default:0" json:"totalDiscounts"`
	Status        ShiftStatus      `gorm:"column:status;default:OPEN" json:"status"`
	Notes         *string          `gorm:"column:notes" json:"notes"`
	CreatedAt     time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string          `gorm:"column:updated_by" json:"updatedBy"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet"`
	Cashier *User  `gorm:"foreignKey:CashierID;references:ID" json:"cashier"`
	Orders []Order `gorm:"foreignKey:ShiftID" json:"orders,omitempty"`
}

func (Shift) TableName() string {
	return "shifts"
}
