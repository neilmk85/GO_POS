package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// ProgressClaim statuses
const (
	ProgressClaimStatusPending  = "PENDING"
	ProgressClaimStatusVerified = "VERIFIED"
	ProgressClaimStatusDisputed = "DISPUTED"
)

type ProgressClaim struct {
	ID            int                   `gorm:"primaryKey;autoIncrement" json:"id"`
	WorkOrderID   int                   `gorm:"column:work_order_id;index;not null" json:"workOrderId"`
	WONumber      string                `gorm:"column:wo_number" json:"woNumber"`
	ClaimDate     string                `gorm:"column:claim_date;type:date;not null" json:"claimDate"`
	// PENDING | VERIFIED | DISPUTED
	Status        string                `gorm:"column:status;default:PENDING" json:"status"`
	VerifiedBy    *string               `gorm:"column:verified_by" json:"verifiedBy"`
	VerifiedAt    *time.Time            `gorm:"column:verified_at" json:"verifiedAt"`
	Notes         *string               `gorm:"column:notes;type:text" json:"notes"`
	CreatedAt     time.Time             `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time             `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string               `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string               `gorm:"column:updated_by" json:"updatedBy"`

	Items     []ProgressClaimItem `gorm:"foreignKey:ProgressClaimID;constraint:OnDelete:CASCADE" json:"items"`
	WorkOrder *WorkOrder          `gorm:"foreignKey:WorkOrderID" json:"workOrder,omitempty"`
}

func (ProgressClaim) TableName() string { return "progress_claims" }

type ProgressClaimItem struct {
	ID                    int             `gorm:"primaryKey;autoIncrement" json:"id"`
	ProgressClaimID       int             `gorm:"column:progress_claim_id;index;not null" json:"progressClaimId"`
	Description           string          `gorm:"column:description;not null" json:"description"`
	Unit                  string          `gorm:"column:unit;default:LS" json:"unit"`
	ContractedQty         decimal.Decimal `gorm:"column:contracted_qty;type:decimal(12,3);default:0" json:"contractedQty"`
	PreviousCumulativeQty decimal.Decimal `gorm:"column:previous_cumulative_qty;type:decimal(12,3);default:0" json:"previousCumulativeQty"`
	ClaimedQty            decimal.Decimal `gorm:"column:claimed_qty;type:decimal(12,3);default:0" json:"claimedQty"`
	VerifiedQty           decimal.Decimal `gorm:"column:verified_qty;type:decimal(12,3);default:0" json:"verifiedQty"`
	Remark                *string         `gorm:"column:remark" json:"remark"`
	SortOrder             int             `gorm:"column:sort_order;default:0" json:"sortOrder"`
}

func (ProgressClaimItem) TableName() string { return "progress_claim_items" }
