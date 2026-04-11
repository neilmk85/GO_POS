package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type LoyaltyTransaction struct {
	ID          int                    `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	CustomerID  int                    `gorm:"column:customer_id" json:"customerId"`
	OrderID     *int                   `gorm:"column:order_id" json:"orderId"`
	Type        LoyaltyTransactionType `gorm:"column:type" json:"type"`
	Points      decimal.Decimal        `gorm:"column:points;type:decimal(10,2)" json:"points"`
	BalanceAfter *decimal.Decimal      `gorm:"column:balance_after;type:decimal(10,2)" json:"balanceAfter"`
	Description *string                `gorm:"column:description" json:"description"`
	CreatedAt   time.Time              `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time              `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy   *string                `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy   *string                `gorm:"column:updated_by" json:"updatedBy"`

	Customer *Customer `gorm:"foreignKey:CustomerID" json:"customer"`
	Order    *Order    `gorm:"foreignKey:OrderID" json:"order"`
}

func (LoyaltyTransaction) TableName() string {
	return "loyalty_transactions"
}
