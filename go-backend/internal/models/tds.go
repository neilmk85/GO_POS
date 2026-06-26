package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// TDSSection stores TDS sections like 194C, 194J etc. with applicable rates.
type TDSSection struct {
	ID          int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	SectionCode string          `gorm:"column:section_code;size:20;uniqueIndex" json:"sectionCode"`
	Description string          `gorm:"column:description;size:255" json:"description"`
	Rate        decimal.Decimal `gorm:"column:rate;type:decimal(5,2)" json:"rate"`
	Threshold   decimal.Decimal `gorm:"column:threshold;type:decimal(12,2);default:0" json:"threshold"`
	IsActive    bool            `gorm:"column:is_active;default:true" json:"isActive"`
	CreatedAt   time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (TDSSection) TableName() string { return "tds_sections" }

// TDSDeduction records TDS deducted on each vendor payment.
type TDSDeduction struct {
	ID              int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	VendorPaymentID int             `gorm:"column:vendor_payment_id;index" json:"vendorPaymentId"`
	SupplierID      int             `gorm:"column:supplier_id;index" json:"supplierId"`
	OutletID        int             `gorm:"column:outlet_id;index" json:"outletId"`
	TDSSectionID    int             `gorm:"column:tds_section_id" json:"tdsSectionId"`
	BillID          int             `gorm:"column:bill_id" json:"billId"`
	PaymentDate     time.Time       `gorm:"column:payment_date;type:date" json:"paymentDate"`
	BaseAmount      decimal.Decimal `gorm:"column:base_amount;type:decimal(12,2)" json:"baseAmount"`
	TDSRate         decimal.Decimal `gorm:"column:tds_rate;type:decimal(5,2)" json:"tdsRate"`
	TDSAmount       decimal.Decimal `gorm:"column:tds_amount;type:decimal(12,2)" json:"tdsAmount"`
	FinancialYear   string          `gorm:"column:financial_year;size:10" json:"financialYear"`
	Status          string          `gorm:"column:status;size:20;default:DEDUCTED" json:"status"` // DEDUCTED, DEPOSITED
	DepositDate     *time.Time      `gorm:"column:deposit_date;type:date" json:"depositDate,omitempty"`
	ChallanNumber   *string         `gorm:"column:challan_number;size:50" json:"challanNumber,omitempty"`
	CreatedAt       time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy       *string         `gorm:"column:created_by" json:"createdBy"`

	Supplier      *Supplier      `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	TDSSection    *TDSSection    `gorm:"foreignKey:TDSSectionID" json:"tdsSection,omitempty"`
	VendorPayment *VendorPayment `gorm:"foreignKey:VendorPaymentID" json:"vendorPayment,omitempty"`
}

func (TDSDeduction) TableName() string { return "tds_deductions" }

// TDSReceivable records TDS deducted BY customers on our sales invoices.
// Status: PENDING → RECEIVED (when credit appears in Form 26AS).
type TDSReceivable struct {
	ID            int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID      int             `gorm:"column:outlet_id;index" json:"outletId"`
	CustomerID    *int            `gorm:"column:customer_id;index" json:"customerId"`
	CustomerName  string          `gorm:"column:customer_name;size:255" json:"customerName"`
	InvoiceNumber string          `gorm:"column:invoice_number;size:100" json:"invoiceNumber"`
	TDSSectionID  int             `gorm:"column:tds_section_id" json:"tdsSectionId"`
	PaymentDate   time.Time       `gorm:"column:payment_date;type:date" json:"paymentDate"`
	BaseAmount    decimal.Decimal `gorm:"column:base_amount;type:decimal(12,2)" json:"baseAmount"`
	TDSRate       decimal.Decimal `gorm:"column:tds_rate;type:decimal(5,2)" json:"tdsRate"`
	TDSAmount     decimal.Decimal `gorm:"column:tds_amount;type:decimal(12,2)" json:"tdsAmount"`
	FinancialYear string          `gorm:"column:financial_year;size:10" json:"financialYear"`
	Status        string          `gorm:"column:status;size:20;default:PENDING" json:"status"` // PENDING, RECEIVED
	ReceivedDate  *time.Time      `gorm:"column:received_date;type:date" json:"receivedDate,omitempty"`
	Notes         string          `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`

	TDSSection *TDSSection `gorm:"foreignKey:TDSSectionID" json:"tdsSection,omitempty"`
}

func (TDSReceivable) TableName() string { return "tds_receivables" }
