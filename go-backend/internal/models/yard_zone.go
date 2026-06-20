package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// YardZone represents a named storage area in the production yard.
type YardZone struct {
	ID          int          `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	OutletID    int          `gorm:"column:outlet_id" json:"outletId"`
	Name        string       `gorm:"column:name" json:"name"`
	ZoneType    YardZoneType `gorm:"column:zone_type" json:"zoneType"`
	Capacity    int          `gorm:"column:capacity;default:0" json:"capacity"` // max pipes
	Description *string      `gorm:"column:description" json:"description"`
	Active      bool         `gorm:"column:is_active;default:true" json:"active"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Outlet    *Outlet        `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
	Locations []YardLocation `gorm:"foreignKey:ZoneID" json:"locations,omitempty"`
}

func (YardZone) TableName() string { return "yard_zones" }

// YardLocation tracks a batch of pipes currently sitting in a yard zone.
type YardLocation struct {
	ID                int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ZoneID            int        `gorm:"index;column:zone_id" json:"zoneId"`
	ProductionOrderID int        `gorm:"column:production_order_id" json:"productionOrderId"`
	PipeConfigID      int        `gorm:"column:pipe_config_id" json:"pipeConfigId"`
	Quantity          int        `gorm:"column:quantity" json:"quantity"`
	Status            PipeStatus `gorm:"column:status" json:"status"`
	EnteredAt         time.Time  `gorm:"column:entered_at" json:"enteredAt"`
	ExitedAt          *time.Time `gorm:"column:exited_at" json:"exitedAt"`
	Notes             *string    `gorm:"column:notes" json:"notes"`

	Zone            *YardZone        `gorm:"foreignKey:ZoneID" json:"zone,omitempty"`
	ProductionOrder *ProductionOrder `gorm:"foreignKey:ProductionOrderID" json:"productionOrder,omitempty"`
	PipeConfig      *PipeConfig      `gorm:"foreignKey:PipeConfigID" json:"pipeConfig,omitempty"`
}

func (YardLocation) TableName() string { return "yard_locations" }

// YardMovement records every time a batch of pipes moves between yard zones.
type YardMovement struct {
	ID                int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductionOrderID int             `gorm:"index;column:production_order_id" json:"productionOrderId"`
	PipeConfigID      int             `gorm:"column:pipe_config_id" json:"pipeConfigId"`
	FromZoneID        *int            `gorm:"column:from_zone_id" json:"fromZoneId"` // null = initial placement
	ToZoneID          int             `gorm:"column:to_zone_id" json:"toZoneId"`
	Quantity          int             `gorm:"column:quantity" json:"quantity"`
	MovedAt           time.Time       `gorm:"column:moved_at" json:"movedAt"`
	MovedByUserID     *int            `gorm:"column:moved_by_user_id" json:"movedByUserId"`
	SalesOrderID      *int            `gorm:"column:sales_order_id" json:"salesOrderId"` // set when dispatching
	DispatchNote      *string         `gorm:"column:dispatch_note" json:"dispatchNote"`
	TransportCost     decimal.Decimal `gorm:"column:transport_cost;type:decimal(10,2);default:0" json:"transportCost"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`

	ProductionOrder *ProductionOrder `gorm:"foreignKey:ProductionOrderID" json:"productionOrder,omitempty"`
	PipeConfig      *PipeConfig      `gorm:"foreignKey:PipeConfigID" json:"pipeConfig,omitempty"`
	FromZone        *YardZone        `gorm:"foreignKey:FromZoneID" json:"fromZone,omitempty"`
	ToZone          *YardZone        `gorm:"foreignKey:ToZoneID" json:"toZone,omitempty"`
}

func (YardMovement) TableName() string { return "yard_movements" }
