package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Order struct {
	ID                  int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OrderNumber         string           `gorm:"uniqueIndex;column:order_number" json:"orderNumber"`
	OutletID            int              `gorm:"column:outlet_id" json:"outletId"`
	CashierID           int              `gorm:"column:cashier_id" json:"cashierId"`
	ShiftID             *int             `gorm:"column:shift_id" json:"shiftId"`
	CustomerID          *int             `gorm:"column:customer_id" json:"customerId"`
	Status              OrderStatus      `gorm:"column:status;default:PENDING" json:"status"`
	OrderType           OrderType        `gorm:"column:order_type;default:SALE" json:"orderType"`
	Subtotal            decimal.Decimal  `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	DiscountAmount      decimal.Decimal  `gorm:"column:discount_amount;type:decimal(10,2);default:0" json:"discountAmount"`
	TaxAmount           decimal.Decimal  `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	TotalAmount         decimal.Decimal  `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	PaidAmount          decimal.Decimal  `gorm:"column:paid_amount;type:decimal(10,2);default:0" json:"paidAmount"`
	ChangeAmount        decimal.Decimal  `gorm:"column:change_amount;type:decimal(10,2);default:0" json:"changeAmount"`
	LoyaltyPointsEarned decimal.Decimal  `gorm:"column:loyalty_points_earned;type:decimal(10,2);default:0" json:"loyaltyPointsEarned"`
	LoyaltyPointsUsed   decimal.Decimal  `gorm:"column:loyalty_points_used;type:decimal(10,2);default:0" json:"loyaltyPointsUsed"`
	CouponCode          *string          `gorm:"column:coupon_code" json:"couponCode"`
	DiscountReason      *string          `gorm:"column:discount_reason" json:"discountReason"`
	ApprovedByID        *int             `gorm:"column:approved_by_id" json:"approvedById"`
	Notes               *string          `gorm:"column:notes" json:"notes"`
	ReceiptSentEmail    bool             `gorm:"column:receipt_sent_email;default:false" json:"receiptSentEmail"`
	ReceiptSentSms      bool             `gorm:"column:receipt_sent_sms;default:false" json:"receiptSentSms"`
	ReceiptSentWhatsapp bool             `gorm:"column:receipt_sent_whatsapp;default:false" json:"receiptSentWhatsapp"`
	CreatedAt           time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy           *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy           *string          `gorm:"column:updated_by" json:"updatedBy"`

	Outlet              *Outlet              `gorm:"foreignKey:OutletID" json:"outlet"`
	Cashier             *User                `gorm:"foreignKey:CashierID;references:ID" json:"cashier"`
	Shift               *Shift               `gorm:"foreignKey:ShiftID" json:"shift"`
	Customer            *Customer            `gorm:"foreignKey:CustomerID" json:"customer"`
	Items               []OrderItem          `gorm:"foreignKey:OrderID" json:"items,omitempty"`
	Payments            []Payment            `gorm:"foreignKey:OrderID" json:"payments,omitempty"`
	Invoices            []Invoice            `gorm:"foreignKey:OrderID" json:"invoices,omitempty"`
	CreditNotes         []CreditNote         `gorm:"foreignKey:OriginalOrderID;references:ID" json:"creditNotes,omitempty"`
	LoyaltyTransactions []LoyaltyTransaction `gorm:"foreignKey:OrderID" json:"loyaltyTransactions,omitempty"`
}

func (Order) TableName() string {
	return "orders"
}
