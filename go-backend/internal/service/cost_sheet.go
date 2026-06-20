package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type CostSheetService struct {
	db *gorm.DB
}

func NewCostSheetService(db *gorm.DB) *CostSheetService {
	return &CostSheetService{db: db}
}

type StageCostBreakdown struct {
	StageType    models.ProdStageType `json:"stageType"`
	MaterialCost decimal.Decimal      `json:"materialCost"`
	MachineCost  decimal.Decimal      `json:"machineCost"`
	TotalCost    decimal.Decimal      `json:"totalCost"`
}

func (s *CostSheetService) GetByOrder(productionOrderID int) (*models.CostSheet, error) {
	var cs models.CostSheet
	err := s.db.
		Where("production_order_id = ?", productionOrderID).
		Preload("Lines").
		First(&cs).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{
			Message: fmt.Sprintf("Cost sheet for order %d not found", productionOrderID),
		}
	}
	return &cs, err
}

// ComputeForOrder (re)computes the cost sheet for a production order.
// Called asynchronously after each production entry save.
func (s *CostSheetService) ComputeForOrder(productionOrderID int) (*models.CostSheet, error) {
	var order models.ProductionOrder
	if err := s.db.First(&order, productionOrderID).Error; err != nil {
		return nil, err
	}

	// ── Material cost ─────────────────────────────────────────────────────────
	var materialCost decimal.Decimal
	var matRows []struct {
		TotalCost decimal.Decimal
	}
	s.db.Raw(`
		SELECT COALESCE(SUM(mc.total_cost), 0) as total_cost
		FROM material_consumptions mc
		JOIN production_entries pe ON pe.id = mc.production_entry_id
		WHERE pe.production_order_id = ?
	`, productionOrderID).Scan(&matRows)
	if len(matRows) > 0 {
		materialCost = matRows[0].TotalCost
	}

	// ── Machine cost ──────────────────────────────────────────────────────────
	// For now: hourly_rate × 1 hour per entry where machine is assigned
	// (expand with actual runtime tracking in Phase 6)
	var machineCost decimal.Decimal
	var machRows []struct {
		TotalCost decimal.Decimal
	}
	s.db.Raw(`
		SELECT COALESCE(SUM(m.hourly_rate), 0) as total_cost
		FROM production_entries pe
		JOIN production_machines m ON m.id = pe.machine_id
		WHERE pe.production_order_id = ?
	`, productionOrderID).Scan(&machRows)
	if len(machRows) > 0 {
		machineCost = machRows[0].TotalCost
	}

	// ── Overhead cost ─────────────────────────────────────────────────────────
	// Get final testing completed count
	var finalCompleted int
	var ftRow struct{ Total int }
	s.db.Raw(`
		SELECT COALESCE(SUM(pipes_completed), 0) as total
		FROM production_entries
		WHERE production_order_id = ? AND stage_type = 'FINAL_TESTING'
	`, productionOrderID).Scan(&ftRow)
	finalCompleted = ftRow.Total

	var overheadCost decimal.Decimal
	if finalCompleted > 0 {
		var ohRows []struct {
			RatePerPipe decimal.Decimal
		}
		s.db.Raw(`
			SELECT rate_per_pipe FROM overhead_configs
			WHERE outlet_id = ? AND is_active = true
		`, order.OutletID).Scan(&ohRows)
		for _, row := range ohRows {
			overheadCost = overheadCost.Add(row.RatePerPipe.Mul(decimal.NewFromInt(int64(finalCompleted))))
		}
	}

	totalCost := materialCost.Add(machineCost).Add(overheadCost)

	var costPerPipe decimal.Decimal
	if finalCompleted > 0 {
		costPerPipe = totalCost.Div(decimal.NewFromInt(int64(finalCompleted)))
	}

	now := time.Now()

	var resultCS models.CostSheet
	txErr := s.db.Transaction(func(tx *gorm.DB) error {
		// Delete old lines
		tx.Where("cost_sheet_id IN (SELECT id FROM cost_sheets WHERE production_order_id = ?)", productionOrderID).
			Delete(&models.CostSheetLine{})

		// Upsert cost sheet header
		var cs models.CostSheet
		tx.Where("production_order_id = ?", productionOrderID).First(&cs)
		cs.ProductionOrderID = productionOrderID
		cs.TotalMaterialCost = materialCost
		cs.TotalMachineCost = machineCost
		cs.TotalOverheadCost = overheadCost
		cs.TotalCost = totalCost
		cs.OutputQty = finalCompleted
		cs.CostPerPipe = costPerPipe
		cs.LastComputedAt = &now

		if cs.ID == 0 {
			if err := tx.Create(&cs).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Save(&cs).Error; err != nil {
				return err
			}
		}

		// Re-create lines
		if materialCost.GreaterThan(decimal.Zero) {
			tx.Create(&models.CostSheetLine{
				CostSheetID: cs.ID,
				CostType:    models.CostTypeMaterial,
				Description: "Raw material consumptions",
				Amount:      materialCost,
			})
		}
		if machineCost.GreaterThan(decimal.Zero) {
			tx.Create(&models.CostSheetLine{
				CostSheetID: cs.ID,
				CostType:    models.CostTypeMachine,
				Description: "Machine usage",
				Amount:      machineCost,
			})
		}
		if overheadCost.GreaterThan(decimal.Zero) {
			tx.Create(&models.CostSheetLine{
				CostSheetID: cs.ID,
				CostType:    models.CostTypeOverhead,
				Description: fmt.Sprintf("Overhead (%d pipes)", finalCompleted),
				Amount:      overheadCost,
			})
		}

		resultCS = cs
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}
	return &resultCS, nil
}

func (s *CostSheetService) GetStageCosts(productionOrderID int) ([]StageCostBreakdown, error) {
	var rows []struct {
		StageType    models.ProdStageType `gorm:"column:stage_type"`
		MaterialCost decimal.Decimal      `gorm:"column:material_cost"`
		MachineCost  decimal.Decimal      `gorm:"column:machine_cost"`
	}

	s.db.Raw(`
		SELECT
			pe.stage_type,
			COALESCE(SUM(mc.total_cost), 0)   AS material_cost,
			COALESCE(SUM(m.hourly_rate), 0)   AS machine_cost
		FROM production_entries pe
		LEFT JOIN material_consumptions mc ON mc.production_entry_id = pe.id
		LEFT JOIN production_machines m   ON m.id = pe.machine_id
		WHERE pe.production_order_id = ?
		GROUP BY pe.stage_type
	`, productionOrderID).Scan(&rows)

	result := make([]StageCostBreakdown, 0, len(rows))
	for _, r := range rows {
		result = append(result, StageCostBreakdown{
			StageType:    r.StageType,
			MaterialCost: r.MaterialCost,
			MachineCost:  r.MachineCost,
			TotalCost:    r.MaterialCost.Add(r.MachineCost),
		})
	}
	return result, nil
}

