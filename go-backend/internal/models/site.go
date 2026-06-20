package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// WorkOrder statuses
type WorkOrderStatus string

const (
	WorkOrderStatusDraft     WorkOrderStatus = "DRAFT"
	WorkOrderStatusActive    WorkOrderStatus = "ACTIVE"
	WorkOrderStatusCompleted WorkOrderStatus = "COMPLETED"
	WorkOrderStatusBilled    WorkOrderStatus = "BILLED"
)

// WorkBill statuses
type WorkBillStatus string

const (
	WorkBillStatusDraft     WorkBillStatus = "DRAFT"
	WorkBillStatusSubmitted WorkBillStatus = "SUBMITTED"
	WorkBillStatusApproved  WorkBillStatus = "APPROVED"
	WorkBillStatusPaid      WorkBillStatus = "PAID"
)

// WorkBillPayMode payment modes
type WorkBillPayMode string

const (
	WorkBillPayModeBankTransfer WorkBillPayMode = "BANK_TRANSFER"
	WorkBillPayModeCheque       WorkBillPayMode = "CHEQUE"
	WorkBillPayModeUPI          WorkBillPayMode = "UPI"
	WorkBillPayModeCash         WorkBillPayMode = "CASH"
)

// WorkOrder represents a sub-contracted scope of work
type WorkOrder struct {
	ID             int             `gorm:"primaryKey;autoIncrement" json:"id"`
	WONumber       string          `gorm:"column:wo_number;type:varchar(191);uniqueIndex" json:"woNumber"`
	SiteProjectID  *int            `gorm:"column:site_project_id" json:"siteProjectId"`
	WorkPackageID  *int            `gorm:"column:work_package_id" json:"workPackageId"`
	ContractorID   int             `gorm:"column:contractor_id" json:"contractorId"`
	ContractorName string          `gorm:"column:contractor_name" json:"contractorName"`
	Title          string          `gorm:"column:title" json:"title"`
	Location       *string         `gorm:"column:location" json:"location"`
	StartDate      *string         `gorm:"column:start_date;type:date" json:"startDate"`
	EndDate        *string         `gorm:"column:end_date;type:date" json:"endDate"`
	Status         WorkOrderStatus `gorm:"column:status;default:DRAFT" json:"status"`
	Notes          *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt      time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy      *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy      *string         `gorm:"column:updated_by" json:"updatedBy"`

	Items []WorkOrderItem `gorm:"foreignKey:WorkOrderID;constraint:OnDelete:CASCADE" json:"items"`
}

func (WorkOrder) TableName() string { return "work_orders" }

// WorkOrderItem is a line in a work order scope
type WorkOrderItem struct {
	ID          int             `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkOrderID int             `gorm:"column:work_order_id;index" json:"workOrderId"`
	Description string          `gorm:"column:description" json:"description"`
	Unit        string          `gorm:"column:unit;default:LS" json:"unit"`
	Quantity    decimal.Decimal `gorm:"column:quantity;type:decimal(12,3);default:0" json:"quantity"`
	Rate        decimal.Decimal `gorm:"column:rate;type:decimal(12,2);default:0" json:"rate"`
	Amount      decimal.Decimal `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	SortOrder   int             `gorm:"column:sort_order;default:0" json:"sortOrder"`
}

func (WorkOrderItem) TableName() string { return "work_order_items" }

// WorkBill is a GST invoice raised against a WorkOrder
type WorkBill struct {
	ID                  int             `gorm:"primaryKey;autoIncrement" json:"id"`
	BillNumber          string          `gorm:"column:bill_number;size:191;uniqueIndex" json:"billNumber"`
	WorkOrderID         int             `gorm:"column:work_order_id;index" json:"workOrderId"`
	WONumber            string          `gorm:"column:wo_number" json:"woNumber"`
	WOTitle             string          `gorm:"column:wo_title" json:"woTitle"`
	ContractorID        int             `gorm:"column:contractor_id" json:"contractorId"`
	ContractorName      string          `gorm:"column:contractor_name" json:"contractorName"`
	ContractorGstin     *string         `gorm:"column:contractor_gstin" json:"contractorGstin"`
	BillingPeriodFrom   *string         `gorm:"column:billing_period_from;type:date" json:"billingPeriodFrom"`
	BillingPeriodTo     *string         `gorm:"column:billing_period_to;type:date" json:"billingPeriodTo"`
	BillDate            string          `gorm:"column:bill_date;type:date" json:"billDate"`
	DueDate             *string         `gorm:"column:due_date;type:date" json:"dueDate"`
	SupplyType          SupplyType      `gorm:"column:supply_type;default:INTRA_STATE" json:"supplyType"`
	TDSRate             decimal.Decimal `gorm:"column:tds_rate;type:decimal(5,2);default:0" json:"tdsRate"`
	Status              WorkBillStatus  `gorm:"column:status;default:DRAFT" json:"status"`
	ContractorInvoiceNo *string         `gorm:"column:contractor_invoice_no" json:"contractorInvoiceNo"`
	Notes               *string         `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt           time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy           *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy           *string         `gorm:"column:updated_by" json:"updatedBy"`

	Items     []WorkBillItem    `gorm:"foreignKey:WorkBillID;constraint:OnDelete:CASCADE" json:"items"`
	Payments  []WorkBillPayment `gorm:"foreignKey:WorkBillID;constraint:OnDelete:CASCADE" json:"payments"`
	WorkOrder *WorkOrder        `gorm:"foreignKey:WorkOrderID" json:"workOrder,omitempty"`
}

func (WorkBill) TableName() string { return "work_bills" }

// WorkBillItem is a line in a work bill
type WorkBillItem struct {
	ID            int             `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkBillID    int             `gorm:"column:work_bill_id;index" json:"workBillId"`
	Description   string          `gorm:"column:description" json:"description"`
	Unit          string          `gorm:"column:unit;default:LS" json:"unit"`
	ContractedQty decimal.Decimal `gorm:"column:contracted_qty;type:decimal(12,3);default:0" json:"contractedQty"`
	ActualQty     decimal.Decimal `gorm:"column:actual_qty;type:decimal(12,3);default:0" json:"actualQty"`
	Rate          decimal.Decimal `gorm:"column:rate;type:decimal(12,2);default:0" json:"rate"`
	GSTRate       decimal.Decimal `gorm:"column:gst_rate;type:decimal(5,2);default:0" json:"gstRate"`
	Amount        decimal.Decimal `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	SortOrder     int             `gorm:"column:sort_order;default:0" json:"sortOrder"`
}

func (WorkBillItem) TableName() string { return "work_bill_items" }

// WorkBillPayment records a payment made against a work bill
type WorkBillPayment struct {
	ID         int             `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkBillID int             `gorm:"column:work_bill_id;index" json:"workBillId"`
	Date       string          `gorm:"column:date;type:date" json:"date"`
	Amount     decimal.Decimal `gorm:"column:amount;type:decimal(12,2);default:0" json:"amount"`
	Mode       WorkBillPayMode `gorm:"column:mode;default:BANK_TRANSFER" json:"mode"`
	Reference  *string         `gorm:"column:reference" json:"reference"`
	CreatedAt  time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	CreatedBy  *string         `gorm:"column:created_by" json:"createdBy"`
}

func (WorkBillPayment) TableName() string { return "work_bill_payments" }
