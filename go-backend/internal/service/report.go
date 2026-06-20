package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type ReportService struct {
	db *gorm.DB
}

func NewReportService(db *gorm.DB) *ReportService {
	return &ReportService{db: db}
}

// ─── Sales Reports ────────────────────────────────────────────────────────

type SalesSummaryResponse struct {
	TotalRevenue     decimal.Decimal `json:"totalRevenue"`
	TotalDiscount    decimal.Decimal `json:"totalDiscount"`
	TotalTax         decimal.Decimal `json:"totalTax"`
	GrossProfit      decimal.Decimal `json:"grossProfit"`
	TotalOrders      int             `json:"totalOrders"`
	AvgOrderValue    decimal.Decimal `json:"avgOrderValue"`
	CancelledOrders  int             `json:"cancelledOrders"`
	ReturnedOrders   int             `json:"returnedOrders"`
}

func (rs *ReportService) SalesSummary(outletId int, from, to time.Time) (SalesSummaryResponse, error) {
	var res SalesSummaryResponse

	// Get all orders in period
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Items").Find(&orders).Error; err != nil {
		return res, err
	}

	// Separate by status
	var completed, cancelled, refunded []models.Order
	for _, o := range orders {
		switch o.Status {
		case "COMPLETED":
			completed = append(completed, o)
		case "CANCELLED":
			cancelled = append(cancelled, o)
		case "REFUNDED":
			refunded = append(refunded, o)
		}
	}

	// Calculate totals from completed orders
	totalRevenue := decimal.Zero
	totalDiscount := decimal.Zero
	totalTax := decimal.Zero
	totalCost := decimal.Zero

	for _, order := range completed {
		totalRevenue = totalRevenue.Add(order.TotalAmount)
		totalDiscount = totalDiscount.Add(order.DiscountAmount)
		totalTax = totalTax.Add(order.TaxAmount)

		// Calculate cost from items
		for _, item := range order.Items {
			if item.CostPrice != nil {
				cost := item.CostPrice.Mul(item.Quantity)
				totalCost = totalCost.Add(cost)
			}
		}
	}

	res.TotalRevenue = totalRevenue
	res.TotalDiscount = totalDiscount
	res.TotalTax = totalTax
	res.GrossProfit = totalRevenue.Sub(totalCost)
	res.TotalOrders = len(completed)
	res.CancelledOrders = len(cancelled)
	res.ReturnedOrders = len(refunded)

	if res.TotalOrders > 0 {
		res.AvgOrderValue = totalRevenue.Div(decimal.NewFromInt(int64(res.TotalOrders))).Round(2)
	}

	return res, nil
}

type TopProduct struct {
	ProductID     int             `json:"productId"`
	ProductName   string          `json:"productName"`
	TotalQuantity decimal.Decimal `json:"totalQuantity"`
	TotalRevenue  decimal.Decimal `json:"totalRevenue"`
}

func (rs *ReportService) TopProducts(outletId int, from, to time.Time, limit int) ([]TopProduct, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items").Find(&orders).Error; err != nil {
		return nil, err
	}

	productMap := make(map[int]*TopProduct)
	for _, order := range orders {
		for _, item := range order.Items {
			key := item.ProductID
			if _, exists := productMap[key]; !exists {
				productMap[key] = &TopProduct{
					ProductID:     item.ProductID,
					ProductName:   item.ProductName,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
				}
			}
			productMap[key].TotalQuantity = productMap[key].TotalQuantity.Add(item.Quantity)
			productMap[key].TotalRevenue = productMap[key].TotalRevenue.Add(item.LineTotal)
		}
	}

	result := make([]TopProduct, 0, len(productMap))
	for _, p := range productMap {
		result = append(result, *p)
	}

	// Sort by revenue descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}

	return result, nil
}

type PaymentMethodBreakdown struct {
	Method string          `json:"method"`
	Amount decimal.Decimal `json:"amount"`
}

func (rs *ReportService) PaymentMethods(outletId int, from, to time.Time) ([]PaymentMethodBreakdown, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Payments").Find(&orders).Error; err != nil {
		return nil, err
	}

	breakdown := make(map[string]decimal.Decimal)
	for _, order := range orders {
		for _, payment := range order.Payments {
			breakdown[string(payment.PaymentMethod)] = breakdown[string(payment.PaymentMethod)].Add(payment.Amount)
		}
	}

	result := make([]PaymentMethodBreakdown, 0, len(breakdown))
	for method, amount := range breakdown {
		result = append(result, PaymentMethodBreakdown{method, amount})
	}

	return result, nil
}

type DailySalesTrend struct {
	Date    string          `json:"date"`
	Revenue decimal.Decimal `json:"revenue"`
}

func (rs *ReportService) DailyTrend(outletId int, from, to time.Time) ([]DailySalesTrend, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).Find(&orders).Error; err != nil {
		return nil, err
	}

	dailySales := make(map[string]decimal.Decimal)
	for _, order := range orders {
		date := order.CreatedAt.Format("2006-01-02")
		dailySales[date] = dailySales[date].Add(order.TotalAmount)
	}

	result := make([]DailySalesTrend, 0, len(dailySales))
	for date, revenue := range dailySales {
		result = append(result, DailySalesTrend{date, revenue})
	}

	// Sort by date
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Date < result[i].Date {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type CategorySalesReport struct {
	Category       string          `json:"category"`
	TotalQuantity  decimal.Decimal `json:"totalQuantity"`
	TotalRevenue   decimal.Decimal `json:"totalRevenue"`
	TotalDiscount  decimal.Decimal `json:"totalDiscount"`
}

func (rs *ReportService) SalesByCategory(outletId int, from, to time.Time) ([]CategorySalesReport, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items.Product.Category").Find(&orders).Error; err != nil {
		return nil, err
	}

	catMap := make(map[string]*CategorySalesReport)
	for _, order := range orders {
		for _, item := range order.Items {
			catName := "Uncategorised"
			if item.Product != nil && item.Product.Category != nil {
				catName = item.Product.Category.Name
			}

			if _, exists := catMap[catName]; !exists {
				catMap[catName] = &CategorySalesReport{
					Category:      catName,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
					TotalDiscount: decimal.Zero,
				}
			}
			catMap[catName].TotalQuantity = catMap[catName].TotalQuantity.Add(item.Quantity)
			catMap[catName].TotalRevenue = catMap[catName].TotalRevenue.Add(item.LineTotal)
			catMap[catName].TotalDiscount = catMap[catName].TotalDiscount.Add(item.DiscountAmount)
		}
	}

	result := make([]CategorySalesReport, 0, len(catMap))
	for _, cat := range catMap {
		result = append(result, *cat)
	}

	// Sort by revenue descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type ProductSalesReport struct {
	ProductID    int             `json:"productId"`
	ProductName  string          `json:"productName"`
	SKU          string          `json:"sku"`
	Category     string          `json:"category"`
	TotalQuantity decimal.Decimal `json:"totalQuantity"`
	TotalRevenue decimal.Decimal `json:"totalRevenue"`
	TotalDiscount decimal.Decimal `json:"totalDiscount"`
	TotalCost    decimal.Decimal `json:"totalCost"`
	TotalTax     decimal.Decimal `json:"totalTax"`
}

func (rs *ReportService) SalesByProduct(outletId int, from, to time.Time, page, size int) ([]ProductSalesReport, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items.Product.Category").Find(&orders).Error; err != nil {
		return nil, err
	}

	prodMap := make(map[int]*ProductSalesReport)
	for _, order := range orders {
		for _, item := range order.Items {
			key := item.ProductID
			if _, exists := prodMap[key]; !exists {
				catName := "Uncategorised"
				if item.Product != nil && item.Product.Category != nil {
					catName = item.Product.Category.Name
				}
				prodMap[key] = &ProductSalesReport{
					ProductID:     item.ProductID,
					ProductName:   item.ProductName,
					SKU:           derefStr(item.SKU),
					Category:      catName,
					TotalQuantity: decimal.Zero,
					TotalRevenue:  decimal.Zero,
					TotalDiscount: decimal.Zero,
					TotalCost:     decimal.Zero,
					TotalTax:      decimal.Zero,
				}
			}
			prodMap[key].TotalQuantity = prodMap[key].TotalQuantity.Add(item.Quantity)
			prodMap[key].TotalRevenue = prodMap[key].TotalRevenue.Add(item.LineTotal)
			prodMap[key].TotalDiscount = prodMap[key].TotalDiscount.Add(item.DiscountAmount)
			prodMap[key].TotalTax = prodMap[key].TotalTax.Add(item.TaxAmount)
			if item.CostPrice != nil {
				cost := item.CostPrice.Mul(item.Quantity)
				prodMap[key].TotalCost = prodMap[key].TotalCost.Add(cost)
			}
		}
	}

	result := make([]ProductSalesReport, 0, len(prodMap))
	for _, prod := range prodMap {
		result = append(result, *prod)
	}

	// Sort by revenue descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalRevenue.GreaterThan(result[i].TotalRevenue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type CustomerSalesReport struct {
	CustomerID    int             `json:"customerId"`
	CustomerName  string          `json:"customerName"`
	Phone         string          `json:"phone"`
	OrderCount    int             `json:"orderCount"`
	TotalSpend    float64         `json:"totalSpend"`
	TotalDiscount float64         `json:"totalDiscount"`
	AvgOrderValue float64         `json:"avgOrderValue"`
}

func (rs *ReportService) SalesByCustomer(outletId int, from, to time.Time, page, size int) ([]CustomerSalesReport, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Customer").Find(&orders).Error; err != nil {
		return nil, err
	}

	custMap := make(map[int]*CustomerSalesReport)
	for _, order := range orders {
		if order.CustomerID == nil || order.Customer == nil {
			continue
		}

		key := *order.CustomerID
		if _, exists := custMap[key]; !exists {
			phone := ""
			if order.Customer.Phone != nil {
				phone = *order.Customer.Phone
			}
			custMap[key] = &CustomerSalesReport{
				CustomerID:    key,
				CustomerName:  order.Customer.Name,
				Phone:         phone,
				OrderCount:    0,
				TotalSpend:    0,
				TotalDiscount: 0,
				AvgOrderValue: 0,
			}
		}
		custMap[key].OrderCount++
		custMap[key].TotalSpend += order.TotalAmount.InexactFloat64()
		custMap[key].TotalDiscount += order.DiscountAmount.InexactFloat64()
	}

	result := make([]CustomerSalesReport, 0, len(custMap))
	for _, cust := range custMap {
		if cust.OrderCount > 0 {
			cust.AvgOrderValue = cust.TotalSpend / float64(cust.OrderCount)
		}
		result = append(result, *cust)
	}

	// Sort by spend descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalSpend > result[i].TotalSpend {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportSalesCSV(outletId int, from, to time.Time) (string, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items").
		Preload("Payments").
		Preload("Customer").Find(&orders).Error; err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,Order Number,Customer,Items,Subtotal,Discount,Tax,Total,Payment Method\n")

	for _, order := range orders {
		customer := ""
		if order.Customer != nil {
			customer = order.Customer.Name
		}
		itemCount := len(order.Items)
		methods := make([]string, 0)
		for _, p := range order.Payments {
			methods = append(methods, string(p.PaymentMethod))
		}

		sb.WriteString(fmt.Sprintf("%s,%s,\"%s\",%d,%s,%s,%s,%s,\"%s\"\n",
			order.CreatedAt.Format("2006-01-02"),
			order.OrderNumber,
			customer,
			itemCount,
			order.Subtotal.String(),
			order.DiscountAmount.String(),
			order.TaxAmount.String(),
			order.TotalAmount.String(),
			strings.Join(methods, "+"),
		))
	}

	return sb.String(), nil
}

// ─── Purchase Reports ─────────────────────────────────────────────────────

type PurchaseSummaryResponse struct {
	TotalOrders      int             `json:"totalOrders"`
	TotalValue       decimal.Decimal `json:"totalValue"`
	Received         int             `json:"received"`
	Pending          int             `json:"pending"`
	Cancelled        int             `json:"cancelled"`
	UniqueSuppliers  int             `json:"uniqueSuppliers"`
	AvgPOValue       decimal.Decimal `json:"avgPoValue"`
	Outstanding      decimal.Decimal `json:"outstanding"`
}

func (rs *ReportService) PurchaseSummary(outletId int, from, to time.Time) (PurchaseSummaryResponse, error) {
	var res PurchaseSummaryResponse
	var pos []models.PurchaseOrder

	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Find(&pos).Error; err != nil {
		return res, err
	}

	res.TotalOrders = len(pos)
	suppliers := make(map[int]bool)
	totalValue := decimal.Zero
	outstanding := decimal.Zero

	for _, po := range pos {
		suppliers[po.SupplierID] = true
		totalValue = totalValue.Add(po.TotalAmount)

		switch po.Status {
		case "RECEIVED":
			res.Received++
		case "SENT", "DRAFT":
			res.Pending++
		case "CANCELLED":
			res.Cancelled++
		}

		if po.Status != "RECEIVED" && po.Status != "CANCELLED" {
			outstanding = outstanding.Add(po.TotalAmount)
		}
	}

	res.UniqueSuppliers = len(suppliers)
	res.TotalValue = totalValue
	res.Outstanding = outstanding

	if res.TotalOrders > 0 {
		res.AvgPOValue = totalValue.Div(decimal.NewFromInt(int64(res.TotalOrders))).Round(2)
	}

	return res, nil
}

type SupplierPurchaseReport struct {
	SupplierName string          `json:"supplierName"`
	Phone        string          `json:"phone"`
	OrderCount   int             `json:"orderCount"`
	Received     int             `json:"received"`
	Pending      int             `json:"pending"`
	TotalValue   decimal.Decimal `json:"totalValue"`
	AvgPOValue   decimal.Decimal `json:"avgPoValue"`
	Outstanding  decimal.Decimal `json:"outstanding"`
}

func (rs *ReportService) PurchaseBySupplier(outletId int, from, to time.Time) ([]SupplierPurchaseReport, error) {
	var pos []models.PurchaseOrder
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Supplier").Find(&pos).Error; err != nil {
		return nil, err
	}

	supplierMap := make(map[int]*SupplierPurchaseReport)
	for _, po := range pos {
		key := po.SupplierID
		if _, exists := supplierMap[key]; !exists {
			phone := ""
			if po.Supplier != nil && po.Supplier.Phone != nil {
				phone = *po.Supplier.Phone
			}
			supplierMap[key] = &SupplierPurchaseReport{
				SupplierName: po.Supplier.Name,
				Phone:        phone,
				OrderCount:   0,
				Received:     0,
				Pending:      0,
				TotalValue:   decimal.Zero,
				Outstanding:  decimal.Zero,
			}
		}
		supplierMap[key].OrderCount++
		supplierMap[key].TotalValue = supplierMap[key].TotalValue.Add(po.TotalAmount)

		if po.Status == "RECEIVED" {
			supplierMap[key].Received++
		} else if po.Status != "CANCELLED" {
			supplierMap[key].Pending++
		}
	}

	result := make([]SupplierPurchaseReport, 0, len(supplierMap))
	for _, sup := range supplierMap {
		if sup.OrderCount > 0 {
			sup.AvgPOValue = sup.TotalValue.Div(decimal.NewFromInt(int64(sup.OrderCount))).Round(2)
		}
		result = append(result, *sup)
	}

	// Sort by value descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].TotalValue.GreaterThan(result[i].TotalValue) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

type OutstandingPOReport struct {
	PONumber    string          `json:"poNumber"`
	SupplierName string         `json:"supplierName"`
	SupplierPhone string        `json:"supplierPhone"`
	Status      string          `json:"status"`
	ItemCount   int             `json:"itemCount"`
	OrderDate   string          `json:"orderDate"`
	ExpectedDate *string        `json:"expectedDate"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
}

func (rs *ReportService) OutstandingPOs(outletId int) ([]OutstandingPOReport, error) {
	var pos []models.PurchaseOrder
	statuses := []string{"DRAFT", "SENT", "PARTIAL"}
	if err := rs.db.Where("outlet_id = ? AND status IN ?", outletId, statuses).
		Preload("Supplier").
		Preload("Items").
		Order("created_at DESC").Find(&pos).Error; err != nil {
		return nil, err
	}

	result := make([]OutstandingPOReport, 0, len(pos))
	for _, po := range pos {
		phone := ""
		if po.Supplier != nil && po.Supplier.Phone != nil {
			phone = *po.Supplier.Phone
		}

		expectedDate := (*string)(nil)
		if po.ExpectedDate != nil {
			ed := po.ExpectedDate.Format("2006-01-02")
			expectedDate = &ed
		}

		result = append(result, OutstandingPOReport{
			PONumber:     po.PONumber,
			SupplierName: po.Supplier.Name,
			SupplierPhone: phone,
			Status:       string(po.Status),
			ItemCount:    len(po.Items),
			OrderDate:    po.CreatedAt.Format("2006-01-02"),
			ExpectedDate: expectedDate,
			TotalAmount:  po.TotalAmount,
		})
	}

	return result, nil
}

type SaleReturnReport struct {
	OrderNumber      string          `json:"orderNumber"`
	Date             string          `json:"date"`
	Customer         string          `json:"customer"`
	CustomerPhone    string          `json:"customerPhone"`
	Status           string          `json:"status"`
	ItemCount        int             `json:"itemCount"`
	OriginalAmount   decimal.Decimal `json:"originalAmount"`
	RefundAmount     decimal.Decimal `json:"refundAmount"`
	Notes            string          `json:"notes"`
	RefundMethod     string          `json:"refundMethod"`
}

func (rs *ReportService) SaleReturns(outletId int, from, to time.Time, page, size int) ([]SaleReturnReport, error) {
	var orders []models.Order
	if err := rs.db.Where("outlet_id = ? AND order_type = ? AND created_at >= ? AND created_at <= ?",
		outletId, "RETURN", from, to).
		Preload("Items.Product").
		Preload("Customer").
		Preload("Payments").
		Order("created_at DESC").Find(&orders).Error; err != nil {
		return nil, err
	}

	result := make([]SaleReturnReport, 0, len(orders))
	for _, o := range orders {
		customer := ""
		customerPhone := ""
		if o.Customer != nil {
			customer = o.Customer.Name
			if o.Customer.Phone != nil {
				customerPhone = *o.Customer.Phone
			}
		}

		refundMethod := ""
		if len(o.Payments) > 0 {
			refundMethod = string(o.Payments[0].PaymentMethod)
		} else if o.Notes != nil {
			refundMethod = *o.Notes
		}

		result = append(result, SaleReturnReport{
			OrderNumber:    o.OrderNumber,
			Date:           o.CreatedAt.Format("2006-01-02"),
			Customer:       customer,
			CustomerPhone:  customerPhone,
			Status:         string(o.Status),
			ItemCount:      len(o.Items),
			OriginalAmount: o.Subtotal,
			RefundAmount:   o.TotalAmount,
			Notes:          derefStr(o.Notes),
			RefundMethod:   refundMethod,
		})
	}

	return result, nil
}

type PurchaseReturnReport struct {
	ID            int    `json:"id"`
	ReferenceNo   string `json:"referenceNo"`
	PONumber      string `json:"poNumber"`
	SupplierName  string `json:"supplierName"`
	Date          string `json:"date"`
	Status        string `json:"status"`
	ItemCount     int    `json:"itemCount"`
	TotalAmount   decimal.Decimal `json:"totalAmount"`
}

func (rs *ReportService) PurchaseReturns(outletId int, from, to time.Time, page, size int) ([]PurchaseReturnReport, error) {
	var returns []models.PurchaseReturn
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Items.Product").
		Preload("PurchaseOrder.Supplier").
		Find(&returns).Error; err != nil {
		return nil, err
	}

	result := make([]PurchaseReturnReport, 0, len(returns))
	for _, ret := range returns {
		poNumber := ""
		supplierName := ""
		if ret.PurchaseOrder != nil {
			poNumber = ret.PurchaseOrder.PONumber
			supplierName = ret.PurchaseOrder.Supplier.Name
		}

		result = append(result, PurchaseReturnReport{
			ID:          ret.ID,
			ReferenceNo: ret.ReturnNumber,
			PONumber:    poNumber,
			SupplierName: supplierName,
			Date:        ret.CreatedAt.Format("2006-01-02"),
			Status:      string(ret.Status),
			ItemCount:   len(ret.Items),
			TotalAmount: ret.TotalAmount,
		})
	}

	return result, nil
}

type OutstandingReceivable struct {
	ID                int             `json:"id"`
	Name              string          `json:"name"`
	Phone             *string         `json:"phone"`
	Email             *string         `json:"email"`
	OutstandingDue    decimal.Decimal `json:"outstandingDue"`
}

func (rs *ReportService) OutstandingReceivable(outletId int) ([]OutstandingReceivable, error) {
	var customers []models.Customer
	if err := rs.db.Raw(`
		SELECT DISTINCT c.id, c.name, c.phone, c.email, c.outstanding_due
		FROM customers c
		INNER JOIN orders o ON c.id = o.customer_id
		WHERE c.outstanding_due > 0 AND o.outlet_id = ?
		ORDER BY c.outstanding_due DESC
	`, outletId).Scan(&customers).Error; err != nil {
		return nil, err
	}

	result := make([]OutstandingReceivable, 0, len(customers))
	for _, c := range customers {
		result = append(result, OutstandingReceivable{
			ID:             c.ID,
			Name:           c.Name,
			Phone:          c.Phone,
			Email:          c.Email,
			OutstandingDue: c.OutstandingDue,
		})
	}

	return result, nil
}

func (rs *ReportService) ExportPurchaseCSV(outletId int, from, to time.Time) (string, error) {
	var pos []models.PurchaseOrder
	if err := rs.db.Where("outlet_id = ? AND created_at >= ? AND created_at <= ?", outletId, from, to).
		Preload("Supplier").Find(&pos).Error; err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,PO Number,Supplier,Status,Total Amount\n")

	for _, po := range pos {
		sb.WriteString(fmt.Sprintf("%s,%s,\"%s\",%s,%s\n",
			po.CreatedAt.Format("2006-01-02"),
			po.PONumber,
			po.Supplier.Name,
			po.Status,
			po.TotalAmount.String(),
		))
	}

	return sb.String(), nil
}

// ─── Payment Method Report ────────────────────────────────────────────────

type PaymentSummary struct {
	Method     string          `json:"method"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
	TxCount    int             `json:"txCount"`
	AvgAmount  decimal.Decimal `json:"avgAmount"`
	Share      decimal.Decimal `json:"share"`
}

type PaymentDailyTrend struct {
	Date string                 `json:"date"`
	Data map[string]interface{} `json:"data"`
}

type PaymentTransaction struct {
	ID            int    `json:"id"`
	OrderID       int    `json:"orderId"`
	OrderNumber   string `json:"orderNumber"`
	CustomerName  string `json:"customerName"`
	Method        string `json:"method"`
	Amount        decimal.Decimal `json:"amount"`
	Reference     string `json:"reference"`
	Date          string `json:"date"`
	Time          string `json:"time"`
}

type PaymentMethodReport struct {
	Summary    []PaymentSummary      `json:"summary"`
	DailyTrend []map[string]interface{} `json:"dailyTrend"`
	AllMethods []string              `json:"allMethods"`
	GrandTotal decimal.Decimal       `json:"grandTotal"`
	Transactions []PaymentTransaction `json:"transactions"`
}

func (rs *ReportService) PaymentMethodReport(outletId int, from, to time.Time) (PaymentMethodReport, error) {
	var payments []models.Payment
	if err := rs.db.Joins("JOIN orders ON orders.id = payments.order_id").
		Where("payments.status = ? AND orders.outlet_id = ? AND payments.created_at >= ? AND payments.created_at <= ?",
			"COMPLETED", outletId, from, to).
		Preload("Order.Customer").
		Order("payments.created_at ASC").Find(&payments).Error; err != nil {
		return PaymentMethodReport{}, err
	}

	methodMap := make(map[string]*PaymentSummary)
	dailyMap := make(map[string]map[string]decimal.Decimal)

	for _, p := range payments {
		method := string(p.PaymentMethod)
		if _, exists := methodMap[method]; !exists {
			methodMap[method] = &PaymentSummary{
				Method:      method,
				TotalAmount: decimal.Zero,
				TxCount:     0,
				AvgAmount:   decimal.Zero,
				Share:       decimal.Zero,
			}
		}
		methodMap[method].TotalAmount = methodMap[method].TotalAmount.Add(p.Amount)
		methodMap[method].TxCount++

		date := p.CreatedAt.Format("2006-01-02")
		if _, exists := dailyMap[date]; !exists {
			dailyMap[date] = make(map[string]decimal.Decimal)
		}
		dailyMap[date][method] = dailyMap[date][method].Add(p.Amount)
	}

	grandTotal := decimal.Zero
	for _, m := range methodMap {
		grandTotal = grandTotal.Add(m.TotalAmount)
	}

	summary := make([]PaymentSummary, 0, len(methodMap))
	allMethods := make([]string, 0, len(methodMap))
	for method, m := range methodMap {
		if m.TxCount > 0 {
			m.AvgAmount = m.TotalAmount.Div(decimal.NewFromInt(int64(m.TxCount))).Round(2)
		}
		if grandTotal.GreaterThan(decimal.Zero) {
			m.Share = m.TotalAmount.Div(grandTotal).Mul(decimal.NewFromInt(100)).Round(1)
		}
		summary = append(summary, *m)
		allMethods = append(allMethods, method)
	}

	// Sort summary by total amount descending
	for i := 0; i < len(summary)-1; i++ {
		for j := i + 1; j < len(summary); j++ {
			if summary[j].TotalAmount.GreaterThan(summary[i].TotalAmount) {
				summary[i], summary[j] = summary[j], summary[i]
			}
		}
	}

	dailyTrend := make([]map[string]interface{}, 0, len(dailyMap))
	for date := range dailyMap {
		row := make(map[string]interface{})
		row["date"] = date
		for _, m := range allMethods {
			row[m] = dailyMap[date][m].String()
		}
		dailyTrend = append(dailyTrend, row)
	}

	// Sort daily trend by date
	for i := 0; i < len(dailyTrend)-1; i++ {
		for j := i + 1; j < len(dailyTrend); j++ {
			if dailyTrend[j]["date"].(string) < dailyTrend[i]["date"].(string) {
				dailyTrend[i], dailyTrend[j] = dailyTrend[j], dailyTrend[i]
			}
		}
	}

	transactions := make([]PaymentTransaction, 0, len(payments))
	for i := len(payments) - 1; i >= 0; i-- {
		p := payments[i]
		customerName := ""
		orderNumber := ""
		if p.Order != nil {
			orderNumber = p.Order.OrderNumber
			if p.Order.Customer != nil {
				customerName = p.Order.Customer.Name
			}
		}
		reference := ""
		if p.ReferenceNumber != nil {
			reference = *p.ReferenceNumber
		}

		transactions = append(transactions, PaymentTransaction{
			ID:           p.ID,
			OrderID:      p.OrderID,
			OrderNumber:  orderNumber,
			CustomerName: customerName,
			Method:       string(p.PaymentMethod),
			Amount:       p.Amount,
			Reference:    reference,
			Date:         p.CreatedAt.Format("2006-01-02"),
			Time:         p.CreatedAt.Format("15:04"),
		})
	}

	return PaymentMethodReport{
		Summary:      summary,
		DailyTrend:   dailyTrend,
		AllMethods:   allMethods,
		GrandTotal:   grandTotal,
		Transactions: transactions,
	}, nil
}

func (rs *ReportService) ExportPaymentCSV(outletId int, from, to time.Time) (string, error) {
	report, err := rs.PaymentMethodReport(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Date,Time,Order #,Customer,Method,Amount,Reference\n")

	for _, t := range report.Transactions {
		sb.WriteString(fmt.Sprintf("%s,%s,%s,\"%s\",%s,%s,\"%s\"\n",
			t.Date,
			t.Time,
			t.OrderNumber,
			t.CustomerName,
			t.Method,
			t.Amount.String(),
			t.Reference,
		))
	}

	return sb.String(), nil
}

// ─── Debtors & Creditors Ledger ───────────────────────────────────────────

type InvoiceDetail struct {
	InvoiceNumber string          `json:"invoiceNumber"`
	IssueDate     string          `json:"issueDate"`
	DueDate       *string         `json:"dueDate"`
	TotalAmount   decimal.Decimal `json:"totalAmount"`
	PaidAmount    decimal.Decimal `json:"paidAmount"`
	Outstanding   decimal.Decimal `json:"outstanding"`
	Status        string          `json:"status"`
	DaysOverdue   int             `json:"daysOverdue"`
}

type DebtorLedgerRow struct {
	CustomerID   int             `json:"customerId"`
	Name         string          `json:"name"`
	Phone        string          `json:"phone"`
	GSTIN        string          `json:"gstin"`
	TotalInvoiced decimal.Decimal `json:"totalInvoiced"`
	TotalPaid    decimal.Decimal `json:"totalPaid"`
	Outstanding  decimal.Decimal `json:"outstanding"`
	Current      decimal.Decimal `json:"current"`
	Days1_30     decimal.Decimal `json:"days1_30"`
	Days31_60    decimal.Decimal `json:"days31_60"`
	Days61_90    decimal.Decimal `json:"days61_90"`
	Days90Plus   decimal.Decimal `json:"days90plus"`
	Invoices     []InvoiceDetail `json:"invoices"`
}

func (rs *ReportService) DebtorsLedger(outletId int) ([]DebtorLedgerRow, error) {
	var invoices []models.Invoice
	statuses := []string{"SENT", "PARTIAL", "OVERDUE"}
	if err := rs.db.Where("outlet_id = ? AND status IN ? AND customer_id IS NOT NULL", outletId, statuses).
		Preload("Customer").
		Order("issue_date ASC").Find(&invoices).Error; err != nil {
		return nil, err
	}

	partyMap := make(map[int]*DebtorLedgerRow)
	now := time.Now()

	for _, inv := range invoices {
		if inv.Customer == nil {
			continue
		}

		outstanding := inv.TotalAmount.Sub(inv.PaidAmount)
		if outstanding.LessThanOrEqual(decimal.Zero) {
			continue
		}

		cid := *inv.CustomerID
		if _, exists := partyMap[cid]; !exists {
			gstin := ""
			if inv.Customer.GSTIN != nil {
				gstin = *inv.Customer.GSTIN
			}
			phone := ""
			if inv.Customer.Phone != nil {
				phone = *inv.Customer.Phone
			}
			partyMap[cid] = &DebtorLedgerRow{
				CustomerID:   cid,
				Name:         inv.Customer.Name,
				Phone:        phone,
				GSTIN:        gstin,
				TotalInvoiced: decimal.Zero,
				TotalPaid:    decimal.Zero,
				Outstanding: decimal.Zero,
				Current:     decimal.Zero,
				Days1_30:    decimal.Zero,
				Days31_60:   decimal.Zero,
				Days61_90:   decimal.Zero,
				Days90Plus:  decimal.Zero,
				Invoices:    make([]InvoiceDetail, 0),
			}
		}

		// Calculate age buckets
		ref := inv.DueDate
		if ref == nil {
			tmp := inv.IssueDate.AddDate(0, 0, 30)
			ref = &tmp
		}
		days := int(now.Sub(*ref).Hours() / 24)

		if days <= 0 {
			partyMap[cid].Current = partyMap[cid].Current.Add(outstanding)
		} else if days <= 30 {
			partyMap[cid].Days1_30 = partyMap[cid].Days1_30.Add(outstanding)
		} else if days <= 60 {
			partyMap[cid].Days31_60 = partyMap[cid].Days31_60.Add(outstanding)
		} else if days <= 90 {
			partyMap[cid].Days61_90 = partyMap[cid].Days61_90.Add(outstanding)
		} else {
			partyMap[cid].Days90Plus = partyMap[cid].Days90Plus.Add(outstanding)
		}

		partyMap[cid].TotalInvoiced = partyMap[cid].TotalInvoiced.Add(inv.TotalAmount)
		partyMap[cid].TotalPaid = partyMap[cid].TotalPaid.Add(inv.PaidAmount)
		partyMap[cid].Outstanding = partyMap[cid].Outstanding.Add(outstanding)

		dueDate := (*string)(nil)
		if inv.DueDate != nil {
			dd := inv.DueDate.Format("2006-01-02")
			dueDate = &dd
		}
		daysOverdue := 0
		if days > 0 {
			daysOverdue = days
		}

		partyMap[cid].Invoices = append(partyMap[cid].Invoices, InvoiceDetail{
			InvoiceNumber: inv.InvoiceNumber,
			IssueDate:     inv.IssueDate.Format("2006-01-02"),
			DueDate:       dueDate,
			TotalAmount:   inv.TotalAmount,
			PaidAmount:    inv.PaidAmount,
			Outstanding:   outstanding,
			Status:        string(inv.Status),
			DaysOverdue:   daysOverdue,
		})
	}

	result := make([]DebtorLedgerRow, 0, len(partyMap))
	for _, party := range partyMap {
		result = append(result, *party)
	}

	// Sort by outstanding descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Outstanding.GreaterThan(result[i].Outstanding) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportDebtorsCSV(outletId int) (string, error) {
	rows, err := rs.DebtorsLedger(outletId)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Party Name,GSTIN,Phone,Total Invoiced,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("\"%s\",\"%s\",\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.Name,
			r.GSTIN,
			r.Phone,
			r.TotalInvoiced.String(),
			r.TotalPaid.String(),
			r.Outstanding.String(),
			r.Current.String(),
			r.Days1_30.String(),
			r.Days31_60.String(),
			r.Days61_90.String(),
			r.Days90Plus.String(),
		))
	}

	return sb.String(), nil
}

type BillDetail struct {
	BillNumber string          `json:"billNumber"`
	BillDate   string          `json:"billDate"`
	DueDate    *string         `json:"dueDate"`
	TotalAmount decimal.Decimal `json:"totalAmount"`
	PaidAmount decimal.Decimal `json:"paidAmount"`
	Outstanding decimal.Decimal `json:"outstanding"`
	Status     string          `json:"status"`
	DaysOverdue int             `json:"daysOverdue"`
}

type CreditorLedgerRow struct {
	SupplierID   int             `json:"supplierId"`
	Name         string          `json:"name"`
	Phone        string          `json:"phone"`
	GSTIN        string          `json:"gstin"`
	TotalBilled  decimal.Decimal `json:"totalBilled"`
	TotalPaid    decimal.Decimal `json:"totalPaid"`
	Outstanding  decimal.Decimal `json:"outstanding"`
	Current      decimal.Decimal `json:"current"`
	Days1_30     decimal.Decimal `json:"days1_30"`
	Days31_60    decimal.Decimal `json:"days31_60"`
	Days61_90    decimal.Decimal `json:"days61_90"`
	Days90Plus   decimal.Decimal `json:"days90plus"`
	Bills        []BillDetail    `json:"bills"`
}

func (rs *ReportService) CreditorsLedger(outletId int) ([]CreditorLedgerRow, error) {
	var bills []models.PurchaseBill
	statuses := []string{"UNPAID", "PARTIAL"}
	if err := rs.db.Where("outlet_id = ? AND status IN ?", outletId, statuses).
		Preload("Supplier").
		Order("bill_date ASC").Find(&bills).Error; err != nil {
		return nil, err
	}

	partyMap := make(map[int]*CreditorLedgerRow)
	now := time.Now()

	for _, bill := range bills {
		outstanding := bill.TotalAmount.Sub(bill.PaidAmount)
		if outstanding.LessThanOrEqual(decimal.Zero) {
			continue
		}

		sid := bill.SupplierID
		if _, exists := partyMap[sid]; !exists {
			gstin := ""
			if bill.Supplier.GSTIN != nil {
				gstin = *bill.Supplier.GSTIN
			}
			phone := ""
			if bill.Supplier.Phone != nil {
				phone = *bill.Supplier.Phone
			}
			partyMap[sid] = &CreditorLedgerRow{
				SupplierID:  sid,
				Name:        bill.Supplier.Name,
				Phone:       phone,
				GSTIN:       gstin,
				TotalBilled: decimal.Zero,
				TotalPaid:   decimal.Zero,
				Outstanding: decimal.Zero,
				Current:     decimal.Zero,
				Days1_30:    decimal.Zero,
				Days31_60:   decimal.Zero,
				Days61_90:   decimal.Zero,
				Days90Plus:  decimal.Zero,
				Bills:       make([]BillDetail, 0),
			}
		}

		// Calculate age buckets
		ref := bill.DueDate
		if ref == nil {
			tmp := bill.BillDate.AddDate(0, 0, 30)
			ref = &tmp
		}
		days := int(now.Sub(*ref).Hours() / 24)

		if days <= 0 {
			partyMap[sid].Current = partyMap[sid].Current.Add(outstanding)
		} else if days <= 30 {
			partyMap[sid].Days1_30 = partyMap[sid].Days1_30.Add(outstanding)
		} else if days <= 60 {
			partyMap[sid].Days31_60 = partyMap[sid].Days31_60.Add(outstanding)
		} else if days <= 90 {
			partyMap[sid].Days61_90 = partyMap[sid].Days61_90.Add(outstanding)
		} else {
			partyMap[sid].Days90Plus = partyMap[sid].Days90Plus.Add(outstanding)
		}

		partyMap[sid].TotalBilled = partyMap[sid].TotalBilled.Add(bill.TotalAmount)
		partyMap[sid].TotalPaid = partyMap[sid].TotalPaid.Add(bill.PaidAmount)
		partyMap[sid].Outstanding = partyMap[sid].Outstanding.Add(outstanding)

		dueDate := (*string)(nil)
		if bill.DueDate != nil {
			dd := bill.DueDate.Format("2006-01-02")
			dueDate = &dd
		}
		daysOverdue := 0
		if days > 0 {
			daysOverdue = days
		}

		partyMap[sid].Bills = append(partyMap[sid].Bills, BillDetail{
			BillNumber:  bill.BillNumber,
			BillDate:    bill.BillDate.Format("2006-01-02"),
			DueDate:     dueDate,
			TotalAmount: bill.TotalAmount,
			PaidAmount:  bill.PaidAmount,
			Outstanding: outstanding,
			Status:      string(bill.Status),
			DaysOverdue: daysOverdue,
		})
	}

	result := make([]CreditorLedgerRow, 0, len(partyMap))
	for _, party := range partyMap {
		result = append(result, *party)
	}

	// Sort by outstanding descending
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Outstanding.GreaterThan(result[i].Outstanding) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

func (rs *ReportService) ExportCreditorsCSV(outletId int) (string, error) {
	rows, err := rs.CreditorsLedger(outletId)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Party Name,GSTIN,Phone,Total Billed,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("\"%s\",\"%s\",\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.Name,
			r.GSTIN,
			r.Phone,
			r.TotalBilled.String(),
			r.TotalPaid.String(),
			r.Outstanding.String(),
			r.Current.String(),
			r.Days1_30.String(),
			r.Days31_60.String(),
			r.Days61_90.String(),
			r.Days90Plus.String(),
		))
	}

	return sb.String(), nil
}


// ─── Ledger / Trial Balance ───────────────────────────────────────────────────

type LedgerAccount struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	AccountType    string          `json:"accountType"` // "gl" | "customer" | "supplier"
	PartyID        *int            `json:"partyId,omitempty"`
	OpeningBalance decimal.Decimal `json:"openingBalance"`
	Debit          decimal.Decimal `json:"debit"`
	Credit         decimal.Decimal `json:"credit"`
	ClosingBalance decimal.Decimal `json:"closingBalance"`
}

type LedgerSummaryResponse struct {
	Accounts []LedgerAccount `json:"accounts"`
}

func (rs *ReportService) LedgerSummary(outletId int, from, to time.Time) (LedgerSummaryResponse, error) {
	var res LedgerSummaryResponse
	zero := decimal.Zero

	// ── 1. Purchase accounts grouped by GST rate ──────────────────────────
	type rateRow struct {
		Rate   float64
		Amount decimal.Decimal
		GST    decimal.Decimal
	}
	var purchaseRows []rateRow
	if err := rs.db.Raw(`
		SELECT ROUND(pbi.tax_rate) as rate,
		       SUM(pbi.line_total) as amount,
		       SUM(pbi.line_total * pbi.tax_rate / 100) as gst
		FROM purchase_bill_items pbi
		JOIN purchase_bills pb ON pbi.bill_id = pb.id
		WHERE pb.outlet_id = ? AND pb.bill_date >= ? AND pb.bill_date <= ?
		  AND pb.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY ROUND(pbi.tax_rate)
		ORDER BY rate`, outletId, from, to).Scan(&purchaseRows).Error; err != nil {
		return res, err
	}

	inputGST := map[int]decimal.Decimal{}
	for _, r := range purchaseRows {
		rate := int(r.Rate)
		name := fmt.Sprintf("Purchase %d%%", rate)
		id := fmt.Sprintf("purchase-%d", rate)
		closing := r.Amount
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: r.Amount, Credit: zero, ClosingBalance: closing,
		})
		inputGST[rate] = inputGST[rate].Add(r.GST)
	}

	// ── 2. Sales accounts grouped by GST rate ─────────────────────────────
	var salesRows []rateRow
	if err := rs.db.Raw(`
		SELECT ROUND(ii.tax_rate) as rate,
		       SUM(ii.line_total) as amount,
		       SUM(ii.line_total * ii.tax_rate / 100) as gst
		FROM invoice_items ii
		JOIN invoices i ON ii.invoice_id = i.id
		WHERE i.outlet_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
		  AND i.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY ROUND(ii.tax_rate)
		ORDER BY rate`, outletId, from, to).Scan(&salesRows).Error; err != nil {
		return res, err
	}

	outputGST := map[int]decimal.Decimal{}
	for _, r := range salesRows {
		rate := int(r.Rate)
		name := fmt.Sprintf("Sale %d%%", rate)
		id := fmt.Sprintf("sale-%d", rate)
		closing := r.Amount.Neg()
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: zero, Credit: r.Amount, ClosingBalance: closing,
		})
		outputGST[rate] = outputGST[rate].Add(r.GST)
	}

	// ── 3. GST accounts (all unique rates) ───────────────────────────────
	allRates := map[int]bool{}
	for k := range inputGST { allRates[k] = true }
	for k := range outputGST { allRates[k] = true }
	for rate := range allRates {
		inp := inputGST[rate]
		out := outputGST[rate]
		closing := inp.Sub(out)
		name := fmt.Sprintf("GST %d%%", rate)
		id := fmt.Sprintf("gst-%d", rate)
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: id, Name: name, AccountType: "gl",
			OpeningBalance: zero, Debit: inp, Credit: out, ClosingBalance: closing,
		})
	}

	// ── 4. Customer accounts (Sundry Debtors) ────────────────────────────
	type partyRow struct {
		ID     int
		Name   string
		Debit  decimal.Decimal
		Credit decimal.Decimal
	}
	var custRows []partyRow
	if err := rs.db.Raw(`
		SELECT c.id, c.name,
		       COALESCE(SUM(i.total_amount),0) as debit,
		       COALESCE(SUM(i.paid_amount),0)  as credit
		FROM customers c
		JOIN invoices i ON i.customer_id = c.id
		WHERE i.outlet_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
		  AND i.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY c.id, c.name
		ORDER BY c.name`, outletId, from, to).Scan(&custRows).Error; err != nil {
		return res, err
	}
	for _, r := range custRows {
		closing := r.Debit.Sub(r.Credit)
		pid := r.ID
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: fmt.Sprintf("customer-%d", r.ID), Name: strings.ToUpper(r.Name),
			AccountType: "customer", PartyID: &pid,
			OpeningBalance: zero, Debit: r.Debit, Credit: r.Credit, ClosingBalance: closing,
		})
	}

	// ── 5. Supplier accounts (Sundry Creditors) ───────────────────────────
	var suppRows []partyRow
	if err := rs.db.Raw(`
		SELECT s.id, s.name,
		       COALESCE(SUM(pb.paid_amount),0)   as debit,
		       COALESCE(SUM(pb.total_amount),0)  as credit
		FROM suppliers s
		JOIN purchase_bills pb ON pb.supplier_id = s.id
		WHERE pb.outlet_id = ? AND pb.bill_date >= ? AND pb.bill_date <= ?
		  AND pb.status NOT IN ('CANCELLED','DRAFT')
		GROUP BY s.id, s.name
		ORDER BY s.name`, outletId, from, to).Scan(&suppRows).Error; err != nil {
		return res, err
	}
	for _, r := range suppRows {
		closing := r.Debit.Sub(r.Credit)
		pid := r.ID
		res.Accounts = append(res.Accounts, LedgerAccount{
			ID: fmt.Sprintf("supplier-%d", r.ID), Name: strings.ToUpper(r.Name),
			AccountType: "supplier", PartyID: &pid,
			OpeningBalance: zero, Debit: r.Debit, Credit: r.Credit, ClosingBalance: closing,
		})
	}

	// ── 6. Expense accounts grouped by category ──────────────────────────
	type expenseRow struct {
		CategoryID   int
		CategoryName string
		Amount       decimal.Decimal
	}
	var expRows []expenseRow
	if err := rs.db.Raw(`
		SELECT ec.id as category_id, ec.name as category_name,
		       SUM(e.total_amount) as amount
		FROM expenses e
		JOIN expense_categories ec ON e.expense_category_id = ec.id
		WHERE e.outlet_id = ? AND e.expense_date >= ? AND e.expense_date <= ?
		  AND e.status NOT IN ('REJECTED')
		GROUP BY ec.id, ec.name
		ORDER BY ec.name`, outletId, from, to).Scan(&expRows).Error; err == nil {
		for _, r := range expRows {
			res.Accounts = append(res.Accounts, LedgerAccount{
				ID:   fmt.Sprintf("expense-%d", r.CategoryID),
				Name: "Expense — " + r.CategoryName,
				AccountType:    "gl",
				OpeningBalance: zero,
				Debit:          r.Amount,
				Credit:         zero,
				ClosingBalance: r.Amount,
			})
		}
	}

	return res, nil
}

// ─── Ledger Detail (single party) ─────────────────────────────────────────────

type LedgerEntry struct {
	Date        string          `json:"date"`
	Particulars string          `json:"particulars"`
	VoucherType string          `json:"voucherType"`
	VoucherNo   string          `json:"voucherNo"`
	Debit       decimal.Decimal `json:"debit"`
	Credit      decimal.Decimal `json:"credit"`
	Balance     decimal.Decimal `json:"balance"`
}

type LedgerDetailResponse struct {
	PartyName      string          `json:"partyName"`
	PartyType      string          `json:"partyType"`
	OpeningBalance decimal.Decimal `json:"openingBalance"`
	ClosingBalance decimal.Decimal `json:"closingBalance"`
	Entries        []LedgerEntry   `json:"entries"`
}

func (rs *ReportService) LedgerDetail(outletId int, partyType string, partyId int, from, to time.Time) (LedgerDetailResponse, error) {
	var res LedgerDetailResponse
	zero := decimal.Zero
	running := zero

	if partyType == "customer" {
		// Fetch customer name
		var name string
		rs.db.Raw("SELECT name FROM customers WHERE id = ?", partyId).Scan(&name)
		res.PartyName = strings.ToUpper(name)
		res.PartyType = "customer"

		// Invoices (debit)
		type invRow struct {
			IssueDate   time.Time
			InvoiceNo   string
			TotalAmount decimal.Decimal
			PaidAmount  decimal.Decimal
		}
		var invs []invRow
		rs.db.Raw(`
			SELECT issue_date, invoice_number as invoice_no, total_amount, paid_amount
			FROM invoices
			WHERE outlet_id = ? AND customer_id = ? AND issue_date >= ? AND issue_date <= ?
			  AND status NOT IN ('CANCELLED','DRAFT')
			ORDER BY issue_date`, outletId, partyId, from, to).Scan(&invs)

		for _, inv := range invs {
			running = running.Add(inv.TotalAmount)
			res.Entries = append(res.Entries, LedgerEntry{
				Date: inv.IssueDate.Format("02 Jan 2006"), Particulars: "Sales Invoice",
				VoucherType: "Invoice", VoucherNo: inv.InvoiceNo,
				Debit: inv.TotalAmount, Credit: zero, Balance: running,
			})
			if inv.PaidAmount.GreaterThan(zero) {
				running = running.Sub(inv.PaidAmount)
				res.Entries = append(res.Entries, LedgerEntry{
					Date: inv.IssueDate.Format("02 Jan 2006"), Particulars: "Payment Received",
					VoucherType: "Receipt", VoucherNo: inv.InvoiceNo,
					Debit: zero, Credit: inv.PaidAmount, Balance: running,
				})
			}
		}

	} else if partyType == "supplier" {
		var name string
		rs.db.Raw("SELECT name FROM suppliers WHERE id = ?", partyId).Scan(&name)
		res.PartyName = strings.ToUpper(name)
		res.PartyType = "supplier"

		type billRow struct {
			BillDate    time.Time
			BillNumber  string
			TotalAmount decimal.Decimal
			PaidAmount  decimal.Decimal
		}
		var bills []billRow
		rs.db.Raw(`
			SELECT bill_date, bill_number, total_amount, paid_amount
			FROM purchase_bills
			WHERE outlet_id = ? AND supplier_id = ? AND bill_date >= ? AND bill_date <= ?
			  AND status NOT IN ('CANCELLED','DRAFT')
			ORDER BY bill_date`, outletId, partyId, from, to).Scan(&bills)

		for _, b := range bills {
			running = running.Sub(b.TotalAmount)
			res.Entries = append(res.Entries, LedgerEntry{
				Date: b.BillDate.Format("02 Jan 2006"), Particulars: "Purchase Bill",
				VoucherType: "Purchase", VoucherNo: b.BillNumber,
				Debit: zero, Credit: b.TotalAmount, Balance: running,
			})
			if b.PaidAmount.GreaterThan(zero) {
				running = running.Add(b.PaidAmount)
				res.Entries = append(res.Entries, LedgerEntry{
					Date: b.BillDate.Format("02 Jan 2006"), Particulars: "Payment Made",
					VoucherType: "Payment", VoucherNo: b.BillNumber,
					Debit: b.PaidAmount, Credit: zero, Balance: running,
				})
			}
		}
	}

	res.OpeningBalance = zero
	res.ClosingBalance = running
	return res, nil
}

// LedgerTDSPayable returns total TDS deducted in period (for the TDS Payable ledger account).
func (rs *ReportService) LedgerTDSPayable(outletId int, from, to time.Time) (decimal.Decimal, error) {
	var total decimal.Decimal
	err := rs.db.Raw(`
		SELECT COALESCE(SUM(tds_amount),0)
		FROM tds_deductions
		WHERE outlet_id = ? AND payment_date >= ? AND payment_date <= ?`, outletId, from, to).Scan(&total).Error
	return total, err
}
