package service

import (
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ProductionReportService struct {
	db *gorm.DB
}

func NewProductionReportService(db *gorm.DB) *ProductionReportService {
	return &ProductionReportService{db: db}
}

// ── Stage Summary ─────────────────────────────────────────────────────────────
// Returns per-order, per-stage production counts, optionally filtered by date range.

type StageSummaryRow struct {
	PONumber       string `gorm:"column:po_number"       json:"poNumber"`
	PipeConfig     string `gorm:"column:pipe_config"     json:"pipeConfig"`
	DiameterMM     int    `gorm:"column:diameter_mm"     json:"diameterMm"`
	PressureClass  string `gorm:"column:pressure_class"  json:"pressureClass"`
	StageType      string `gorm:"column:stage_type"      json:"stageType"`
	PipesProcessed int    `gorm:"column:pipes_processed" json:"pipesProcessed"`
	PipesCompleted int    `gorm:"column:pipes_completed" json:"pipesCompleted"`
	PipesRejected  int    `gorm:"column:pipes_rejected"  json:"pipesRejected"`
	EntryCount     int    `gorm:"column:entry_count"     json:"entryCount"`
}

func (s *ProductionReportService) GetStageSummary(fromDate, toDate string, outletID *int) ([]StageSummaryRow, error) {
	query := `
		SELECT
			po.po_number,
			pc.name            AS pipe_config,
			pc.diameter_mm,
			pc.pressure_class,
			pe.stage_type,
			SUM(pe.pipes_processed)  AS pipes_processed,
			SUM(pe.pipes_completed)  AS pipes_completed,
			SUM(pe.pipes_rejected)   AS pipes_rejected,
			COUNT(pe.id)             AS entry_count
		FROM production_entries pe
		JOIN production_orders po  ON po.id = pe.production_order_id
		JOIN pipe_configs pc       ON pc.id = pe.pipe_config_id
		WHERE 1=1`

	args := []interface{}{}
	if fromDate != "" {
		query += " AND DATE(pe.entry_date) >= ?"
		args = append(args, fromDate)
	}
	if toDate != "" {
		query += " AND DATE(pe.entry_date) <= ?"
		args = append(args, toDate)
	}
	if outletID != nil {
		query += " AND pe.outlet_id = ?"
		args = append(args, *outletID)
	}
	query += `
		GROUP BY po.po_number, pc.name, pc.diameter_mm, pc.pressure_class, pe.stage_type
		ORDER BY po.po_number, pe.stage_type`

	var rows []StageSummaryRow
	err := s.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// ── Cost Summary ──────────────────────────────────────────────────────────────
// Returns per-order cost totals from cost_sheets.

type CostSummaryRow struct {
	PONumber        string          `gorm:"column:po_number"         json:"poNumber"`
	PipeConfig      string          `gorm:"column:pipe_config"       json:"pipeConfig"`
	DiameterMM      int             `gorm:"column:diameter_mm"       json:"diameterMm"`
	PressureClass   string          `gorm:"column:pressure_class"    json:"pressureClass"`
	Status          string          `gorm:"column:status"            json:"status"`
	PlannedQty      int             `gorm:"column:planned_qty"       json:"plannedQty"`
	FinalCompleted  int             `gorm:"column:final_completed"   json:"finalCompleted"`
	MaterialCost    decimal.Decimal `gorm:"column:material_cost"     json:"materialCost"`
	MachineCost     decimal.Decimal `gorm:"column:machine_cost"      json:"machineCost"`
	OverheadCost    decimal.Decimal `gorm:"column:overhead_cost"     json:"overheadCost"`
	TotalCost       decimal.Decimal `gorm:"column:total_cost"        json:"totalCost"`
	CostPerPipe     decimal.Decimal `gorm:"column:cost_per_pipe"     json:"costPerPipe"`
}

func (s *ProductionReportService) GetCostSummary(fromDate, toDate string, outletID *int) ([]CostSummaryRow, error) {
	query := `
		SELECT
			po.po_number,
			pc.name            AS pipe_config,
			pc.diameter_mm,
			pc.pressure_class,
			po.status,
			po.planned_qty,
			COALESCE(cs.final_testing_completed, 0) AS final_completed,
			COALESCE(cs.material_cost,  0)          AS material_cost,
			COALESCE(cs.machine_cost,   0)           AS machine_cost,
			COALESCE(cs.overhead_cost,  0)          AS overhead_cost,
			COALESCE(cs.total_cost,     0)           AS total_cost,
			COALESCE(cs.cost_per_pipe,  0)          AS cost_per_pipe
		FROM production_orders po
		JOIN pipe_configs pc  ON pc.id  = po.pipe_config_id
		LEFT JOIN cost_sheets cs ON cs.production_order_id = po.id
		WHERE 1=1`

	args := []interface{}{}
	if fromDate != "" {
		query += " AND DATE(po.created_at) >= ?"
		args = append(args, fromDate)
	}
	if toDate != "" {
		query += " AND DATE(po.created_at) <= ?"
		args = append(args, toDate)
	}
	if outletID != nil {
		query += " AND po.outlet_id = ?"
		args = append(args, *outletID)
	}
	query += " ORDER BY po.created_at DESC"

	var rows []CostSummaryRow
	err := s.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// ── Material Consumption ──────────────────────────────────────────────────────
// Returns total raw material consumed per product, optionally filtered.

type MaterialConsumptionRow struct {
	MaterialName string          `gorm:"column:material_name" json:"materialName"`
	StageType    string          `gorm:"column:stage_type"    json:"stageType"`
	UOM          string          `gorm:"column:uom"           json:"uom"`
	TotalQty     decimal.Decimal `gorm:"column:total_qty"     json:"totalQty"`
	TotalCost    decimal.Decimal `gorm:"column:total_cost"    json:"totalCost"`
	EntryCount   int             `gorm:"column:entry_count"   json:"entryCount"`
}

func (s *ProductionReportService) GetMaterialConsumption(fromDate, toDate string, outletID *int) ([]MaterialConsumptionRow, error) {
	query := `
		SELECT
			p.name             AS material_name,
			pe.stage_type,
			mc.uom,
			SUM(mc.consumed_qty) AS total_qty,
			SUM(mc.total_cost)   AS total_cost,
			COUNT(mc.id)         AS entry_count
		FROM material_consumptions mc
		JOIN products p              ON p.id  = mc.material_product_id
		JOIN production_entries pe   ON pe.id = mc.production_entry_id
		WHERE 1=1`

	args := []interface{}{}
	if fromDate != "" {
		query += " AND DATE(pe.entry_date) >= ?"
		args = append(args, fromDate)
	}
	if toDate != "" {
		query += " AND DATE(pe.entry_date) <= ?"
		args = append(args, toDate)
	}
	if outletID != nil {
		query += " AND mc.outlet_id = ?"
		args = append(args, *outletID)
	}
	query += `
		GROUP BY p.name, pe.stage_type, mc.uom
		ORDER BY p.name, pe.stage_type`

	var rows []MaterialConsumptionRow
	err := s.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// ── Machine Utilization ───────────────────────────────────────────────────────
// Returns per-machine entry counts and pipes completed.

type MachineUtilizationRow struct {
	MachineCode    string          `gorm:"column:machine_code"    json:"machineCode"`
	MachineName    string          `gorm:"column:machine_name"    json:"machineName"`
	MachineType    string          `gorm:"column:machine_type"    json:"machineType"`
	StageType      string          `gorm:"column:stage_type"      json:"stageType"`
	EntryCount     int             `gorm:"column:entry_count"     json:"entryCount"`
	PipesCompleted int             `gorm:"column:pipes_completed" json:"pipesCompleted"`
	TotalHours     decimal.Decimal `gorm:"column:total_hours"     json:"totalHours"`
	MachineCost    decimal.Decimal `gorm:"column:machine_cost"    json:"machineCost"`
}

func (s *ProductionReportService) GetMachineUtilization(fromDate, toDate string, outletID *int) ([]MachineUtilizationRow, error) {
	query := `
		SELECT
			m.machine_code,
			m.name             AS machine_name,
			m.machine_type,
			pe.stage_type,
			COUNT(pe.id)            AS entry_count,
			SUM(pe.pipes_completed) AS pipes_completed,
			0                       AS total_hours,
			0                       AS machine_cost
		FROM production_entries pe
		JOIN production_machines m ON m.id = pe.machine_id
		WHERE 1=1`

	args := []interface{}{}
	if fromDate != "" {
		query += " AND DATE(pe.entry_date) >= ?"
		args = append(args, fromDate)
	}
	if toDate != "" {
		query += " AND DATE(pe.entry_date) <= ?"
		args = append(args, toDate)
	}
	if outletID != nil {
		query += " AND pe.outlet_id = ?"
		args = append(args, *outletID)
	}
	query += `
		GROUP BY m.machine_code, m.name, m.machine_type, pe.stage_type
		ORDER BY m.machine_code, pe.stage_type`

	var rows []MachineUtilizationRow
	err := s.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}
