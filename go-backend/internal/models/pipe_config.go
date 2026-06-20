package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// PipeConfig is the master record for one PCCP pipe specification (diameter + pressure class).
// Auto-seeded from the formula CSV; also editable via the Pipe Configuration UI.
type PipeConfig struct {
	ID            int     `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name          string  `gorm:"uniqueIndex;size:191;column:name" json:"name"` // e.g. "PCCP 600mm 10kg"
	DiameterMM    int     `gorm:"column:diameter_mm" json:"diameterMm"`
	PressureClass string  `gorm:"column:pressure_class" json:"pressureClass"` // e.g. "10kg"
	Description   *string `gorm:"column:description" json:"description"`
	Active        bool    `gorm:"column:is_active;default:true" json:"active"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	Materials []PipeConfigMaterial `gorm:"foreignKey:PipeConfigID" json:"materials,omitempty"`
}

func (PipeConfig) TableName() string { return "pipe_configs" }

// PipeConfigMaterial defines one raw material consumed at a specific production stage.
// Quantity is per finished pipe (from the formula CSV, in kg unless UOM overridden).
type PipeConfigMaterial struct {
	ID                int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PipeConfigID      int             `gorm:"index;column:pipe_config_id" json:"pipeConfigId"`
	StageType         ProdStageType   `gorm:"column:stage_type" json:"stageType"` // SPINNING / WINDING / COATING
	MaterialProductID int             `gorm:"column:material_product_id" json:"materialProductId"`
	QuantityPerPipe   decimal.Decimal `gorm:"column:quantity_per_pipe;type:decimal(12,4)" json:"quantityPerPipe"`
	UOM               string          `gorm:"column:uom;default:kg" json:"uom"`
	ScrapPercent      decimal.Decimal `gorm:"column:scrap_percent;type:decimal(5,2);default:0" json:"scrapPercent"`
	Notes             *string         `gorm:"column:notes" json:"notes"`

	PipeConfig      *PipeConfig `gorm:"foreignKey:PipeConfigID" json:"pipeConfig,omitempty"`
	MaterialProduct *Product    `gorm:"foreignKey:MaterialProductID" json:"materialProduct,omitempty"`
}

func (PipeConfigMaterial) TableName() string { return "pipe_config_materials" }
