package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type Payment struct {
	ID                   int            `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OrderID              int            `gorm:"column:order_id" json:"orderId"`
	PaymentMethod        PaymentMethod  `gorm:"column:payment_method" json:"paymentMethod"`
	Amount               decimal.Decimal `gorm:"column:amount;type:decimal(10,2)" json:"amount"`
	ReferenceNumber      *string        `gorm:"column:reference_number" json:"referenceNumber"`
	GatewayTransactionID *string        `gorm:"column:gateway_transaction_id" json:"gatewayTransactionId"`
	Status               PaymentStatus  `gorm:"column:status;default:COMPLETED" json:"status"`
	CreditNoteID         *int           `gorm:"column:credit_note_id" json:"creditNoteId"`
	Notes                *string        `gorm:"column:notes" json:"notes"`
	CreatedAt            time.Time      `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt            time.Time      `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy            *string        `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy            *string        `gorm:"column:updated_by" json:"updatedBy"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order"`
}

func (Payment) TableName() string {
	return "payments"
}
