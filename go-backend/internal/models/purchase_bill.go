package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type PurchaseBill struct {
	ID               int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	BillNumber       string          `gorm:"uniqueIndex;column:bill_number" json:"billNumber"`
	SupplierID       int             `gorm:"column:supplier_id" json:"supplierId"`
	OutletID         int             `gorm:"column:outlet_id" json:"outletId"`
	SourcePoID       *int            `gorm:"column:source_po_id" json:"sourcePoId"`
	VendorBillNumber *string         `gorm:"column:vendor_bill_number" json:"vendorBillNumber"`
	BillDate         time.Time       `gorm:"column:bill_date;type:date" json:"billDate"`
	DueDate          *time.Time      `gorm:"column:due_date;type:date" json:"dueDate"`
	Status           BillStatus      `gorm:"column:status;default:UNPAID" json:"status"`
	Subtotal         decimal.Decimal `gorm:"column:subtotal;type:decimal(10,2);default:0" json:"subtotal"`
	TaxAmount        decimal.Decimal `gorm:"column:tax_amount;type:decimal(10,2);default:0" json:"taxAmount"`
	CGSTAmount       decimal.Decimal `gorm:"column:cgst_amount;type:decimal(10,2);default:0" json:"cgstAmount"`
	SGSTAmount       decimal.Decimal `gorm:"column:sgst_amount;type:decimal(10,2);default:0" json:"sgstAmount"`
	IGSTAmount       decimal.Decimal `gorm:"column:igst_amount;type:decimal(10,2);default:0" json:"igstAmount"`
	TotalAmount      decimal.Decimal `gorm:"column:total_amount;type:decimal(10,2);default:0" json:"totalAmount"`
	PaidAmount       decimal.Decimal `gorm:"column:paid_amount;type:decimal(10,2);default:0" json:"paidAmount"`
	SupplyType       SupplyType      `gorm:"column:supply_type;default:INTRA_STATE" json:"supplyType"`
	VendorGSTIN      *string         `gorm:"column:vendor_gstin" json:"vendorGstin"`
	Notes            *string         `gorm:"column:notes" json:"notes"`
	CreatedAt        time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt        time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy        *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy        *string         `gorm:"column:updated_by" json:"updatedBy"`

	Supplier     *Supplier           `gorm:"foreignKey:SupplierID" json:"supplier"`
	Outlet       *Outlet             `gorm:"foreignKey:OutletID" json:"outlet"`
	SourcePo     *PurchaseOrder      `gorm:"foreignKey:SourcePoID;references:ID" json:"sourcePo"`
	Items        []PurchaseBillItem  `gorm:"foreignKey:BillID" json:"items,omitempty"`
}

func (PurchaseBill) TableName() string {
	return "purchase_bills"
}
