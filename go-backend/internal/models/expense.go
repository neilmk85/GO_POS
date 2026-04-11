package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Expense struct {
	ID                int                `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID          int                `gorm:"column:outlet_id" json:"outletId"`
	ExpenseCategoryID int                `gorm:"column:expense_category_id" json:"expenseCategoryId"`
	Amount            decimal.Decimal    `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	GSTAmount         decimal.Decimal    `gorm:"column:gst_amount;type:decimal(12,2);default:0" json:"gstAmount"`
	TotalAmount       decimal.Decimal    `gorm:"column:total_amount;type:decimal(12,2);default:0" json:"totalAmount"`
	GSTRate           *decimal.Decimal   `gorm:"column:gst_rate;type:decimal(5,2)" json:"gstRate"`
	CGSTAmount        decimal.Decimal    `gorm:"column:cgst_amount;type:decimal(12,2);default:0" json:"cgstAmount"`
	SGSTAmount        decimal.Decimal    `gorm:"column:sgst_amount;type:decimal(12,2);default:0" json:"sgstAmount"`
	IGSTAmount        decimal.Decimal    `gorm:"column:igst_amount;type:decimal(12,2);default:0" json:"igstAmount"`
	SupplyType        SupplyType         `gorm:"column:supply_type;default:INTRA_STATE" json:"supplyType"`
	VendorGSTIN       *string            `gorm:"column:vendor_gstin" json:"vendorGstin"`
	ITCEligible       bool               `gorm:"column:itc_eligible;default:false" json:"itcEligible"`
	ExpenseDate       time.Time          `gorm:"column:expense_date;type:date" json:"expenseDate"`
	Vendor            *string            `gorm:"column:vendor" json:"vendor"`
	PaymentMode       ExpensePaymentMode `gorm:"column:payment_mode;default:CASH" json:"paymentMode"`
	ReferenceNumber   *string            `gorm:"column:reference_number" json:"referenceNumber"`
	Notes             *string            `gorm:"column:notes" json:"notes"`
	SubmittedBy       *string            `gorm:"column:submitted_by" json:"submittedBy"`
	Status            ExpenseStatus      `gorm:"column:status;default:PENDING" json:"status"`
	Recurring         bool               `gorm:"column:is_recurring;default:false" json:"recurring"`
	RecurrenceInterval *RecurrenceInterval `gorm:"column:recurrence_interval" json:"recurrenceInterval"`
	RecurrenceDay     *int               `gorm:"column:recurrence_day" json:"recurrenceDay"`
	NextRecurrenceDate *time.Time        `gorm:"column:next_recurrence_date;type:date" json:"nextRecurrenceDate"`
	ParentExpenseID    *int              `gorm:"column:parent_expense_id" json:"parentExpenseId"`
	CreatedAt         time.Time          `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time          `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy         *string            `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy         *string            `gorm:"column:updated_by" json:"updatedBy"`

	Outlet          *Outlet          `gorm:"foreignKey:OutletID" json:"outlet"`
	ExpenseCategory *ExpenseCategory `gorm:"foreignKey:ExpenseCategoryID" json:"expenseCategory"`
}

func (Expense) TableName() string {
	return "expenses"
}
