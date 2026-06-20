package models

import "time"

// ProductionPlan is a daily/weekly production schedule.
type ProductionPlan struct {
	ID              int            `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PlanDate        time.Time      `gorm:"column:plan_date;type:date" json:"planDate"`
	OutletID        int            `gorm:"column:outlet_id" json:"outletId"`
	Status          PlanningStatus `gorm:"column:status;default:DRAFT" json:"status"`
	Notes           *string        `gorm:"column:notes;type:text" json:"notes"`
	CreatedByUserID *int           `gorm:"column:created_by_user_id" json:"createdByUserId"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string   `gorm:"column:updated_by" json:"updatedBy"`

	Outlet  *Outlet              `gorm:"foreignKey:OutletID" json:"outlet,omitempty"`
	Entries []ProductionPlanEntry `gorm:"foreignKey:PlanID" json:"entries,omitempty"`
}

func (ProductionPlan) TableName() string { return "production_plans" }

// ProductionPlanEntry is one line in a production plan.
type ProductionPlanEntry struct {
	ID                int           `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PlanID            int           `gorm:"index;column:plan_id" json:"planId"`
	ProductionOrderID int           `gorm:"column:production_order_id" json:"productionOrderId"`
	MachineID         *int          `gorm:"column:machine_id" json:"machineId"`
	ShiftName         ProdShiftName `gorm:"column:shift_name" json:"shiftName"`
	StageType         ProdStageType `gorm:"column:stage_type" json:"stageType"`
	PlannedQty        int           `gorm:"column:planned_qty" json:"plannedQty"`
	ActualQty         int           `gorm:"column:actual_qty;default:0" json:"actualQty"`

	Plan            *ProductionPlan    `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	ProductionOrder *ProductionOrder   `gorm:"foreignKey:ProductionOrderID" json:"productionOrder,omitempty"`
	Machine         *ProductionMachine `gorm:"foreignKey:MachineID" json:"machine,omitempty"`
}

func (ProductionPlanEntry) TableName() string { return "production_plan_entries" }
