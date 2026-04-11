package models

import "time"

type Outlet struct {
	ID                     int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name                   string     `gorm:"column:name" json:"name"`
	Code                   *string    `gorm:"uniqueIndex;column:code" json:"code"`
	Address                *string    `gorm:"column:address" json:"address"`
	City                   *string    `gorm:"column:city" json:"city"`
	State                  *string    `gorm:"column:state" json:"state"`
	Pincode                *string    `gorm:"column:pincode" json:"pincode"`
	Country                *string    `gorm:"column:country" json:"country"`
	Phone                  *string    `gorm:"column:phone" json:"phone"`
	Phone2                 *string    `gorm:"column:phone2" json:"phone2"`
	Email                  *string    `gorm:"column:email" json:"email"`
	GSTIN                  *string    `gorm:"column:gstin" json:"gstin"`
	PAN                    *string    `gorm:"column:pan" json:"pan"`
	CurrencyCode           string     `gorm:"column:currency_code;default:INR" json:"currencyCode"`
	CurrencySymbol         string     `gorm:"column:currency_symbol;default:₹" json:"currencySymbol"`
	Active                 bool       `gorm:"column:is_active;default:true" json:"active"`
	ReceiptHeader          *string    `gorm:"column:receipt_header;type:text" json:"receiptHeader"`
	ReceiptFooter          *string    `gorm:"column:receipt_footer;type:text" json:"receiptFooter"`
	PrintReceiptByDefault  bool       `gorm:"column:print_receipt_by_default;default:true" json:"printReceiptByDefault"`
	ShowTaxBreakdown       bool       `gorm:"column:show_tax_breakdown;default:true" json:"showTaxBreakdown"`
	ShowBarcodeOnReceipt   bool       `gorm:"column:show_barcode_on_receipt;default:true" json:"showBarcodeOnReceipt"`
	InvoiceTemplate        *string    `gorm:"column:invoice_template;type:text" json:"invoiceTemplate"`
	CreatedAt              time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt              time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy              *string    `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy              *string    `gorm:"column:updated_by" json:"updatedBy"`

	Users               []User               `gorm:"foreignKey:OutletID" json:"users,omitempty"`
	Inventories         []Inventory          `gorm:"foreignKey:OutletID" json:"inventories,omitempty"`
	Orders              []Order              `gorm:"foreignKey:OutletID" json:"orders,omitempty"`
	Invoices            []Invoice            `gorm:"foreignKey:OutletID" json:"invoices,omitempty"`
	Quotations          []Quotation          `gorm:"foreignKey:OutletID" json:"quotations,omitempty"`
	CreditNotes         []CreditNote         `gorm:"foreignKey:OutletID" json:"creditNotes,omitempty"`
	Shifts              []Shift              `gorm:"foreignKey:OutletID" json:"shifts,omitempty"`
	StockAdjustments    []StockAdjustment    `gorm:"foreignKey:OutletID" json:"stockAdjustments,omitempty"`
	StockTransfersFrom  []StockTransfer      `gorm:"foreignKey:FromOutletID;references:ID" json:"stockTransfersFrom,omitempty"`
	StockTransfersTo    []StockTransfer      `gorm:"foreignKey:ToOutletID;references:ID" json:"stockTransfersTo,omitempty"`
	PurchaseOrders      []PurchaseOrder      `gorm:"foreignKey:OutletID" json:"purchaseOrders,omitempty"`
	PurchaseBills       []PurchaseBill       `gorm:"foreignKey:OutletID" json:"purchaseBills,omitempty"`
	PurchaseReturns     []PurchaseReturn     `gorm:"foreignKey:OutletID" json:"purchaseReturns,omitempty"`
	Expenses            []Expense            `gorm:"foreignKey:OutletID" json:"expenses,omitempty"`
	BulkPurchases       []BulkPurchase       `gorm:"foreignKey:OutletID" json:"bulkPurchases,omitempty"`
	IncentiveRules      []IncentiveRule      `gorm:"foreignKey:OutletID" json:"incentiveRules,omitempty"`
	IntegrationConfig   *IntegrationConfig   `gorm:"foreignKey:OutletID" json:"integrationConfig"`
	SalesOrders         []SalesOrder         `gorm:"foreignKey:OutletID" json:"salesOrders,omitempty"`
}

func (Outlet) TableName() string {
	return "outlets"
}
