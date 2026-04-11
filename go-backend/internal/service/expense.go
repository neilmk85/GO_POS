package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ExpenseService struct {
	db *gorm.DB
}

func NewExpenseService(db *gorm.DB) *ExpenseService {
	return &ExpenseService{db: db}
}

// ─── Expense Requests & Responses ──────────────────────────────────────────

type ExpenseRequest struct {
	OutletID         int             `json:"outletId"`
	CategoryID       int             `json:"categoryId"`
	Amount           decimal.Decimal `json:"amount"`
	GSTRate          *decimal.Decimal `json:"gstRate"`
	GSTAmount        *decimal.Decimal `json:"gstAmount"`
	CGSTAmount       *decimal.Decimal `json:"cgstAmount"`
	SGSTAmount       *decimal.Decimal `json:"sgstAmount"`
	IGSTAmount       *decimal.Decimal `json:"igstAmount"`
	SupplyType       *string         `json:"supplyType"`
	VendorGSTIN      *string         `json:"vendorGstin"`
	ITCEligible      *bool           `json:"itcEligible"`
	ExpenseDate      time.Time       `json:"expenseDate"`
	Vendor           *string         `json:"vendor"`
	PaymentMode      *string         `json:"paymentMode"`
	ReferenceNumber  *string         `json:"referenceNumber"`
	Notes            *string         `json:"notes"`
	SubmittedBy      *string         `json:"submittedBy"`
	Recurring        *bool           `json:"recurring"`
	RecurrenceInterval *string       `json:"recurrenceInterval"`
	RecurrenceDay    *int            `json:"recurrenceDay"`
}

type ExpenseResponse struct {
	ID               int             `json:"id"`
	OutletID         int             `json:"outletId"`
	CategoryID       int             `json:"categoryId"`
	Amount           decimal.Decimal `json:"amount"`
	GSTAmount        decimal.Decimal `json:"gstAmount"`
	TotalAmount      decimal.Decimal `json:"totalAmount"`
	GSTRate          *decimal.Decimal `json:"gstRate"`
	CGSTAmount       decimal.Decimal `json:"cgstAmount"`
	SGSTAmount       decimal.Decimal `json:"sgstAmount"`
	IGSTAmount       decimal.Decimal `json:"igstAmount"`
	SupplyType       string          `json:"supplyType"`
	VendorGSTIN      *string         `json:"vendorGstin"`
	ITCEligible      bool            `json:"itcEligible"`
	ExpenseDate      time.Time       `json:"expenseDate"`
	Vendor           *string         `json:"vendor"`
	PaymentMode      string          `json:"paymentMode"`
	ReferenceNumber  *string         `json:"referenceNumber"`
	Notes            *string         `json:"notes"`
	SubmittedBy      *string         `json:"submittedBy"`
	Status           string          `json:"status"`
	Recurring        bool            `json:"recurring"`
	RecurrenceInterval *string       `json:"recurrenceInterval"`
	RecurrenceDay    *int            `json:"recurrenceDay"`
	NextRecurrenceDate *time.Time    `json:"nextRecurrenceDate"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
	ExpenseCategory  *models.ExpenseCategory `json:"expenseCategory"`
}

type ExpenseSearchResponse struct {
	Content       []ExpenseResponse `json:"content"`
	TotalElements int64             `json:"totalElements"`
	Page          int               `json:"page"`
	Size          int               `json:"size"`
}

type ExpenseStatsResponse struct {
	TodayTotal    decimal.Decimal `json:"todayTotal"`
	TodayCount    int             `json:"todayCount"`
	MonthTotal    decimal.Decimal `json:"monthTotal"`
	MonthCount    int             `json:"monthCount"`
	AllTimeTotal  decimal.Decimal `json:"allTimeTotal"`
	AllTimeCount  int             `json:"allTimeCount"`
	ITCTotal      decimal.Decimal `json:"itcTotal"`
	ITCCgst       decimal.Decimal `json:"itcCgst"`
	ITCSgst       decimal.Decimal `json:"itcSgst"`
	ITCIgst       decimal.Decimal `json:"itcIgst"`
	ByCategory    []CategoryStat  `json:"byCategory"`
	ByPaymentMode []PaymentModeStat `json:"byPaymentMode"`
	BudgetUsage   []BudgetUsage   `json:"budgetUsage"`
	CategoryCount int             `json:"categoryCount"`
}

type CategoryStat struct {
	CategoryID   int             `json:"categoryId"`
	Name         string          `json:"name"`
	Color        string          `json:"color"`
	Icon         string          `json:"icon"`
	Total        float64         `json:"total"`
	Count        int             `json:"count"`
}

type PaymentModeStat struct {
	Mode  string  `json:"mode"`
	Total float64 `json:"total"`
	Count int     `json:"count"`
}

type BudgetUsage struct {
	CategoryID   int     `json:"categoryId"`
	CategoryName string  `json:"categoryName"`
	Budget       float64 `json:"budget"`
	Spent        float64 `json:"spent"`
}

// ─── Helper functions ─────────────────────────────────────────────────────

func computeNextRecurrence(interval string, day *int) *time.Time {
	now := time.Now()

	if interval == "WEEKLY" {
		d := now
		dayOfWeek := 1 // Monday
		if day != nil {
			dayOfWeek = *day
		}
		currentDay := int(d.Weekday())
		if currentDay == 0 {
			currentDay = 7
		}
		diff := (dayOfWeek - currentDay + 7) % 7
		if diff == 0 {
			diff = 7
		}
		d = d.AddDate(0, 0, diff)
		return &d
	} else if interval == "MONTHLY" {
		d := now
		targetDay := 1
		if day != nil {
			targetDay = *day
		}
		d = d.AddDate(0, 1, 1-d.Day())
		maxDay := time.Date(d.Year(), d.Month()+1, 0, 0, 0, 0, 0, d.Location()).Day()
		if targetDay > maxDay {
			targetDay = maxDay
		}
		d = d.AddDate(0, 0, targetDay-1)
		return &d
	}

	return nil
}

func toExpenseResponse(e *models.Expense) ExpenseResponse {
	return ExpenseResponse{
		ID:                 e.ID,
		OutletID:           e.OutletID,
		CategoryID:         e.ExpenseCategoryID,
		Amount:             e.Amount,
		GSTAmount:          e.GSTAmount,
		TotalAmount:        e.TotalAmount,
		GSTRate:            e.GSTRate,
		CGSTAmount:         e.CGSTAmount,
		SGSTAmount:         e.SGSTAmount,
		IGSTAmount:         e.IGSTAmount,
		SupplyType:         string(e.SupplyType),
		VendorGSTIN:        e.VendorGSTIN,
		ITCEligible:        e.ITCEligible,
		ExpenseDate:        e.ExpenseDate,
		Vendor:             e.Vendor,
		PaymentMode:        string(e.PaymentMode),
		ReferenceNumber:    e.ReferenceNumber,
		Notes:              e.Notes,
		SubmittedBy:        e.SubmittedBy,
		Status:             string(e.Status),
		Recurring:          e.Recurring,
		RecurrenceInterval: (*string)(e.RecurrenceInterval),
		RecurrenceDay:      e.RecurrenceDay,
		NextRecurrenceDate: e.NextRecurrenceDate,
		CreatedAt:          e.CreatedAt,
		UpdatedAt:          e.UpdatedAt,
		ExpenseCategory:    e.ExpenseCategory,
	}
}

// ─── Expense Operations ────────────────────────────────────────────────────

func (es *ExpenseService) Create(req ExpenseRequest) (ExpenseResponse, error) {
	var gstAmount, cgstAmount, sgstAmount, igstAmount decimal.Decimal
	if req.GSTAmount != nil {
		gstAmount = *req.GSTAmount
	}
	if req.CGSTAmount != nil {
		cgstAmount = *req.CGSTAmount
	}
	if req.SGSTAmount != nil {
		sgstAmount = *req.SGSTAmount
	}
	if req.IGSTAmount != nil {
		igstAmount = *req.IGSTAmount
	}

	totalAmount := req.Amount.Add(gstAmount)

	supplyType := "INTRA_STATE"
	if req.SupplyType != nil {
		supplyType = *req.SupplyType
	}

	paymentMode := "CASH"
	if req.PaymentMode != nil {
		paymentMode = *req.PaymentMode
	}

	itcEligible := false
	if req.ITCEligible != nil {
		itcEligible = *req.ITCEligible
	}

	recurring := false
	if req.Recurring != nil {
		recurring = *req.Recurring
	}

	nextDate := (*time.Time)(nil)
	if recurring && req.RecurrenceInterval != nil {
		nextDate = computeNextRecurrence(*req.RecurrenceInterval, req.RecurrenceDay)
	}

	expense := &models.Expense{
		OutletID:          req.OutletID,
		ExpenseCategoryID: req.CategoryID,
		Amount:            req.Amount,
		GSTAmount:         gstAmount,
		CGSTAmount:        cgstAmount,
		SGSTAmount:        sgstAmount,
		IGSTAmount:        igstAmount,
		GSTRate:           req.GSTRate,
		TotalAmount:       totalAmount,
		SupplyType:        models.SupplyType(supplyType),
		VendorGSTIN:       req.VendorGSTIN,
		ITCEligible:       itcEligible,
		ExpenseDate:       req.ExpenseDate,
		Vendor:            req.Vendor,
		PaymentMode:       models.ExpensePaymentMode(paymentMode),
		ReferenceNumber:   req.ReferenceNumber,
		Notes:             req.Notes,
		SubmittedBy:       req.SubmittedBy,
		Status:            "PENDING",
		Recurring:         recurring,
		RecurrenceInterval: (*models.RecurrenceInterval)(req.RecurrenceInterval),
		RecurrenceDay:     req.RecurrenceDay,
		NextRecurrenceDate: nextDate,
	}

	if err := es.db.Create(expense).Error; err != nil {
		return ExpenseResponse{}, err
	}

	if err := es.db.Preload("ExpenseCategory").First(expense, expense.ID).Error; err != nil {
		return ExpenseResponse{}, err
	}

	return toExpenseResponse(expense), nil
}

func (es *ExpenseService) Update(id int, req ExpenseRequest) (ExpenseResponse, error) {
	expense := &models.Expense{}
	if err := es.db.First(expense, id).Error; err != nil {
		return ExpenseResponse{}, err
	}

	var gstAmount, cgstAmount, sgstAmount, igstAmount decimal.Decimal
	if req.GSTAmount != nil {
		gstAmount = *req.GSTAmount
	}
	if req.CGSTAmount != nil {
		cgstAmount = *req.CGSTAmount
	}
	if req.SGSTAmount != nil {
		sgstAmount = *req.SGSTAmount
	}
	if req.IGSTAmount != nil {
		igstAmount = *req.IGSTAmount
	}

	totalAmount := req.Amount.Add(gstAmount)

	updates := map[string]interface{}{
		"outlet_id":           req.OutletID,
		"expense_category_id": req.CategoryID,
		"amount":              req.Amount,
		"gst_amount":          gstAmount,
		"cgst_amount":         cgstAmount,
		"sgst_amount":         sgstAmount,
		"igst_amount":         igstAmount,
		"gst_rate":            req.GSTRate,
		"total_amount":        totalAmount,
		"supply_type":         req.SupplyType,
		"vendor_gstin":        req.VendorGSTIN,
		"itc_eligible":        req.ITCEligible,
		"expense_date":        req.ExpenseDate,
		"vendor":              req.Vendor,
		"payment_mode":        req.PaymentMode,
		"reference_number":    req.ReferenceNumber,
		"notes":               req.Notes,
		"submitted_by":        req.SubmittedBy,
		"recurring":           req.Recurring,
		"recurrence_interval": req.RecurrenceInterval,
		"recurrence_day":      req.RecurrenceDay,
	}

	if err := es.db.Model(expense).Updates(updates).Error; err != nil {
		return ExpenseResponse{}, err
	}

	if err := es.db.Preload("ExpenseCategory").First(expense, id).Error; err != nil {
		return ExpenseResponse{}, err
	}

	return toExpenseResponse(expense), nil
}

func (es *ExpenseService) GetAll(outletId int, categoryId *int, status *string, from, to *time.Time, page, size int) (ExpenseSearchResponse, error) {
	var expenses []models.Expense
	query := es.db

	query = query.Where("outlet_id = ?", outletId)

	if categoryId != nil {
		query = query.Where("expense_category_id = ?", *categoryId)
	}

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if from != nil || to != nil {
		if from != nil && to != nil {
			query = query.Where("expense_date >= ? AND expense_date <= ?", *from, *to)
		} else if from != nil {
			query = query.Where("expense_date >= ?", *from)
		} else if to != nil {
			query = query.Where("expense_date <= ?", *to)
		}
	}

	var total int64
	if err := query.Model(&models.Expense{}).Count(&total).Error; err != nil {
		return ExpenseSearchResponse{}, err
	}

	if err := query.Preload("ExpenseCategory").
		Order("expense_date DESC").
		Offset(page * size).
		Limit(size).
		Find(&expenses).Error; err != nil {
		return ExpenseSearchResponse{}, err
	}

	responses := make([]ExpenseResponse, len(expenses))
	for i, e := range expenses {
		responses[i] = toExpenseResponse(&e)
	}

	return ExpenseSearchResponse{
		Content:       responses,
		TotalElements: total,
		Page:          page,
		Size:          size,
	}, nil
}

func (es *ExpenseService) GetStats(outletId int, from, to *time.Time) (ExpenseStatsResponse, error) {
	var res ExpenseStatsResponse

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location())
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.Add(24*time.Hour - time.Second)

	var allExpenses, monthExpenses, todayExpenses []models.Expense
	var categories []models.ExpenseCategory

	// Get expenses for range or all-time
	query := es.db.Where("outlet_id = ?", outletId)
	if from != nil || to != nil {
		if from != nil && to != nil {
			query = query.Where("expense_date >= ? AND expense_date <= ?", *from, *to)
		} else if from != nil {
			query = query.Where("expense_date >= ?", *from)
		} else if to != nil {
			query = query.Where("expense_date <= ?", *to)
		}
	}
	query.Preload("ExpenseCategory").Find(&allExpenses)

	// Get this month's expenses
	es.db.Where("outlet_id = ? AND expense_date >= ? AND expense_date <= ?", outletId, startOfMonth, endOfMonth).
		Preload("ExpenseCategory").Find(&monthExpenses)

	// Get today's expenses
	es.db.Where("outlet_id = ? AND expense_date >= ? AND expense_date <= ?", outletId, todayStart, todayEnd).
		Find(&todayExpenses)

	// Get active categories
	es.db.Where("active = true").Find(&categories)

	sumHelper := func(expenses []models.Expense, key string) decimal.Decimal {
		sum := decimal.Zero
		for _, e := range expenses {
			if key == "totalAmount" {
				sum = sum.Add(e.TotalAmount)
			} else if key == "gstAmount" {
				sum = sum.Add(e.GSTAmount)
			} else if key == "cgstAmount" {
				sum = sum.Add(e.CGSTAmount)
			} else if key == "sgstAmount" {
				sum = sum.Add(e.SGSTAmount)
			} else if key == "igstAmount" {
				sum = sum.Add(e.IGSTAmount)
			}
		}
		return sum
	}

	res.TodayTotal = sumHelper(todayExpenses, "totalAmount")
	res.TodayCount = len(todayExpenses)
	res.MonthTotal = sumHelper(monthExpenses, "totalAmount")
	res.MonthCount = len(monthExpenses)
	res.AllTimeTotal = sumHelper(allExpenses, "totalAmount")
	res.AllTimeCount = len(allExpenses)

	// ITC calculations
	itcExpenses := make([]models.Expense, 0)
	for _, e := range allExpenses {
		if e.ITCEligible {
			itcExpenses = append(itcExpenses, e)
		}
	}

	res.ITCTotal = sumHelper(itcExpenses, "gstAmount")
	res.ITCCgst = sumHelper(itcExpenses, "cgstAmount")
	res.ITCSgst = sumHelper(itcExpenses, "sgstAmount")
	res.ITCIgst = sumHelper(itcExpenses, "igstAmount")

	// Category breakdown
	catMap := make(map[int]*CategoryStat)
	for _, e := range allExpenses {
		if e.ExpenseCategory == nil {
			continue
		}
		cat := e.ExpenseCategory
		if _, exists := catMap[cat.ID]; !exists {
			catMap[cat.ID] = &CategoryStat{
				CategoryID: cat.ID,
				Name:       cat.Name,
				Color:      cat.Color,
				Icon:       cat.Icon,
				Total:      0,
				Count:      0,
			}
		}
		catMap[cat.ID].Total += e.TotalAmount.InexactFloat64()
		catMap[cat.ID].Count++
	}

	res.ByCategory = make([]CategoryStat, 0, len(catMap))
	for _, cat := range catMap {
		res.ByCategory = append(res.ByCategory, *cat)
	}

	// Sort by total descending
	for i := 0; i < len(res.ByCategory)-1; i++ {
		for j := i + 1; j < len(res.ByCategory); j++ {
			if res.ByCategory[j].Total > res.ByCategory[i].Total {
				res.ByCategory[i], res.ByCategory[j] = res.ByCategory[j], res.ByCategory[i]
			}
		}
	}

	// Payment mode breakdown
	modeMap := make(map[string]*PaymentModeStat)
	for _, e := range allExpenses {
		mode := string(e.PaymentMode)
		if _, exists := modeMap[mode]; !exists {
			modeMap[mode] = &PaymentModeStat{
				Mode:  mode,
				Total: 0,
				Count: 0,
			}
		}
		modeMap[mode].Total += e.TotalAmount.InexactFloat64()
		modeMap[mode].Count++
	}

	res.ByPaymentMode = make([]PaymentModeStat, 0, len(modeMap))
	for _, mode := range modeMap {
		res.ByPaymentMode = append(res.ByPaymentMode, *mode)
	}

	// Sort by total descending
	for i := 0; i < len(res.ByPaymentMode)-1; i++ {
		for j := i + 1; j < len(res.ByPaymentMode); j++ {
			if res.ByPaymentMode[j].Total > res.ByPaymentMode[i].Total {
				res.ByPaymentMode[i], res.ByPaymentMode[j] = res.ByPaymentMode[j], res.ByPaymentMode[i]
			}
		}
	}

	// Budget usage
	monthCatSpend := make(map[int]float64)
	for _, e := range monthExpenses {
		if e.ExpenseCategoryID > 0 {
			monthCatSpend[e.ExpenseCategoryID] += e.TotalAmount.InexactFloat64()
		}
	}

	res.BudgetUsage = make([]BudgetUsage, 0)
	for _, cat := range categories {
		if cat.MonthlyBudget != nil && cat.MonthlyBudget.GreaterThan(decimal.Zero) {
			res.BudgetUsage = append(res.BudgetUsage, BudgetUsage{
				CategoryID:   cat.ID,
				CategoryName: cat.Name,
				Budget:       cat.MonthlyBudget.InexactFloat64(),
				Spent:        monthCatSpend[cat.ID],
			})
		}
	}

	res.CategoryCount = len(categories)

	return res, nil
}

func (es *ExpenseService) UpdateStatus(id int, status string) (ExpenseResponse, error) {
	expense := &models.Expense{}
	if err := es.db.Model(expense).Where("id = ?", id).Update("status", status).Error; err != nil {
		return ExpenseResponse{}, err
	}

	if err := es.db.Preload("ExpenseCategory").First(expense, id).Error; err != nil {
		return ExpenseResponse{}, err
	}

	return toExpenseResponse(expense), nil
}

func (es *ExpenseService) Delete(id int) error {
	return es.db.Delete(&models.Expense{}, id).Error
}

func (es *ExpenseService) ExportCSV(outletId int, from, to *time.Time) (string, error) {
	var expenses []models.Expense
	query := es.db.Where("outlet_id = ?", outletId)

	if from != nil && to != nil {
		query = query.Where("expense_date >= ? AND expense_date <= ?", *from, *to)
	}

	query.Preload("ExpenseCategory").Order("expense_date DESC").Find(&expenses)

	var sb strings.Builder
	sb.WriteString("Date,Category,Vendor,Payment Mode,Amount,GST Amount,Total Amount,Status\n")

	for _, e := range expenses {
		catName := ""
		if e.ExpenseCategory != nil {
			catName = e.ExpenseCategory.Name
		}

		vendor := ""
		if e.Vendor != nil {
			vendor = *e.Vendor
		}

		sb.WriteString(fmt.Sprintf("%s,\"%s\",\"%s\",%s,%s,%s,%s,%s\n",
			e.ExpenseDate.Format("2006-01-02"),
			catName,
			vendor,
			string(e.PaymentMode),
			e.Amount.String(),
			e.GSTAmount.String(),
			e.TotalAmount.String(),
			string(e.Status),
		))
	}

	return "\uFEFF" + sb.String(), nil
}

func (es *ExpenseService) GenerateRecurringExpenses() (int, error) {
	today := time.Now()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())

	var recurring []models.Expense
	if err := es.db.Where("is_recurring = true AND status != ? AND next_recurrence_date <= ?", "REJECTED", today).
		Preload("ExpenseCategory").Find(&recurring).Error; err != nil {
		return 0, err
	}

	count := 0
	for _, tmpl := range recurring {
		newExpense := &models.Expense{
			OutletID:          tmpl.OutletID,
			ExpenseCategoryID: tmpl.ExpenseCategoryID,
			Amount:            tmpl.Amount,
			GSTAmount:         tmpl.GSTAmount,
			CGSTAmount:        tmpl.CGSTAmount,
			SGSTAmount:        tmpl.SGSTAmount,
			IGSTAmount:        tmpl.IGSTAmount,
			GSTRate:           tmpl.GSTRate,
			TotalAmount:       tmpl.TotalAmount,
			SupplyType:        tmpl.SupplyType,
			VendorGSTIN:       tmpl.VendorGSTIN,
			ITCEligible:       tmpl.ITCEligible,
			ExpenseDate:       today,
			Vendor:            tmpl.Vendor,
			PaymentMode:       tmpl.PaymentMode,
			ReferenceNumber:   tmpl.ReferenceNumber,
			Notes:             tmpl.Notes,
			SubmittedBy:       tmpl.SubmittedBy,
			Status:            "PENDING",
			Recurring:         false,
			ParentExpenseID:   &tmpl.ID,
		}

		if err := es.db.Create(newExpense).Error; err != nil {
			continue
		}

		var riStr string
		if tmpl.RecurrenceInterval != nil {
			riStr = string(*tmpl.RecurrenceInterval)
		}
		nextDate := computeNextRecurrence(riStr, tmpl.RecurrenceDay)
		if err := es.db.Model(&tmpl).Update("next_recurrence_date", nextDate).Error; err != nil {
			continue
		}

		count++
	}

	return count, nil
}

// ─── Expense Categories ────────────────────────────────────────────────────

func (es *ExpenseService) GetAllCategories(active *bool) ([]models.ExpenseCategory, error) {
	var categories []models.ExpenseCategory
	query := es.db

	if active != nil {
		query = query.Where("active = ?", *active)
	}

	if err := query.Order("name ASC").Find(&categories).Error; err != nil {
		return nil, err
	}

	return categories, nil
}

func (es *ExpenseService) CreateCategory(data map[string]interface{}) (models.ExpenseCategory, error) {
	category := models.ExpenseCategory{}
	if err := es.db.Model(&category).Create(data).Error; err != nil {
		return category, err
	}
	return category, nil
}

func (es *ExpenseService) UpdateCategory(id int, data map[string]interface{}) (models.ExpenseCategory, error) {
	category := models.ExpenseCategory{}
	if err := es.db.Model(&category).Where("id = ?", id).Updates(data).Error; err != nil {
		return category, err
	}
	if err := es.db.First(&category, id).Error; err != nil {
		return category, err
	}
	return category, nil
}

func (es *ExpenseService) DeleteCategory(id int) error {
	return es.db.Delete(&models.ExpenseCategory{}, id).Error
}
