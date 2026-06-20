package service

import (
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type SiteReportService struct {
	db *gorm.DB
}

func NewSiteReportService(db *gorm.DB) *SiteReportService {
	return &SiteReportService{db: db}
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type WorkPackageSummary struct {
	Inhouse       int `json:"inhouse"`
	Subcontracted int `json:"subcontracted"`
	Planned       int `json:"planned"`
	InProgress    int `json:"inProgress"`
	Completed     int `json:"completed"`
	OnHold        int `json:"onHold"`
}

type DashboardSummary struct {
	WorkPackages  WorkPackageSummary `json:"workPackages"`
	TotalWOs      int                `json:"totalWOs"`
	ContractedWOs decimal.Decimal    `json:"contractedWOs"`
	TotalBilled   decimal.Decimal    `json:"totalBilled"`
	TotalPaid     decimal.Decimal    `json:"totalPaid"`
	PendingClaims int                `json:"pendingClaims"`
	TotalManpower int                `json:"totalManpower"`
	TotalWages    decimal.Decimal    `json:"totalWages"`
	TotalReceipts int                `json:"totalReceipts"`
	LowStockCount int                `json:"lowStockCount"`
}

func (s *SiteReportService) GetDashboard(projectID int) (*DashboardSummary, error) {
	d := &DashboardSummary{}

	// Work packages
	type wpRow struct {
		ExecutionType string
		Status        string
		Count         int
	}
	var wpRows []wpRow
	s.db.Raw(`SELECT execution_type, status, COUNT(*) as count FROM work_packages WHERE site_project_id = ? GROUP BY execution_type, status`, projectID).Scan(&wpRows)
	for _, r := range wpRows {
		if r.ExecutionType == "INHOUSE" {
			d.WorkPackages.Inhouse += r.Count
		} else {
			d.WorkPackages.Subcontracted += r.Count
		}
		switch r.Status {
		case "PLANNED":
			d.WorkPackages.Planned += r.Count
		case "IN_PROGRESS":
			d.WorkPackages.InProgress += r.Count
		case "COMPLETED":
			d.WorkPackages.Completed += r.Count
		case "ON_HOLD":
			d.WorkPackages.OnHold += r.Count
		}
	}

	// Work orders
	var woCount int64
	s.db.Raw(`SELECT COUNT(*) FROM work_orders WHERE site_project_id = ?`, projectID).Scan(&woCount)
	d.TotalWOs = int(woCount)

	// Contracted value (sum of work order items for this project's WOs)
	s.db.Raw(`SELECT COALESCE(SUM(woi.amount),0) FROM work_order_items woi JOIN work_orders wo ON woi.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&d.ContractedWOs)

	// Billed (sum of work bill items for this project's WOs)
	s.db.Raw(`SELECT COALESCE(SUM(wbi.amount),0) FROM work_bill_items wbi JOIN work_bills wb ON wbi.work_bill_id = wb.id JOIN work_orders wo ON wb.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&d.TotalBilled)

	// Paid (sum of payments for this project's WOs)
	s.db.Raw(`SELECT COALESCE(SUM(wbp.amount),0) FROM work_bill_payments wbp JOIN work_bills wb ON wbp.work_bill_id = wb.id JOIN work_orders wo ON wb.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&d.TotalPaid)

	// Pending progress claims
	var pcCount int64
	s.db.Raw(`SELECT COUNT(*) FROM progress_claims pc JOIN work_orders wo ON pc.work_order_id = wo.id WHERE wo.site_project_id = ? AND pc.status = 'PENDING'`, projectID).Scan(&pcCount)
	d.PendingClaims = int(pcCount)

	// Labour
	type labourAgg struct {
		TotalManpower int
		TotalWages    decimal.Decimal
	}
	var la labourAgg
	s.db.Raw(`SELECT COALESCE(SUM(count),0) as total_manpower, COALESCE(SUM(total_wages),0) as total_wages FROM labour_attendance WHERE site_project_id = ?`, projectID).Scan(&la)
	d.TotalManpower = la.TotalManpower
	d.TotalWages = la.TotalWages

	// Material receipts count
	var receiptCount int64
	s.db.Raw(`SELECT COUNT(*) FROM material_receipts WHERE site_project_id = ?`, projectID).Scan(&receiptCount)
	d.TotalReceipts = int(receiptCount)

	// Low stock: materials where received - issued <= 0
	// Reuse stock register logic (simplified: count entries with balance <= 0)
	type balanceRow struct {
		MaterialName string
		Balance      decimal.Decimal
	}
	var balances []balanceRow
	s.db.Raw(`
		SELECT r.material_name,
			COALESCE(r.received,0) - COALESCE(i.issued,0) as balance
		FROM (
			SELECT material_name, SUM(qty) as received FROM material_receipts WHERE site_project_id = ? GROUP BY material_name
		) r
		LEFT JOIN (
			SELECT material_name, SUM(qty) as issued FROM material_issues WHERE site_project_id = ? GROUP BY material_name
		) i ON r.material_name = i.material_name
	`, projectID, projectID).Scan(&balances)
	for _, b := range balances {
		if b.Balance.LessThanOrEqual(decimal.Zero) {
			d.LowStockCount++
		}
	}

	return d, nil
}

// ─── Financial Summary ────────────────────────────────────────────────────────

type ContractorFinance struct {
	ContractorName  string          `json:"contractorName"`
	ContractorID    int             `json:"contractorId"`
	WOCount         int             `json:"woCount"`
	ContractedValue decimal.Decimal `json:"contractedValue"`
	Billed          decimal.Decimal `json:"billed"`
	Paid            decimal.Decimal `json:"paid"`
	Outstanding     decimal.Decimal `json:"outstanding"`
}

type FinancialSummary struct {
	ContractValue decimal.Decimal     `json:"contractValue"` // from site_project
	ContractedWOs decimal.Decimal     `json:"contractedWOs"`
	TotalBilled   decimal.Decimal     `json:"totalBilled"`
	TotalPaid     decimal.Decimal     `json:"totalPaid"`
	Outstanding   decimal.Decimal     `json:"outstanding"`
	LabourCost    decimal.Decimal     `json:"labourCost"`
	ByContractor  []ContractorFinance `json:"byContractor"`
}

func (s *SiteReportService) GetFinancialSummary(projectID int) (*FinancialSummary, error) {
	f := &FinancialSummary{}

	// Contract value from site_project
	s.db.Raw(`SELECT COALESCE(contract_value,0) FROM site_projects WHERE id = ?`, projectID).Scan(&f.ContractValue)

	// Contracted WOs
	s.db.Raw(`SELECT COALESCE(SUM(woi.amount),0) FROM work_order_items woi JOIN work_orders wo ON woi.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&f.ContractedWOs)

	// Billed
	s.db.Raw(`SELECT COALESCE(SUM(wbi.amount),0) FROM work_bill_items wbi JOIN work_bills wb ON wbi.work_bill_id = wb.id JOIN work_orders wo ON wb.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&f.TotalBilled)

	// Paid
	s.db.Raw(`SELECT COALESCE(SUM(wbp.amount),0) FROM work_bill_payments wbp JOIN work_bills wb ON wbp.work_bill_id = wb.id JOIN work_orders wo ON wb.work_order_id = wo.id WHERE wo.site_project_id = ?`, projectID).Scan(&f.TotalPaid)

	f.Outstanding = f.TotalBilled.Sub(f.TotalPaid)

	// Labour cost
	s.db.Raw(`SELECT COALESCE(SUM(total_wages),0) FROM labour_attendance WHERE site_project_id = ?`, projectID).Scan(&f.LabourCost)

	// By contractor
	type contractorRow struct {
		ContractorName  string
		ContractorID    int
		WOCount         int
		ContractedValue decimal.Decimal
	}
	var cRows []contractorRow
	s.db.Raw(`
		SELECT wo.contractor_name, wo.contractor_id, COUNT(wo.id) as wo_count,
			COALESCE(SUM(woi.amount),0) as contracted_value
		FROM work_orders wo
		LEFT JOIN work_order_items woi ON woi.work_order_id = wo.id
		WHERE wo.site_project_id = ?
		GROUP BY wo.contractor_id, wo.contractor_name
	`, projectID).Scan(&cRows)

	for _, cr := range cRows {
		var billed, paid decimal.Decimal
		s.db.Raw(`SELECT COALESCE(SUM(wbi.amount),0) FROM work_bill_items wbi JOIN work_bills wb ON wbi.work_bill_id = wb.id WHERE wb.work_order_id IN (SELECT id FROM work_orders WHERE contractor_id = ? AND site_project_id = ?)`, cr.ContractorID, projectID).Scan(&billed)
		s.db.Raw(`SELECT COALESCE(SUM(wbp.amount),0) FROM work_bill_payments wbp JOIN work_bills wb ON wbp.work_bill_id = wb.id WHERE wb.work_order_id IN (SELECT id FROM work_orders WHERE contractor_id = ? AND site_project_id = ?)`, cr.ContractorID, projectID).Scan(&paid)
		f.ByContractor = append(f.ByContractor, ContractorFinance{
			ContractorName:  cr.ContractorName,
			ContractorID:    cr.ContractorID,
			WOCount:         cr.WOCount,
			ContractedValue: cr.ContractedValue,
			Billed:          billed,
			Paid:            paid,
			Outstanding:     billed.Sub(paid),
		})
	}

	return f, nil
}

// ─── Progress Report ──────────────────────────────────────────────────────────

type PhaseProgress struct {
	Phase           string          `json:"phase"`
	ExecutionType   string          `json:"executionType"`
	Description     string          `json:"description"`
	Unit            string          `json:"unit"`
	PlannedQty      decimal.Decimal `json:"plannedQty"`
	CompletedQty    decimal.Decimal `json:"completedQty"`
	PercentComplete float64         `json:"percentComplete"`
	Status          string          `json:"status"`
}

type DailyTrend struct {
	Date         string          `json:"date"`
	QtyCompleted decimal.Decimal `json:"qtyCompleted"`
}

type LabourCategoryBreakdown struct {
	Category      string          `json:"category"`
	TotalCount    int             `json:"totalCount"`
	TotalWages    decimal.Decimal `json:"totalWages"`
}

type ProgressReport struct {
	Packages       []PhaseProgress           `json:"packages"`
	DailyTrend     []DailyTrend              `json:"dailyTrend"`
	LabourBreakdown []LabourCategoryBreakdown `json:"labourBreakdown"`
	TotalInhouse   int                        `json:"totalInhouse"`
	TotalSub       int                        `json:"totalSub"`
	CompletedCount int                        `json:"completedCount"`
}

func (s *SiteReportService) GetProgressReport(projectID int) (*ProgressReport, error) {
	r := &ProgressReport{}

	// Work packages with cumulative daily progress for inhouse
	type wpRow struct {
		ID            int
		Phase         string
		ExecutionType string
		Description   string
		Unit          string
		PlannedQty    decimal.Decimal
		Status        string
	}
	var packages []wpRow
	s.db.Raw(`SELECT id, phase, execution_type, description, unit, planned_qty, status FROM work_packages WHERE site_project_id = ? ORDER BY phase, execution_type`, projectID).Scan(&packages)

	for _, pkg := range packages {
		var completed decimal.Decimal
		if pkg.ExecutionType == "INHOUSE" {
			s.db.Raw(`SELECT COALESCE(SUM(qty_completed),0) FROM daily_progress WHERE work_package_id = ?`, pkg.ID).Scan(&completed)
		}
		var pct float64
		if pkg.PlannedQty.GreaterThan(decimal.Zero) {
			pct, _ = completed.Div(pkg.PlannedQty).Mul(decimal.NewFromInt(100)).Float64()
			if pct > 100 {
				pct = 100
			}
		}
		if pkg.Status == "COMPLETED" {
			pct = 100
		}

		r.Packages = append(r.Packages, PhaseProgress{
			Phase:           pkg.Phase,
			ExecutionType:   pkg.ExecutionType,
			Description:     pkg.Description,
			Unit:            pkg.Unit,
			PlannedQty:      pkg.PlannedQty,
			CompletedQty:    completed,
			PercentComplete: pct,
			Status:          pkg.Status,
		})

		if pkg.ExecutionType == "INHOUSE" {
			r.TotalInhouse++
		} else {
			r.TotalSub++
		}
		if pkg.Status == "COMPLETED" {
			r.CompletedCount++
		}
	}

	// Daily trend — last 30 days
	var trends []DailyTrend
	s.db.Raw(`SELECT date, SUM(qty_completed) as qty_completed FROM daily_progress WHERE site_project_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY date ORDER BY date`, projectID).Scan(&trends)
	r.DailyTrend = trends

	// Labour breakdown by category
	var labourBreakdown []LabourCategoryBreakdown
	s.db.Raw(`SELECT category, SUM(count) as total_count, SUM(total_wages) as total_wages FROM labour_attendance WHERE site_project_id = ? GROUP BY category ORDER BY category`, projectID).Scan(&labourBreakdown)
	r.LabourBreakdown = labourBreakdown

	return r, nil
}
