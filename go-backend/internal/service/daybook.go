package service

import (
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type DayBookEntry struct {
	Date        string          `json:"date"`
	CreatedAt   time.Time       `json:"createdAt"`
	VoucherType string          `json:"voucherType"`
	VoucherNo   string          `json:"voucherNo"`
	Party       string          `json:"party"`
	Narration   string          `json:"narration"`
	Debit       decimal.Decimal `json:"debit"`
	Credit      decimal.Decimal `json:"credit"`
	Status      string          `json:"status"`
	RefID       int             `json:"refId"`
}

type DayBookService struct {
	db *gorm.DB
}

func NewDayBookService(db *gorm.DB) *DayBookService {
	return &DayBookService{db: db}
}

func (s *DayBookService) GetEntries(outletId int, from, to time.Time) ([]DayBookEntry, error) {
	toEnd := to.Add(24*time.Hour - time.Second)

	query := `
SELECT voucher_type, voucher_no, party, narration,
       debit, credit, status, ref_id, created_at,
       DATE(created_at) AS date
FROM (

  -- Sales Invoices: Dr Debtor, Cr Sales
  SELECT 'INVOICE' AS voucher_type,
         i.invoice_number AS voucher_no,
         COALESCE(c.name, 'Walk-in') AS party,
         CONCAT('Invoice — ', COALESCE(c.name, 'Walk-in')) AS narration,
         i.total_amount AS debit,
         CAST(0 AS DECIMAL(12,2)) AS credit,
         i.status AS status,
         i.id AS ref_id,
         i.created_at
  FROM invoices i
  LEFT JOIN customers c ON c.id = i.customer_id
  WHERE i.outlet_id = ? AND i.created_at BETWEEN ? AND ?

  UNION ALL

  -- Payments Received: Dr Cash/Bank, Cr Debtor
  SELECT 'PAYMENT_RECEIVED',
         CONCAT('PMT-', p.id),
         COALESCE(c.name, 'Walk-in'),
         CONCAT(p.payment_method, ' payment received for ', o.order_number),
         CAST(0 AS DECIMAL(12,2)),
         p.amount,
         p.status,
         p.id,
         p.created_at
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  LEFT JOIN customers c ON c.id = o.customer_id
  WHERE o.outlet_id = ? AND p.created_at BETWEEN ? AND ?

  UNION ALL

  -- Purchase Bills: Dr Purchase, Cr Creditor
  SELECT 'PURCHASE_BILL',
         pb.bill_number,
         s.name,
         CONCAT('Bill from ', s.name),
         CAST(0 AS DECIMAL(12,2)),
         pb.total_amount,
         pb.status,
         pb.id,
         pb.created_at
  FROM purchase_bills pb
  JOIN suppliers s ON s.id = pb.supplier_id
  WHERE pb.outlet_id = ? AND pb.created_at BETWEEN ? AND ?

  UNION ALL

  -- Vendor Payments: Dr Creditor, Cr Cash/Bank
  SELECT 'VENDOR_PAYMENT',
         CASE WHEN vp.reference_number != '' THEN vp.reference_number ELSE CONCAT('VP-', vp.id) END,
         s.name,
         CONCAT(vp.payment_method, ' payment to ', s.name),
         CAST(0 AS DECIMAL(12,2)),
         vp.amount,
         'COMPLETED',
         vp.id,
         vp.created_at
  FROM vendor_payments vp
  JOIN suppliers s ON s.id = vp.supplier_id
  WHERE vp.outlet_id = ? AND vp.created_at BETWEEN ? AND ?

  UNION ALL

  -- Expenses: Dr Expense, Cr Cash/Bank
  SELECT 'EXPENSE',
         COALESCE(e.reference_number, CONCAT('EXP-', e.id)),
         COALESCE(e.vendor, ec.name, 'General'),
         CONCAT(ec.name, COALESCE(CONCAT(' — ', e.notes), '')),
         CAST(0 AS DECIMAL(12,2)),
         e.total_amount,
         e.status,
         e.id,
         e.created_at
  FROM expenses e
  LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
  WHERE e.outlet_id = ? AND e.created_at BETWEEN ? AND ?

  UNION ALL

  -- Credit Notes: Dr Sales Returns, Cr Debtor
  SELECT 'CREDIT_NOTE',
         cn.credit_note_number,
         c.name,
         CONCAT('Credit note issued to ', c.name),
         CAST(0 AS DECIMAL(12,2)),
         cn.total_amount,
         cn.status,
         cn.id,
         cn.created_at
  FROM credit_notes cn
  JOIN customers c ON c.id = cn.customer_id
  WHERE cn.outlet_id = ? AND cn.created_at BETWEEN ? AND ?

  UNION ALL

  -- Sale Returns: Dr Sales Returns, Cr Debtor
  SELECT 'SALE_RETURN',
         sr.return_number,
         COALESCE(sr.customer_name, 'Walk-in'),
         CONCAT('Sale return — ', COALESCE(sr.reason, 'N/A')),
         CAST(0 AS DECIMAL(12,2)),
         sr.total_amount,
         'COMPLETED',
         sr.id,
         sr.created_at
  FROM sale_returns sr
  WHERE sr.outlet_id = ? AND sr.created_at BETWEEN ? AND ?

  UNION ALL

  -- Purchase Returns: Dr Creditor, Cr Purchase Returns
  SELECT 'PURCHASE_RETURN',
         pr.return_number,
         s.name,
         CONCAT('Purchase return to ', s.name),
         pr.total_amount,
         CAST(0 AS DECIMAL(12,2)),
         'COMPLETED',
         pr.id,
         pr.created_at
  FROM purchase_returns pr
  JOIN purchase_orders po ON po.id = pr.purchase_order_id
  JOIN suppliers s ON s.id = po.supplier_id
  WHERE pr.outlet_id = ? AND pr.created_at BETWEEN ? AND ?

  UNION ALL

  -- Vendor Credits: Dr Creditor, Cr Purchase Returns
  SELECT 'VENDOR_CREDIT',
         vc.reference_number,
         s.name,
         CONCAT('Vendor credit from ', s.name),
         vc.amount,
         CAST(0 AS DECIMAL(12,2)),
         vc.status,
         vc.id,
         vc.created_at
  FROM vendor_credits vc
  JOIN suppliers s ON s.id = vc.supplier_id
  WHERE vc.outlet_id = ? AND vc.created_at BETWEEN ? AND ?

) t
ORDER BY created_at DESC, ref_id DESC
`

	args := []interface{}{
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
		outletId, from, toEnd,
	}

	type row struct {
		VoucherType string          `gorm:"column:voucher_type"`
		VoucherNo   string          `gorm:"column:voucher_no"`
		Party       string          `gorm:"column:party"`
		Narration   string          `gorm:"column:narration"`
		Debit       decimal.Decimal `gorm:"column:debit"`
		Credit      decimal.Decimal `gorm:"column:credit"`
		Status      string          `gorm:"column:status"`
		RefID       int             `gorm:"column:ref_id"`
		CreatedAt   time.Time       `gorm:"column:created_at"`
		Date        string          `gorm:"column:date"`
	}

	var rows []row
	if err := s.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}

	entries := make([]DayBookEntry, 0, len(rows))
	for _, r := range rows {
		entries = append(entries, DayBookEntry{
			Date:        r.Date,
			CreatedAt:   r.CreatedAt,
			VoucherType: r.VoucherType,
			VoucherNo:   r.VoucherNo,
			Party:       r.Party,
			Narration:   r.Narration,
			Debit:       r.Debit,
			Credit:      r.Credit,
			Status:      r.Status,
			RefID:       r.RefID,
		})
	}
	return entries, nil
}
