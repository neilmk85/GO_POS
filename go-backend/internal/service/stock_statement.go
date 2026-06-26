package service

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type StockStatementService struct {
	db *gorm.DB
}

func NewStockStatementService(db *gorm.DB) *StockStatementService {
	return &StockStatementService{db: db}
}

type StockStatementRow struct {
	ProductID    int             `json:"productId"`
	ProductName  string          `json:"productName"`
	Category     string          `json:"category"`
	UOM          string          `json:"uom"`
	OpeningQty   decimal.Decimal `json:"openingQty"`
	InwardQty    decimal.Decimal `json:"inwardQty"`
	OutwardQty   decimal.Decimal `json:"outwardQty"`
	ClosingQty   decimal.Decimal `json:"closingQty"`
	AvgCost      decimal.Decimal `json:"avgCost"`
	ClosingValue decimal.Decimal `json:"closingValue"`
	ReorderLevel int             `json:"reorderLevel"`
	IsLow        bool            `json:"isLow"`
}

type productQtyRow struct {
	ProductID int
	Qty       decimal.Decimal
}

func (s *StockStatementService) GetStatement(outletId int, from, to time.Time) ([]StockStatementRow, error) {
	// ── 1. Base: all inventory positions for this outlet ─────────────────────
	type inventoryRow struct {
		ProductID    int
		ProductName  string
		Category     string
		UOM          string
		ClosingQty   decimal.Decimal
		AvgCost      decimal.Decimal
		ReorderLevel int
	}
	var items []inventoryRow
	if err := s.db.Raw(`
		SELECT i.product_id,
		       p.name AS product_name,
		       COALESCE(c.name, '') AS category,
		       p.unit_of_measure AS uom,
		       i.quantity_on_hand AS closing_qty,
		       COALESCE(i.average_cost, 0) AS avg_cost,
		       i.reorder_level
		FROM inventory i
		JOIN products p ON p.id = i.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE i.outlet_id = ?
		ORDER BY p.name
	`, outletId).Scan(&items).Error; err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []StockStatementRow{}, nil
	}

	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")

	// ── 2. Inward movements within date range ─────────────────────────────────

	// 2a. Bulk purchases
	var bulkIn []productQtyRow
	s.db.Raw(`
		SELECT product_id, SUM(COALESCE(base_qty, purchase_qty)) AS qty
		FROM bulk_purchases
		WHERE outlet_id = ? AND DATE(COALESCE(purchase_date, created_at)) BETWEEN ? AND ?
		GROUP BY product_id
	`, outletId, fromStr, toStr).Scan(&bulkIn)

	// 2b. Purchase orders received
	var poIn []productQtyRow
	s.db.Raw(`
		SELECT poi.product_id, SUM(poi.received_quantity) AS qty
		FROM purchase_order_items poi
		JOIN purchase_orders po ON po.id = poi.purchase_order_id
		WHERE po.outlet_id = ? AND DATE(po.created_at) BETWEEN ? AND ?
		  AND po.status IN ('RECEIVED','PARTIALLY_RECEIVED')
		  AND poi.received_quantity > 0
		GROUP BY poi.product_id
	`, outletId, fromStr, toStr).Scan(&poIn)

	// 2c. Stock transfers received (incoming to this outlet)
	var transferIn []productQtyRow
	s.db.Raw(`
		SELECT sti.product_id, SUM(sti.received_quantity) AS qty
		FROM stock_transfer_items sti
		JOIN stock_transfers st ON st.id = sti.transfer_id
		WHERE st.to_outlet_id = ? AND DATE(st.created_at) BETWEEN ? AND ?
		  AND st.status = 'COMPLETED' AND sti.received_quantity > 0
		GROUP BY sti.product_id
	`, outletId, fromStr, toStr).Scan(&transferIn)

	// 2d. Positive stock adjustments
	var adjIn []productQtyRow
	s.db.Raw(`
		SELECT product_id, SUM(adjustment_quantity) AS qty
		FROM stock_adjustments
		WHERE outlet_id = ? AND DATE(created_at) BETWEEN ? AND ?
		  AND adjustment_quantity > 0
		GROUP BY product_id
	`, outletId, fromStr, toStr).Scan(&adjIn)

	// ── 3. Outward movements within date range ────────────────────────────────

	// 3a. Sales (order_items)
	var orderOut []productQtyRow
	s.db.Raw(`
		SELECT oi.product_id, SUM(GREATEST(oi.quantity - oi.returned_quantity, 0)) AS qty
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		WHERE o.outlet_id = ? AND DATE(o.created_at) BETWEEN ? AND ?
		  AND o.status NOT IN ('CANCELLED','REFUNDED')
		GROUP BY oi.product_id
	`, outletId, fromStr, toStr).Scan(&orderOut)

	// 3b. Stock transfers shipped (outgoing from this outlet)
	var transferOut []productQtyRow
	s.db.Raw(`
		SELECT sti.product_id, SUM(sti.shipped_quantity) AS qty
		FROM stock_transfer_items sti
		JOIN stock_transfers st ON st.id = sti.transfer_id
		WHERE st.from_outlet_id = ? AND DATE(st.created_at) BETWEEN ? AND ?
		  AND st.status = 'COMPLETED' AND sti.shipped_quantity > 0
		GROUP BY sti.product_id
	`, outletId, fromStr, toStr).Scan(&transferOut)

	// 3c. Negative stock adjustments
	var adjOut []productQtyRow
	s.db.Raw(`
		SELECT product_id, SUM(ABS(adjustment_quantity)) AS qty
		FROM stock_adjustments
		WHERE outlet_id = ? AND DATE(created_at) BETWEEN ? AND ?
		  AND adjustment_quantity < 0
		GROUP BY product_id
	`, outletId, fromStr, toStr).Scan(&adjOut)

	// ── 4. Aggregate into maps ────────────────────────────────────────────────
	inMap := map[int]decimal.Decimal{}
	for _, r := range bulkIn     { inMap[r.ProductID] = inMap[r.ProductID].Add(r.Qty) }
	for _, r := range poIn       { inMap[r.ProductID] = inMap[r.ProductID].Add(r.Qty) }
	for _, r := range transferIn { inMap[r.ProductID] = inMap[r.ProductID].Add(r.Qty) }
	for _, r := range adjIn      { inMap[r.ProductID] = inMap[r.ProductID].Add(r.Qty) }

	outMap := map[int]decimal.Decimal{}
	for _, r := range orderOut    { outMap[r.ProductID] = outMap[r.ProductID].Add(r.Qty) }
	for _, r := range transferOut { outMap[r.ProductID] = outMap[r.ProductID].Add(r.Qty) }
	for _, r := range adjOut      { outMap[r.ProductID] = outMap[r.ProductID].Add(r.Qty) }

	// ── 5. Build result rows ──────────────────────────────────────────────────
	rows := make([]StockStatementRow, 0, len(items))
	for _, item := range items {
		inward  := inMap[item.ProductID]
		outward := outMap[item.ProductID]
		// opening = closing - inward + outward (backward calculation from current state)
		opening := item.ClosingQty.Sub(inward).Add(outward)
		value   := item.ClosingQty.Mul(item.AvgCost)

		rows = append(rows, StockStatementRow{
			ProductID:    item.ProductID,
			ProductName:  item.ProductName,
			Category:     item.Category,
			UOM:          item.UOM,
			OpeningQty:   opening,
			InwardQty:    inward,
			OutwardQty:   outward,
			ClosingQty:   item.ClosingQty,
			AvgCost:      item.AvgCost,
			ClosingValue: value,
			ReorderLevel: item.ReorderLevel,
			IsLow:        item.ReorderLevel > 0 && item.ClosingQty.LessThanOrEqual(decimal.NewFromInt(int64(item.ReorderLevel))),
		})
	}
	return rows, nil
}
