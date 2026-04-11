package models

import "time"

type IncentiveRule struct {
	ID                   int                `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name                 string             `gorm:"column:name" json:"name"`
	Description          *string            `gorm:"column:description" json:"description"`
	RuleType             IncentiveRuleType  `gorm:"column:rule_type" json:"ruleType"`
	CommissionRate       *float64           `gorm:"column:commission_rate" json:"commissionRate"`
	TargetAmount         *float64           `gorm:"column:target_amount" json:"targetAmount"`
	BonusAmount          *float64           `gorm:"column:bonus_amount" json:"bonusAmount"`
	MinTransactionAmount *float64           `gorm:"column:min_transaction_amount" json:"minTransactionAmount"`
	BonusPerTransaction  *float64           `gorm:"column:bonus_per_transaction" json:"bonusPerTransaction"`
	Tiers                *string            `gorm:"column:tiers;type:json" json:"tiers"`
	ApplyToAll           bool               `gorm:"column:apply_to_all;default:true" json:"applyToAll"`
	StaffIds             *string            `gorm:"column:staff_ids;type:json" json:"staffIds"`
	OutletID             *int               `gorm:"column:outlet_id" json:"outletId"`
	Active               bool               `gorm:"column:is_active;default:true" json:"active"`
	CreatedAt            time.Time          `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt            time.Time          `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy            *string            `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy            *string            `gorm:"column:updated_by" json:"updatedBy"`

	Outlet *Outlet `gorm:"foreignKey:OutletID" json:"outlet"`
}

func (IncentiveRule) TableName() string {
	return "incentive_rules"
}
