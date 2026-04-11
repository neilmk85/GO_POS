package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type ExpenseCategory struct {
	ID            int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name          string           `gorm:"column:name" json:"name"`
	Description   *string          `gorm:"column:description" json:"description"`
	Color         string           `gorm:"column:color;default:#6B7280" json:"color"`
	Icon          string           `gorm:"column:icon;default:receipt" json:"icon"`
	System        bool             `gorm:"column:is_system;default:false" json:"system"`
	Active        bool             `gorm:"column:is_active;default:true" json:"active"`
	MonthlyBudget *decimal.Decimal `gorm:"column:monthly_budget;type:decimal(12,2)" json:"monthlyBudget"`
	CreatedAt     time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string          `gorm:"column:updated_by" json:"updatedBy"`

	Expenses []Expense `gorm:"foreignKey:ExpenseCategoryID" json:"expenses,omitempty"`
}

func (ExpenseCategory) TableName() string {
	return "expense_categories"
}
