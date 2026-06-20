package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// MaterialConsumption records the actual raw material used during a production entry.
// Auto-created by the service when completing SPINNING, WINDING, or COATING entries.
// Formula: ConsumedQty = PipeConfigMaterial.QuantityPerPipe × ProductionEntry.PipesCompleted
type MaterialConsumption struct {
	ID                   int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductionEntryID    int             `gorm:"index;column:production_entry_id" json:"productionEntryId"`
	PipeConfigMaterialID *int            `gorm:"column:pipe_config_material_id" json:"pipeConfigMaterialId"` // null = ad-hoc line
	MaterialProductID    int             `gorm:"column:material_product_id" json:"materialProductId"`
	OutletID             int             `gorm:"column:outlet_id" json:"outletId"`
	ConsumedQty          decimal.Decimal `gorm:"column:consumed_qty;type:decimal(12,4)" json:"consumedQty"`
	UOM                  string          `gorm:"column:uom;default:kg" json:"uom"`
	UnitCost             decimal.Decimal `gorm:"column:unit_cost;type:decimal(12,4)" json:"unitCost"`   // snapshot from inventory average cost
	TotalCost            decimal.Decimal `gorm:"column:total_cost;type:decimal(14,2)" json:"totalCost"` // ConsumedQty × UnitCost

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`

	ProductionEntry    *ProductionEntry    `gorm:"foreignKey:ProductionEntryID" json:"productionEntry,omitempty"`
	PipeConfigMaterial *PipeConfigMaterial `gorm:"foreignKey:PipeConfigMaterialID" json:"pipeConfigMaterial,omitempty"`
	MaterialProduct    *Product            `gorm:"foreignKey:MaterialProductID" json:"materialProduct,omitempty"`
}

func (MaterialConsumption) TableName() string { return "material_consumptions" }
