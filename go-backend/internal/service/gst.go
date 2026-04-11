package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type GSTService struct {
	db *gorm.DB
}

func NewGSTService(db *gorm.DB) *GSTService {
	return &GSTService{db: db}
}

// ─── GSTR-1 ────────────────────────────────────────────────────────────────

type B2BRecord struct {
	GSTIN          string          `json:"gstin"`
	CustomerName   string          `json:"customerName"`
	InvoiceNumber  string          `json:"invoiceNumber"`
	InvoiceDate    string          `json:"invoiceDate"`
	InvoiceValue   decimal.Decimal `json:"invoiceValue"`
	TaxableValue   decimal.Decimal `json:"taxableValue"`
	CGST           decimal.Decimal `json:"cgst"`
	SGST           decimal.Decimal `json:"sgst"`
	IGST           decimal.Decimal `json:"igst"`
}

type B2CSRecord struct {
	TaxRate        string          `json:"taxRate"`
	TaxableValue   decimal.Decimal `json:"taxableValue"`
	CGST           decimal.Decimal `json:"cgst"`
	SGST           decimal.Decimal `json:"sgst"`
	IGST           decimal.Decimal `json:"igst"`
}

type HSNRecord struct {
	HSNCode       string          `json:"hsnCode"`
	Description   string          `json:"description"`
	UOM           string          `json:"uom"`
	TotalQuantity decimal.Decimal `json:"totalQuantity"`
	TotalValue    decimal.Decimal `json:"totalValue"`
	TaxableValue  decimal.Decimal `json:"taxableValue"`
	CGST          decimal.Decimal `json:"cgst"`
	SGST          decimal.Decimal `json:"sgst"`
	IGST          decimal.Decimal `json:"igst"`
	TotalTax      decimal.Decimal `json:"totalTax"`
}

type GSTR1Response struct {
	Period        string        `json:"period"`
	OutletGSTIN   *string       `json:"outletGstin"`
	TotalInvoices int           `json:"totalInvoices"`
	TotalTaxableValue decimal.Decimal `json:"totalTaxableValue"`
	TotalCGST     decimal.Decimal `json:"totalCgst"`
	TotalSGST     decimal.Decimal `json:"totalSgst"`
	TotalIGST     decimal.Decimal `json:"totalIgst"`
	GrandTotal    decimal.Decimal `json:"grandTotal"`
	B2B           []B2BRecord    `json:"b2b"`
	B2CS          []B2CSRecord   `json:"b2cs"`
	HSNSummary    []HSNRecord    `json:"hsnSummary"`
}

func (gs *GSTService) GSTR1(outletId int, from, to time.Time) (GSTR1Response, error) {
	var res GSTR1Response

	// Get outlet info
	outlet := &models.Outlet{}
	if err := gs.db.First(outlet, outletId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return res, nil
		}
		return res, err
	}

	res.OutletGSTIN = outlet.GSTIN

	// Get completed orders
	var orders []models.Order
	if err := gs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items.Product.TaxGroup").
		Preload("Customer").
		Preload("Invoices").
		Find(&orders).Error; err != nil {
		return res, err
	}

	res.Period = from.Format("2006-01-02") + " to " + to.Format("2006-01-02")
	res.TotalInvoices = len(orders)

	// Process B2B (customers with GSTIN)
	b2bMap := make(map[string]*B2BRecord)
	for _, order := range orders {
		if order.Customer != nil && order.Customer.GSTIN != nil {
			taxable := order.Subtotal.Sub(order.DiscountAmount)
			tax := order.TaxAmount
			cgst := tax.Div(decimal.NewFromInt(2)).Round(2)
			sgst := tax.Sub(cgst)

			invoiceNumber := order.OrderNumber
			if len(order.Invoices) > 0 {
				invoiceNumber = order.Invoices[0].InvoiceNumber
			}

			b2bMap[invoiceNumber] = &B2BRecord{
				GSTIN:        *order.Customer.GSTIN,
				CustomerName: order.Customer.Name,
				InvoiceNumber: invoiceNumber,
				InvoiceDate:  order.CreatedAt.Format("2006-01-02"),
				InvoiceValue: order.TotalAmount,
				TaxableValue: taxable,
				CGST:         cgst,
				SGST:         sgst,
				IGST:         decimal.Zero,
			}
		}
	}

	// Process B2CS (customers without GSTIN)
	b2csMap := make(map[string]*B2CSRecord)
	hsnMap := make(map[string]*HSNRecord)

	for _, order := range orders {
		// B2CS processing
		if order.Customer == nil || order.Customer.GSTIN == nil {
			for _, item := range order.Items {
				rate := "0"
				if !item.TaxRate.IsZero() {
					rate = fmt.Sprintf("%.0f", item.TaxRate.InexactFloat64())
				}

				if _, exists := b2csMap[rate]; !exists {
					b2csMap[rate] = &B2CSRecord{
						TaxRate:      rate,
						TaxableValue: decimal.Zero,
						CGST:         decimal.Zero,
						SGST:         decimal.Zero,
						IGST:         decimal.Zero,
					}
				}

				taxable := item.Quantity.Mul(item.UnitPrice).Sub(item.DiscountAmount)
				tax := item.TaxAmount
				cgst := tax.Div(decimal.NewFromInt(2)).Round(2)
				sgst := tax.Sub(cgst)

				b2csMap[rate].TaxableValue = b2csMap[rate].TaxableValue.Add(taxable)
				b2csMap[rate].CGST = b2csMap[rate].CGST.Add(cgst)
				b2csMap[rate].SGST = b2csMap[rate].SGST.Add(sgst)
			}
		}

		// HSN processing
		for _, item := range order.Items {
			hsn := ""
			if item.Product != nil && item.Product.TaxGroup != nil && item.Product.TaxGroup.HSNCode != nil {
				hsn = *item.Product.TaxGroup.HSNCode
			}
			if hsn == "" {
				hsn = "NO_HSN"
			}

			if _, exists := hsnMap[hsn]; !exists {
				uom := "Pcs"
				desc := "Unknown"
				if item.Product != nil {
					uom = item.Product.UnitOfMeasure
					desc = item.Product.Name
				}
				hsnMap[hsn] = &HSNRecord{
					HSNCode:       hsn,
					Description:   desc,
					UOM:           uom,
					TotalQuantity: decimal.Zero,
					TotalValue:    decimal.Zero,
					TaxableValue:  decimal.Zero,
					CGST:          decimal.Zero,
					SGST:          decimal.Zero,
					IGST:          decimal.Zero,
					TotalTax:      decimal.Zero,
				}
			}

			taxable := item.Quantity.Mul(item.UnitPrice).Sub(item.DiscountAmount)
			tax := item.TaxAmount
			cgst := tax.Div(decimal.NewFromInt(2)).Round(2)
			sgst := tax.Sub(cgst)

			hsnMap[hsn].TotalQuantity = hsnMap[hsn].TotalQuantity.Add(item.Quantity)
			hsnMap[hsn].TotalValue = hsnMap[hsn].TotalValue.Add(item.LineTotal)
			hsnMap[hsn].TaxableValue = hsnMap[hsn].TaxableValue.Add(taxable)
			hsnMap[hsn].CGST = hsnMap[hsn].CGST.Add(cgst)
			hsnMap[hsn].SGST = hsnMap[hsn].SGST.Add(sgst)
			hsnMap[hsn].TotalTax = hsnMap[hsn].TotalTax.Add(tax)
		}
	}

	// Build results
	res.B2B = make([]B2BRecord, 0, len(b2bMap))
	for _, b := range b2bMap {
		res.B2B = append(res.B2B, *b)
		res.TotalTaxableValue = res.TotalTaxableValue.Add(b.TaxableValue)
		res.TotalCGST = res.TotalCGST.Add(b.CGST)
		res.TotalSGST = res.TotalSGST.Add(b.SGST)
	}

	res.B2CS = make([]B2CSRecord, 0, len(b2csMap))
	for _, b := range b2csMap {
		res.B2CS = append(res.B2CS, *b)
		res.TotalTaxableValue = res.TotalTaxableValue.Add(b.TaxableValue)
		res.TotalCGST = res.TotalCGST.Add(b.CGST)
		res.TotalSGST = res.TotalSGST.Add(b.SGST)
	}

	res.HSNSummary = make([]HSNRecord, 0, len(hsnMap))
	for _, h := range hsnMap {
		res.HSNSummary = append(res.HSNSummary, *h)
	}

	for _, order := range orders {
		res.GrandTotal = res.GrandTotal.Add(order.TotalAmount)
	}

	return res, nil
}

// ─── GSTR-3B ───────────────────────────────────────────────────────────────

type TaxSection struct {
	TaxableValue decimal.Decimal `json:"taxableValue"`
	IGST         decimal.Decimal `json:"igst"`
	CGST         decimal.Decimal `json:"cgst"`
	SGST         decimal.Decimal `json:"sgst"`
	Cess         decimal.Decimal `json:"cess"`
}

type ITCSection struct {
	IGST decimal.Decimal `json:"igst"`
	CGST decimal.Decimal `json:"cgst"`
	SGST decimal.Decimal `json:"sgst"`
	Cess decimal.Decimal `json:"cess"`
}

type NetTaxPayable struct {
	IGST  decimal.Decimal `json:"igst"`
	CGST  decimal.Decimal `json:"cgst"`
	SGST  decimal.Decimal `json:"sgst"`
	Cess  decimal.Decimal `json:"cess"`
	Total decimal.Decimal `json:"total"`
}

type ITCCarryForward struct {
	CGST  decimal.Decimal `json:"cgst"`
	SGST  decimal.Decimal `json:"sgst"`
	IGST  decimal.Decimal `json:"igst"`
	Total decimal.Decimal `json:"total"`
}

type GSTR3BResponse struct {
	Period              string           `json:"period"`
	OutletGSTIN         *string          `json:"outletGstin"`
	OutletName          string           `json:"outletName"`
	GrossSales          decimal.Decimal  `json:"grossSales"`
	TotalDiscount       decimal.Decimal  `json:"totalDiscount"`
	BillCount           int              `json:"billCount"`
	Section3_1_Taxable  TaxSection       `json:"section3_1_taxable"`
	Section4_ITC        ITCSection       `json:"section4_itc"`
	NetTaxPayable       NetTaxPayable    `json:"netTaxPayable"`
	ITCCarryForward     ITCCarryForward  `json:"itcCarryForward"`
}

func (gs *GSTService) GSTR3B(outletId int, from, to time.Time) (GSTR3BResponse, error) {
	var res GSTR3BResponse

	outlet := &models.Outlet{}
	if err := gs.db.First(outlet, outletId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return res, nil
		}
		return res, err
	}

	res.OutletGSTIN = outlet.GSTIN
	res.OutletName = outlet.Name
	res.Period = from.Format("2006-01-02") + " to " + to.Format("2006-01-02")

	// Get completed orders
	var orders []models.Order
	if err := gs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).Find(&orders).Error; err != nil {
		return res, err
	}

	// Calculate output tax
	grossSales := decimal.Zero
	totalDiscount := decimal.Zero
	taxable := decimal.Zero
	outputTax := decimal.Zero

	for _, order := range orders {
		grossSales = grossSales.Add(order.TotalAmount)
		totalDiscount = totalDiscount.Add(order.DiscountAmount)
		t := order.Subtotal.Sub(order.DiscountAmount)
		taxable = taxable.Add(t)
		outputTax = outputTax.Add(order.TaxAmount)
	}

	res.GrossSales = grossSales
	res.TotalDiscount = totalDiscount
	res.Section3_1_Taxable.TaxableValue = taxable
	res.Section3_1_Taxable.CGST = outputTax.Div(decimal.NewFromInt(2)).Round(2)
	res.Section3_1_Taxable.SGST = outputTax.Sub(res.Section3_1_Taxable.CGST)

	// Get purchase bills
	var bills []models.PurchaseBill
	if err := gs.db.Where("outlet_id = ? AND bill_date >= ? AND bill_date <= ?", outletId, from, to).
		Find(&bills).Error; err != nil {
		return res, err
	}

	res.BillCount = len(bills)

	itcIGST := decimal.Zero
	itcCGST := decimal.Zero
	itcSGST := decimal.Zero

	for _, bill := range bills {
		itcIGST = itcIGST.Add(bill.IGSTAmount)
		itcCGST = itcCGST.Add(bill.CGSTAmount)
		itcSGST = itcSGST.Add(bill.SGSTAmount)
	}

	res.Section4_ITC.IGST = itcIGST
	res.Section4_ITC.CGST = itcCGST
	res.Section4_ITC.SGST = itcSGST

	// Calculate net tax
	netCGST := res.Section3_1_Taxable.CGST.Sub(itcCGST)
	netSGST := res.Section3_1_Taxable.SGST.Sub(itcSGST)
	netIGST := decimal.Zero.Sub(itcIGST)

	clamp := func(v decimal.Decimal) decimal.Decimal {
		if v.LessThan(decimal.Zero) {
			return decimal.Zero
		}
		return v
	}

	res.NetTaxPayable.CGST = clamp(netCGST)
	res.NetTaxPayable.SGST = clamp(netSGST)
	res.NetTaxPayable.IGST = clamp(netIGST)
	res.NetTaxPayable.Total = res.NetTaxPayable.CGST.Add(res.NetTaxPayable.SGST).Add(res.NetTaxPayable.IGST)

	if netCGST.LessThan(decimal.Zero) {
		res.ITCCarryForward.CGST = netCGST.Abs()
	}
	if netSGST.LessThan(decimal.Zero) {
		res.ITCCarryForward.SGST = netSGST.Abs()
	}
	if netIGST.LessThan(decimal.Zero) {
		res.ITCCarryForward.IGST = netIGST.Abs()
	}
	res.ITCCarryForward.Total = res.ITCCarryForward.CGST.Add(res.ITCCarryForward.SGST).Add(res.ITCCarryForward.IGST)

	return res, nil
}

// ─── HSN Summary (Sales) ───────────────────────────────────────────────────

func (gs *GSTService) HSNSummary(outletId int, from, to time.Time) ([]HSNRecord, error) {
	var orders []models.Order
	if err := gs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items.Product.TaxGroup").
		Find(&orders).Error; err != nil {
		return nil, err
	}

	hsnMap := make(map[string]*HSNRecord)

	for _, order := range orders {
		for _, item := range order.Items {
			hsn := ""
			if item.Product != nil && item.Product.TaxGroup != nil && item.Product.TaxGroup.HSNCode != nil {
				hsn = *item.Product.TaxGroup.HSNCode
			}
			if hsn == "" {
				hsn = "NO_HSN"
			}

			if _, exists := hsnMap[hsn]; !exists {
				uom := "Pcs"
				desc := "Unknown"
				if item.Product != nil {
					uom = item.Product.UnitOfMeasure
					desc = item.Product.Name
				}
				hsnMap[hsn] = &HSNRecord{
					HSNCode:       hsn,
					Description:   desc,
					UOM:           uom,
					TotalQuantity: decimal.Zero,
					TotalValue:    decimal.Zero,
					TaxableValue:  decimal.Zero,
					CGST:          decimal.Zero,
					SGST:          decimal.Zero,
					IGST:          decimal.Zero,
					TotalTax:      decimal.Zero,
				}
			}

			taxable := item.Quantity.Mul(item.UnitPrice).Sub(item.DiscountAmount)
			tax := item.TaxAmount
			cgst := tax.Div(decimal.NewFromInt(2)).Round(2)
			sgst := tax.Sub(cgst)

			hsnMap[hsn].TotalQuantity = hsnMap[hsn].TotalQuantity.Add(item.Quantity)
			hsnMap[hsn].TotalValue = hsnMap[hsn].TotalValue.Add(item.LineTotal)
			hsnMap[hsn].TaxableValue = hsnMap[hsn].TaxableValue.Add(taxable)
			hsnMap[hsn].CGST = hsnMap[hsn].CGST.Add(cgst)
			hsnMap[hsn].SGST = hsnMap[hsn].SGST.Add(sgst)
			hsnMap[hsn].TotalTax = hsnMap[hsn].TotalTax.Add(tax)
		}
	}

	result := make([]HSNRecord, 0, len(hsnMap))
	for _, h := range hsnMap {
		result = append(result, *h)
	}

	return result, nil
}

// ─── HSN Summary (Purchases) ───────────────────────────────────────────────

type HSNPurchaseRecord struct {
	HSNCode          string          `json:"hsnCode"`
	Description      string          `json:"description"`
	UOM              string          `json:"uom"`
	TotalOrderedQty  decimal.Decimal `json:"totalOrderedQty"`
	TotalReceivedQty decimal.Decimal `json:"totalReceivedQty"`
	TotalValue       decimal.Decimal `json:"totalValue"`
	TaxableValue     decimal.Decimal `json:"taxableValue"`
	CGST             decimal.Decimal `json:"cgst"`
	SGST             decimal.Decimal `json:"sgst"`
	TotalTax         decimal.Decimal `json:"totalTax"`
}

func (gs *GSTService) HSNPurchaseSummary(outletId int, from, to time.Time) ([]HSNPurchaseRecord, error) {
	var bills []models.PurchaseBill
	if err := gs.db.Where("outlet_id = ? AND bill_date >= ? AND bill_date <= ?", outletId, from, to).
		Preload("Items.Product.TaxGroup").
		Find(&bills).Error; err != nil {
		return nil, err
	}

	hsnMap := make(map[string]*HSNPurchaseRecord)

	for _, bill := range bills {
		isIntra := bill.SupplyType == "INTRA_STATE"

		for _, item := range bill.Items {
			hsn := ""
			if item.Product != nil && item.Product.TaxGroup != nil && item.Product.TaxGroup.HSNCode != nil {
				hsn = *item.Product.TaxGroup.HSNCode
			}
			if hsn == "" {
				hsn = "NO_HSN"
			}

			if _, exists := hsnMap[hsn]; !exists {
				uom := "Pcs"
				desc := "Unknown"
				if item.Product != nil {
					uom = item.Product.UnitOfMeasure
					desc = item.Product.Name
				}
				hsnMap[hsn] = &HSNPurchaseRecord{
					HSNCode:          hsn,
					Description:      desc,
					UOM:              uom,
					TotalOrderedQty:  decimal.Zero,
					TotalReceivedQty: decimal.Zero,
					TotalValue:       decimal.Zero,
					TaxableValue:     decimal.Zero,
					CGST:             decimal.Zero,
					SGST:             decimal.Zero,
					TotalTax:         decimal.Zero,
				}
			}

			taxable := item.Quantity.Mul(item.UnitCost)
			tax := taxable.Mul(item.TaxRate).Div(decimal.NewFromInt(100)).Round(2)
			cgst := decimal.Zero
			sgst := decimal.Zero

			if isIntra {
				cgst = tax.Div(decimal.NewFromInt(2)).Round(2)
				sgst = tax.Sub(cgst)
			}

			hsnMap[hsn].TotalOrderedQty = hsnMap[hsn].TotalOrderedQty.Add(item.Quantity)
			hsnMap[hsn].TotalReceivedQty = hsnMap[hsn].TotalReceivedQty.Add(item.Quantity)
			hsnMap[hsn].TotalValue = hsnMap[hsn].TotalValue.Add(item.LineTotal)
			hsnMap[hsn].TaxableValue = hsnMap[hsn].TaxableValue.Add(taxable)
			hsnMap[hsn].CGST = hsnMap[hsn].CGST.Add(cgst)
			hsnMap[hsn].SGST = hsnMap[hsn].SGST.Add(sgst)
			hsnMap[hsn].TotalTax = hsnMap[hsn].TotalTax.Add(tax)
		}
	}

	result := make([]HSNPurchaseRecord, 0, len(hsnMap))
	for _, h := range hsnMap {
		result = append(result, *h)
	}

	return result, nil
}

// ─── CSV Exports ───────────────────────────────────────────────────────────

func (gs *GSTService) ExportGSTR1(outletId int, from, to time.Time) (string, error) {
	data, err := gs.GSTR1(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Type,GSTIN,Customer,Invoice #,Date,Invoice Value,Taxable Value,CGST,SGST,IGST\n")

	for _, r := range data.B2B {
		sb.WriteString(fmt.Sprintf("B2B,%s,\"%s\",%s,%s,%s,%s,%s,%s,%s\n",
			r.GSTIN, r.CustomerName, r.InvoiceNumber, r.InvoiceDate, r.InvoiceValue.String(),
			r.TaxableValue.String(), r.CGST.String(), r.SGST.String(), r.IGST.String()))
	}

	for _, r := range data.B2CS {
		sb.WriteString(fmt.Sprintf("B2CS,,,GST %s%%,,,,%s,%s,%s,%s\n",
			r.TaxRate, r.TaxableValue.String(), r.CGST.String(), r.SGST.String(), r.IGST.String()))
	}

	return "\uFEFF" + sb.String(), nil
}

func (gs *GSTService) ExportGSTR3B(outletId int, from, to time.Time) (string, error) {
	data, err := gs.GSTR3B(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("Section,Description,IGST,CGST,SGST,Cess\n")
	sb.WriteString(fmt.Sprintf("3.1(a),Outward Taxable Supplies,%s,%s,%s,0\n",
		data.Section3_1_Taxable.IGST.String(), data.Section3_1_Taxable.CGST.String(), data.Section3_1_Taxable.SGST.String()))
	sb.WriteString(fmt.Sprintf("4(A)(5),Eligible ITC from Purchase Bills,%s,%s,%s,0\n",
		data.Section4_ITC.IGST.String(), data.Section4_ITC.CGST.String(), data.Section4_ITC.SGST.String()))
	sb.WriteString(fmt.Sprintf("Net,Net Tax Payable,%s,%s,%s,0\n",
		data.NetTaxPayable.IGST.String(), data.NetTaxPayable.CGST.String(), data.NetTaxPayable.SGST.String()))

	return "\uFEFF" + sb.String(), nil
}

func (gs *GSTService) ExportHSNSummary(outletId int, from, to time.Time) (string, error) {
	rows, err := gs.HSNSummary(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("HSN Code,Description,UOM,Qty,Total Value,Taxable Value,CGST,SGST,IGST,Total Tax\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("%s,\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.HSNCode, r.Description, r.UOM, r.TotalQuantity.String(), r.TotalValue.String(),
			r.TaxableValue.String(), r.CGST.String(), r.SGST.String(), r.IGST.String(), r.TotalTax.String()))
	}

	return "\uFEFF" + sb.String(), nil
}

func (gs *GSTService) ExportHSNPurchaseSummary(outletId int, from, to time.Time) (string, error) {
	rows, err := gs.HSNPurchaseSummary(outletId, from, to)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	sb.WriteString("HSN Code,Description,UOM,Ordered Qty,Received Qty,Total Value,Taxable Value,CGST,SGST,Total Tax\n")

	for _, r := range rows {
		sb.WriteString(fmt.Sprintf("%s,\"%s\",%s,%s,%s,%s,%s,%s,%s,%s\n",
			r.HSNCode, r.Description, r.UOM, r.TotalOrderedQty.String(), r.TotalReceivedQty.String(),
			r.TotalValue.String(), r.TaxableValue.String(), r.CGST.String(), r.SGST.String(), r.TotalTax.String()))
	}

	return "\uFEFF" + sb.String(), nil
}

// ─── Tally Export ──────────────────────────────────────────────────────────

func (gs *GSTService) TallyExport(outletId int, from, to time.Time) (string, error) {
	outlet := &models.Outlet{}
	if err := gs.db.First(outlet, outletId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", fmt.Errorf("outlet not found")
		}
		return "", err
	}

	var orders []models.Order
	if err := gs.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		outletId, "COMPLETED", from, to).
		Preload("Items").
		Preload("Customer").
		Find(&orders).Error; err != nil {
		return "", err
	}

	var vouchers strings.Builder
	for _, o := range orders {
		customerName := "Cash"
		if o.Customer != nil {
			customerName = o.Customer.Name
		}

		tax := o.TaxAmount
		cgst := tax.Div(decimal.NewFromInt(2)).Round(2)
		sgst := tax.Sub(cgst)
		taxableValue := o.Subtotal.Sub(o.DiscountAmount)

		vouchers.WriteString(fmt.Sprintf(`
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>%s</DATE>
        <PARTYLEDGERNAME>%s</PARTYLEDGERNAME>
        <VOUCHERNUMBER>%s</VOUCHERNUMBER>
        <AMOUNT>%s</AMOUNT>
        <TAXABLEVALUE>%s</TAXABLEVALUE>
        <CGST>%s</CGST>
        <SGST>%s</SGST>
      </VOUCHER>`,
			o.CreatedAt.Format("20060102"),
			customerName,
			o.OrderNumber,
			o.TotalAmount.String(),
			taxableValue.String(),
			cgst.String(),
			sgst.String(),
		))
	}

	xml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>%s</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>%s
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`, outlet.Name, vouchers.String())

	return xml, nil
}
