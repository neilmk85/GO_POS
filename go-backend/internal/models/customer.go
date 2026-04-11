package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Customer struct {
	ID              int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name            string           `gorm:"column:name" json:"name"`
	Phone           *string          `gorm:"uniqueIndex;column:phone" json:"phone"`
	Phone2          *string          `gorm:"column:phone2" json:"phone2"`
	Email           *string          `gorm:"column:email" json:"email"`
	Address         *string          `gorm:"column:address" json:"address"`
	City            *string          `gorm:"column:city" json:"city"`
	State           *string          `gorm:"column:state" json:"state"`
	Pincode         *string          `gorm:"column:pincode" json:"pincode"`
	GSTIN           *string          `gorm:"column:gstin" json:"gstin"`
	DateOfBirth     *time.Time       `gorm:"column:date_of_birth;type:date" json:"dateOfBirth"`
	AnniversaryDate *time.Time       `gorm:"column:anniversary_date;type:date" json:"anniversaryDate"`
	Segment         CustomerSegment  `gorm:"column:segment;default:REGULAR" json:"segment"`
	LoyaltyPoints   decimal.Decimal  `gorm:"column:loyalty_points;type:decimal(10,2);default:0" json:"loyaltyPoints"`
	TotalSpent      decimal.Decimal  `gorm:"column:total_spent;type:decimal(10,2);default:0" json:"totalSpent"`
	CreditLimit     decimal.Decimal  `gorm:"column:credit_limit;type:decimal(10,2);default:0" json:"creditLimit"`
	OutstandingDue  decimal.Decimal  `gorm:"column:outstanding_due;type:decimal(10,2);default:0" json:"outstandingDue"`
	DiscountPercent float64          `gorm:"column:discount_percent;default:0" json:"discountPercent"`
	Active          bool             `gorm:"column:is_active;default:true" json:"active"`
	Blacklisted     bool             `gorm:"column:is_blacklisted;default:false" json:"blacklisted"`
	CreatedAt       time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy       *string          `gorm:"column:updated_by" json:"updatedBy"`

	Orders              []Order              `gorm:"foreignKey:CustomerID" json:"orders,omitempty"`
	Invoices            []Invoice            `gorm:"foreignKey:CustomerID" json:"invoices,omitempty"`
	Quotations          []Quotation          `gorm:"foreignKey:CustomerID" json:"quotations,omitempty"`
	CreditNotes         []CreditNote         `gorm:"foreignKey:CustomerID" json:"creditNotes,omitempty"`
	LoyaltyTransactions []LoyaltyTransaction `gorm:"foreignKey:CustomerID" json:"loyaltyTransactions,omitempty"`
	Coupons             []Coupon             `gorm:"foreignKey:CustomerID" json:"coupons,omitempty"`
	PriceListCustomers  []PriceListCustomer  `gorm:"foreignKey:CustomerID" json:"priceListCustomers,omitempty"`
	SalesOrders         []SalesOrder         `gorm:"foreignKey:CustomerID" json:"salesOrders,omitempty"`
}

func (Customer) TableName() string {
	return "customers"
}
