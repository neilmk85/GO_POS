package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type SalesOrderService struct {
	db *gorm.DB
}

func NewSalesOrderService(db *gorm.DB) *SalesOrderService {
	return &SalesOrderService{db: db}
}

type SalesOrderCreateRequest struct {
	CustomerID      int                        `json:"customerId"`
	OutletID        *int                       `json:"outletId,omitempty"`
	CustomerPONumber *string                   `json:"customerPoNumber,omitempty"`
	OrderDate       *time.Time                 `json:"orderDate,omitempty"`
	RequiredDate    *time.Time                 `json:"requiredDate,omitempty"`
	PaymentTerms    *string                    `json:"paymentTerms,omitempty"`
	ShippingAddress *string                    `json:"shippingAddress,omitempty"`
	ShippingCity    *string                    `json:"shippingCity,omitempty"`
	ShippingState   *string                    `json:"shippingState,omitempty"`
	Notes           *string                    `json:"notes,omitempty"`
	TermsConditions *string                    `json:"termsConditions,omitempty"`
	ShippingAmount  *decimal.Decimal           `json:"shippingAmount,omitempty"`
	AdvanceAmount   *decimal.Decimal           `json:"advanceAmount,omitempty"`
	Items           []SalesOrderItemRequest    `json:"items"`
}

type SalesOrderItemRequest struct {
	ProductID       int              `json:"productId"`
	VariantID       *int             `json:"variantId,omitempty"`
	ProductName     string           `json:"productName"`
	SKU             *string          `json:"sku,omitempty"`
	Quantity        decimal.Decimal  `json:"quantity"`
	UnitPrice       decimal.Decimal  `json:"unitPrice"`
	DiscountPercent *decimal.Decimal `json:"discountPercent,omitempty"`
	TaxRate         *decimal.Decimal `json:"taxRate,omitempty"`
	Notes           *string          `json:"notes,omitempty"`
}

type SalesOrderUpdateRequest struct {
	CustomerID      *int                       `json:"customerId,omitempty"`
	CustomerPONumber *string                   `json:"customerPoNumber,omitempty"`
	OrderDate       *time.Time                 `json:"orderDate,omitempty"`
	RequiredDate    *time.Time                 `json:"requiredDate,omitempty"`
	PaymentTerms    *string                    `json:"paymentTerms,omitempty"`
	ShippingAddress *string                    `json:"shippingAddress,omitempty"`
	ShippingCity    *string                    `json:"shippingCity,omitempty"`
	ShippingState   *string                    `json:"shippingState,omitempty"`
	Notes           *string                    `json:"notes,omitempty"`
	TermsConditions *string                    `json:"termsConditions,omitempty"`
	ShippingAmount  *decimal.Decimal           `json:"shippingAmount,omitempty"`
	AdvanceAmount   *decimal.Decimal           `json:"advanceAmount,omitempty"`
	Items           []SalesOrderItemRequest    `json:"items,omitempty"`
}

// GetAll retrieves paginated sales orders with filters
func (sos *SalesOrderService) GetAll(
	outletID *int,
	customerID *int,
	status *string,
	from, to *time.Time,
	page, size int,
) ([]models.SalesOrder, int64, error) {
	query := sos.db.Preload("Customer").Preload("Outlet").Preload("Items")

	if outletID != nil {
		query = query.Where("outlet_id = ?", *outletID)
	}
	if customerID != nil {
		query = query.Where("customer_id = ?", *customerID)
	}
	if status != nil && *status != "ALL" {
		query = query.Where("status = ?", *status)
	}
	if from != nil && to != nil {
		query = query.Where("order_date BETWEEN ? AND ?", from, to)
	}

	var total int64
	if err := query.Model(&models.SalesOrder{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []models.SalesOrder
	if err := query.Order("created_at DESC").
		Offset(page * size).
		Limit(size).
		Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

// GetByID retrieves a sales order with all related data
func (sos *SalesOrderService) GetByID(id int) (*models.SalesOrder, error) {
	so := &models.SalesOrder{}
	if err := sos.db.Preload("Customer").
		Preload("Outlet").
		Preload("CreatedByUser").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("id ASC")
		}).
		First(so, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Sales Order with ID %d not found", id)}
		}
		return nil, err
	}
	return so, nil
}

// Create creates a new sales order with items
func (sos *SalesOrderService) Create(req SalesOrderCreateRequest) (*models.SalesOrder, error) {
	if req.CustomerID == 0 {
		return nil, &util.BusinessException{Message: "Customer is required"}
	}
	if len(req.Items) == 0 {
		return nil, &util.BusinessException{Message: "At least one item is required"}
	}

	// Verify customer exists and is not blacklisted
	customer := &models.Customer{}
	if err := sos.db.First(customer, req.CustomerID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with ID %d not found", req.CustomerID)}
		}
		return nil, err
	}

	if customer.Blacklisted {
		return nil, &util.BusinessException{Message: "Customer is blacklisted"}
	}

	// Calculate totals
	calc := calculateSOTotals(req.Items)

	shippingAmount := decimal.Zero
	if req.ShippingAmount != nil {
		shippingAmount = *req.ShippingAmount
	}

	total := calc.Subtotal.Sub(calc.DiscountAmount).Add(calc.TaxAmount).Add(shippingAmount)

	// Check credit limit
	if customer.CreditLimit.GreaterThan(decimal.Zero) {
		available := customer.CreditLimit.Sub(customer.OutstandingDue)
		if total.GreaterThan(available) {
			return nil, &util.BusinessException{
				Message: fmt.Sprintf(
					"Order total ₹%s exceeds available credit limit ₹%s",
					total.String(), available.String(),
				),
			}
		}
	}

	// Generate SO number
	soNum, err := util.GenerateSONumber(sos.db)
	if err != nil {
		return nil, err
	}

	// Create sales order
	advanceAmount := decimal.Zero
	if req.AdvanceAmount != nil {
		advanceAmount = *req.AdvanceAmount
	}

	so := &models.SalesOrder{
		SONumber:        soNum,
		CustomerID:      req.CustomerID,
		OutletID:        *req.OutletID,
		CreatedByUserID: nil, // Will be set by handler from context
		CustomerPONumber: req.CustomerPONumber,
		OrderDate:       time.Now(),
		RequiredDate:    req.RequiredDate,
		Subtotal:        calc.Subtotal,
		DiscountAmount:  calc.DiscountAmount,
		TaxAmount:       calc.TaxAmount,
		ShippingAmount:  shippingAmount,
		TotalAmount:     total,
		AdvanceAmount:   advanceAmount,
		PaymentTerms:    req.PaymentTerms,
		ShippingAddress: req.ShippingAddress,
		ShippingCity:    req.ShippingCity,
		ShippingState:   req.ShippingState,
		Notes:           req.Notes,
		TermsConditions: req.TermsConditions,
		Status:          models.SalesOrderStatusDraft,
	}

	// Create items
	for _, itemReq := range req.Items {
		discountPercent := decimal.Zero
		if itemReq.DiscountPercent != nil {
			discountPercent = *itemReq.DiscountPercent
		}
		taxRate := decimal.Zero
		if itemReq.TaxRate != nil {
			taxRate = *itemReq.TaxRate
		}

		item := models.SalesOrderItem{
			ProductID:       itemReq.ProductID,
			VariantID:       itemReq.VariantID,
			ProductName:     itemReq.ProductName,
			SKU:             itemReq.SKU,
			Quantity:        itemReq.Quantity,
			UnitPrice:       itemReq.UnitPrice,
			DiscountPercent: discountPercent,
			TaxRate:         taxRate,
			Notes:           itemReq.Notes,
		}

		// Calculate line amounts
		lineSubtotal := itemReq.Quantity.Mul(itemReq.UnitPrice)
		lineDiscount := lineSubtotal.Mul(*itemReq.DiscountPercent).Div(decimal.NewFromInt(100))
		lineBase := lineSubtotal.Sub(lineDiscount)
		lineTax := lineBase.Mul(*itemReq.TaxRate).Div(decimal.NewFromInt(100))
		item.DiscountAmount = lineDiscount
		item.TaxAmount = lineTax
		item.LineTotal = lineBase.Add(lineTax)
		item.DeliveredQuantity = decimal.Zero
		item.InvoicedQuantity = decimal.Zero

		so.Items = append(so.Items, item)
	}

	if err := sos.db.Create(so).Error; err != nil {
		return nil, err
	}

	// Reload with relationships
	return sos.GetByID(so.ID)
}

// Update updates a sales order (DRAFT only)
func (sos *SalesOrderService) Update(id int, req SalesOrderUpdateRequest) (*models.SalesOrder, error) {
	so := &models.SalesOrder{}
	if err := sos.db.First(so, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Sales Order with ID %d not found", id)}
		}
		return nil, err
	}

	if so.Status != models.SalesOrderStatusDraft {
		return nil, &util.BusinessException{Message: "Only DRAFT sales orders can be edited"}
	}

	// Update basic fields
	if req.CustomerID != nil {
		so.CustomerID = *req.CustomerID
	}
	if req.CustomerPONumber != nil {
		so.CustomerPONumber = req.CustomerPONumber
	}
	if req.OrderDate != nil {
		so.OrderDate = *req.OrderDate
	}
	if req.RequiredDate != nil {
		so.RequiredDate = req.RequiredDate
	}
	if req.PaymentTerms != nil {
		so.PaymentTerms = req.PaymentTerms
	}
	if req.ShippingAddress != nil {
		so.ShippingAddress = req.ShippingAddress
	}
	if req.ShippingCity != nil {
		so.ShippingCity = req.ShippingCity
	}
	if req.ShippingState != nil {
		so.ShippingState = req.ShippingState
	}
	if req.Notes != nil {
		so.Notes = req.Notes
	}
	if req.TermsConditions != nil {
		so.TermsConditions = req.TermsConditions
	}

	// Handle items if provided
	if len(req.Items) > 0 {
		if err := sos.db.Where("sales_order_id = ?", id).Delete(&models.SalesOrderItem{}).Error; err != nil {
			return nil, err
		}

		calc := calculateSOTotals(req.Items)
		so.Subtotal = calc.Subtotal
		so.DiscountAmount = calc.DiscountAmount
		so.TaxAmount = calc.TaxAmount

		shippingAmount := so.ShippingAmount
		if req.ShippingAmount != nil {
			shippingAmount = *req.ShippingAmount
		}
		so.ShippingAmount = shippingAmount
		so.TotalAmount = calc.Subtotal.Sub(calc.DiscountAmount).Add(calc.TaxAmount).Add(shippingAmount)

		// Recreate items
		for _, itemReq := range req.Items {
			discountPercent := decimal.Zero
			if itemReq.DiscountPercent != nil {
				discountPercent = *itemReq.DiscountPercent
			}
			taxRate := decimal.Zero
			if itemReq.TaxRate != nil {
				taxRate = *itemReq.TaxRate
			}

			item := models.SalesOrderItem{
				SalesOrderID:    so.ID,
				ProductID:       itemReq.ProductID,
				VariantID:       itemReq.VariantID,
				ProductName:     itemReq.ProductName,
				SKU:             itemReq.SKU,
				Quantity:        itemReq.Quantity,
				UnitPrice:       itemReq.UnitPrice,
				DiscountPercent: discountPercent,
				TaxRate:         taxRate,
				Notes:           itemReq.Notes,
			}

			lineSubtotal := itemReq.Quantity.Mul(itemReq.UnitPrice)
			lineDiscount := lineSubtotal.Mul(*itemReq.DiscountPercent).Div(decimal.NewFromInt(100))
			lineBase := lineSubtotal.Sub(lineDiscount)
			lineTax := lineBase.Mul(*itemReq.TaxRate).Div(decimal.NewFromInt(100))
			item.DiscountAmount = lineDiscount
			item.TaxAmount = lineTax
			item.LineTotal = lineBase.Add(lineTax)
			item.DeliveredQuantity = decimal.Zero
			item.InvoicedQuantity = decimal.Zero

			if err := sos.db.Create(&item).Error; err != nil {
				return nil, err
			}
		}
	} else {
		// Update shipping/advance only if items not changed
		if req.ShippingAmount != nil {
			so.ShippingAmount = *req.ShippingAmount
			so.TotalAmount = so.Subtotal.Sub(so.DiscountAmount).Add(so.TaxAmount).Add(*req.ShippingAmount)
		}
	}

	if req.AdvanceAmount != nil {
		so.AdvanceAmount = *req.AdvanceAmount
	}

	if err := sos.db.Save(so).Error; err != nil {
		return nil, err
	}

	return sos.GetByID(so.ID)
}

// Helper to calculate totals
type soCalculation struct {
	Subtotal      decimal.Decimal
	DiscountAmount decimal.Decimal
	TaxAmount     decimal.Decimal
}

func calculateSOTotals(items []SalesOrderItemRequest) soCalculation {
	var subtotal, discountAmount, taxAmount decimal.Decimal

	for _, item := range items {
		qty := item.Quantity
		price := item.UnitPrice
		disc := decimal.Zero
		if item.DiscountPercent != nil {
			disc = *item.DiscountPercent
		}
		tax := decimal.Zero
		if item.TaxRate != nil {
			tax = *item.TaxRate
		}

		lineSub := qty.Mul(price)
		lineDisc := lineSub.Mul(disc).Div(decimal.NewFromInt(100))
		lineBase := lineSub.Sub(lineDisc)
		lineTax := lineBase.Mul(tax).Div(decimal.NewFromInt(100))

		subtotal = subtotal.Add(lineSub)
		discountAmount = discountAmount.Add(lineDisc)
		taxAmount = taxAmount.Add(lineTax)
	}

	return soCalculation{
		Subtotal:       subtotal,
		DiscountAmount: discountAmount,
		TaxAmount:      taxAmount,
	}
}
