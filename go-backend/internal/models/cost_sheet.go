package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// CostSheet is a computed summary of all costs for a production order.
// One per ProductionOrder; recomputed asynchronously after each ProductionEntry save.
type CostSheet struct {
	ID                  int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductionOrderID   int             `gorm:"uniqueIndex;column:production_order_id" json:"productionOrderId"`
	TotalMaterialCost   decimal.Decimal `gorm:"column:total_material_cost;type:decimal(14,2);default:0" json:"totalMaterialCost"`
	TotalLaborCost      decimal.Decimal `gorm:"column:total_labor_cost;type:decimal(14,2);default:0" json:"totalLaborCost"`
	TotalMachineCost    decimal.Decimal `gorm:"column:total_machine_cost;type:decimal(14,2);default:0" json:"totalMachineCost"`
	TotalOverheadCost   decimal.Decimal `gorm:"column:total_overhead_cost;type:decimal(14,2);default:0" json:"totalOverheadCost"`
	TotalCost           decimal.Decimal `gorm:"column:total_cost;type:decimal(14,2);default:0" json:"totalCost"`
	OutputQty           int             `gorm:"column:output_qty;default:0" json:"outputQty"`           // final testing pipes completed
	CostPerPipe         decimal.Decimal `gorm:"column:cost_per_pipe;type:decimal(12,4);default:0" json:"costPerPipe"`
	LastComputedAt      *time.Time      `gorm:"column:last_computed_at" json:"lastComputedAt"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	ProductionOrder *ProductionOrder `gorm:"foreignKey:ProductionOrderID" json:"productionOrder,omitempty"`
	Lines           []CostSheetLine  `gorm:"foreignKey:CostSheetID" json:"lines,omitempty"`
}

func (CostSheet) TableName() string { return "cost_sheets" }

// CostSheetLine is an itemised cost entry within a cost sheet.
type CostSheetLine struct {
	ID          int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	CostSheetID int             `gorm:"index;column:cost_sheet_id" json:"costSheetId"`
	CostType    CostType        `gorm:"column:cost_type" json:"costType"`
	Description string          `gorm:"column:description" json:"description"`
	Amount      decimal.Decimal `gorm:"column:amount;type:decimal(14,2)" json:"amount"`
	ReferenceID *int            `gorm:"column:reference_id" json:"referenceId"` // e.g. material_consumption_id

	CostSheet *CostSheet `gorm:"foreignKey:CostSheetID" json:"costSheet,omitempty"`
}

func (CostSheetLine) TableName() string { return "cost_sheet_lines" }
