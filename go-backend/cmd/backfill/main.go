// One-time backfill: credit finished-goods inventory for all existing FINAL_TESTING entries.
// Run once: go run ./cmd/backfill/
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/nilesh/pos-backend/internal/config"
	"github.com/nilesh/pos-backend/internal/database"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
)

func main() {
	if err := config.LoadEnvFile(".env"); err != nil {
		log.Println("no .env file, using env vars")
	}
	cfg := config.Load()
	db, err := database.Connect(cfg.DBDsn, cfg.Env == "development")
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}

	// Aggregate FINAL_TESTING completions grouped by pipe_config_id + outlet_id
	type Row struct {
		PipeConfigID   int
		OutletID       int
		TotalCompleted int
		PipeName       string
	}

	var rows []Row
	db.Raw(`
		SELECT
			pe.pipe_config_id,
			po.outlet_id,
			SUM(pe.pipes_completed) AS total_completed,
			pc.name                 AS pipe_name
		FROM production_entries pe
		JOIN production_orders po ON po.id = pe.production_order_id
		JOIN pipe_configs       pc ON pc.id = pe.pipe_config_id
		WHERE pe.stage_type = 'FINAL_TESTING'
		GROUP BY pe.pipe_config_id, po.outlet_id, pc.name
	`).Scan(&rows)

	if len(rows) == 0 {
		fmt.Println("No FINAL_TESTING entries found. Nothing to backfill.")
		return
	}

	by := "backfill"

	for _, row := range rows {
		if row.TotalCompleted <= 0 {
			continue
		}

		// Find or create FINISHED_PIPE product
		var product models.Product
		res := db.Where("name = ? AND item_type = ?", row.PipeName, "FINISHED_PIPE").First(&product)
		if res.Error != nil {
			product = models.Product{
				Name:           row.PipeName,
				ItemType:       "FINISHED_PIPE",
				ProductType:    "PHYSICAL",
				UnitOfMeasure:  "pcs",
				TrackInventory: true,
				Active:         true,
				CreatedBy:      &by,
				UpdatedBy:      &by,
			}
			if err := db.Create(&product).Error; err != nil {
				log.Printf("ERROR creating product for %s: %v", row.PipeName, err)
				continue
			}
			fmt.Printf("  Created product id=%d name=%q\n", product.ID, product.Name)
		}

		qty := decimal.NewFromInt(int64(row.TotalCompleted))
		now := time.Now()

		// Find or create inventory
		var inv models.Inventory
		invRes := db.Where("product_id = ? AND outlet_id = ? AND variant_id IS NULL", product.ID, row.OutletID).First(&inv)
		if invRes.Error != nil {
			inv = models.Inventory{
				ProductID:       product.ID,
				OutletID:        row.OutletID,
				QuantityOnHand:  qty,
				LastStockUpdate: &now,
			}
			if err := db.Create(&inv).Error; err != nil {
				log.Printf("ERROR creating inventory for product %d outlet %d: %v", product.ID, row.OutletID, err)
				continue
			}
			fmt.Printf("  Created inventory: product=%q outlet=%d qty=%d\n", row.PipeName, row.OutletID, row.TotalCompleted)
		} else {
			// Set quantity to aggregate total (backfill from scratch)
			if err := db.Model(&inv).Updates(map[string]interface{}{
				"quantity_on_hand":  qty,
				"last_stock_update": now,
			}).Error; err != nil {
				log.Printf("ERROR updating inventory for product %d: %v", product.ID, err)
				continue
			}
			fmt.Printf("  Updated inventory: product=%q outlet=%d qty=%d\n", row.PipeName, row.OutletID, row.TotalCompleted)
		}
	}

	fmt.Println("Backfill complete.")
}
