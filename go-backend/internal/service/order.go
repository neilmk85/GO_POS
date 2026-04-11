package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type OrderService struct {
	db *gorm.DB
}

func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{db: db}
}

type CartItemRequest struct {
	ProductID      int              `json:"productId"`
	VariantID      *int             `json:"variantId,omitempty"`
	Quantity       decimal.Decimal  `json:"quantity"`
	UnitPrice      *decimal.Decimal `json:"unitPrice,omitempty"`
	DiscountPercent *decimal.Decimal `json:"discountPercent,omitempty"`
	Notes          *string          `json:"notes,omitempty"`
}

type PaymentRequest struct {
	PaymentMethod   string          `json:"paymentMethod"`
	Amount          decimal.Decimal `json:"amount"`
	ReferenceNumber *string         `json:"referenceNumber,omitempty"`
	CreditNoteID    *int            `json:"creditNoteId,omitempty"`
}

type CheckoutRequest struct {
	OutletID                int                `json:"outletId"`
	CashierID               int                `json:"cashierId"`
	ShiftID                 *int               `json:"shiftId,omitempty"`
	CustomerID              *int               `json:"customerId,omitempty"`
	Items                   []CartItemRequest  `json:"items"`
	Payments                []PaymentRequest   `json:"payments"`
	CouponCode              *string            `json:"couponCode,omitempty"`
	BillDiscountAmount      *decimal.Decimal   `json:"billDiscountAmount,omitempty"`
	BillDiscountPercent     *decimal.Decimal   `json:"billDiscountPercent,omitempty"`
	LoyaltyPointsToRedeem   *decimal.Decimal   `json:"loyaltyPointsToRedeem,omitempty"`
	DiscountReason          *string            `json:"discountReason,omitempty"`
	Notes                   *string            `json:"notes,omitempty"`
	SendEmailReceipt        bool               `json:"sendEmailReceipt,omitempty"`
	SendSmsReceipt          bool               `json:"sendSmsReceipt,omitempty"`
	SendWhatsappReceipt     bool               `json:"sendWhatsappReceipt,omitempty"`
}

type ReturnItemRequest struct {
	OrderItemID    int     `json:"orderItemId"`
	ReturnQuantity decimal.Decimal `json:"returnQuantity"`
	Reason         *string `json:"reason,omitempty"`
}

type ReturnRequest struct {
	OriginalOrderID int                 `json:"originalOrderId"`
	Items           []ReturnItemRequest `json:"items"`
	ReturnMethod    *string             `json:"returnMethod,omitempty"`
	Reason          *string             `json:"reason,omitempty"`
	Notes           *string             `json:"notes,omitempty"`
}

type CheckoutResponse struct {
	OrderID       int             `json:"orderId"`
	OrderNumber   string          `json:"orderNumber"`
	InvoiceID     int             `json:"invoiceId"`
	InvoiceNumber string          `json:"invoiceNumber"`
	TotalAmount   decimal.Decimal `json:"totalAmount"`
	PaidAmount    decimal.Decimal `json:"paidAmount"`
	ChangeAmount  decimal.Decimal `json:"changeAmount"`
}

func (os *OrderService) Checkout(req CheckoutRequest) (CheckoutResponse, error) {
	var response CheckoutResponse

	// Use transaction for checkout
	err := os.db.Transaction(func(tx *gorm.DB) error {
		// 1. Validate outlet
		outlet := &models.Outlet{}
		if err := tx.First(outlet, req.OutletID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return &util.ResourceNotFoundException{Message: fmt.Sprintf("Outlet with ID %d not found", req.OutletID)}
			}
			return err
		}

		// 2. Validate cashier
		cashier := &models.User{}
		if err := tx.First(cashier, req.CashierID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return &util.ResourceNotFoundException{Message: fmt.Sprintf("User with ID %d not found", req.CashierID)}
			}
			return err
		}

		// 3. Validate customer if provided
		var customer *models.Customer
		if req.CustomerID != nil {
			customer = &models.Customer{}
			if err := tx.First(customer, *req.CustomerID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with ID %d not found", *req.CustomerID)}
				}
				return err
			}
		}

		// 4. Validate shift if provided
		var shift *models.Shift
		if req.ShiftID != nil {
			shift = &models.Shift{}
			if err := tx.First(shift, *req.ShiftID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &util.ResourceNotFoundException{Message: fmt.Sprintf("Shift with ID %d not found", *req.ShiftID)}
				}
				return err
			}
		}

		// 5. Process items and calculate totals
		subtotal := decimal.Zero
		totalDiscount := decimal.Zero
		totalTax := decimal.Zero
		var itemData []models.OrderItem

		for _, itemReq := range req.Items {
			// Validate product
			product := &models.Product{}
			if err := tx.Preload("TaxGroup").First(product, itemReq.ProductID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", itemReq.ProductID)}
				}
				return err
			}

			// Resolve price: explicit override → price list → product default
			resolvedPrice := product.SellingPrice
			if customer != nil {
				resolvedPrice = os.resolvePriceFromList(tx, product.ID, itemReq.VariantID, customer.ID, resolvedPrice)
			}

			unitPrice := resolvedPrice
			if itemReq.UnitPrice != nil && itemReq.UnitPrice.GreaterThan(decimal.Zero) {
				unitPrice = *itemReq.UnitPrice
			}

			// Check minimum selling price
			if product.MinSellingPrice != nil && unitPrice.LessThan(*product.MinSellingPrice) {
				return &util.BusinessException{
					Message: fmt.Sprintf("Price below minimum for product: %s", product.Name),
				}
			}

			quantity := itemReq.Quantity
			lineTotal := unitPrice.Mul(quantity)

			// Calculate auto discounts
			autoDiscount, err := os.calculateItemDiscount(tx, product.ID, quantity, unitPrice)
			if err != nil {
				return err
			}

			manualDiscount := decimal.Zero
			if itemReq.DiscountPercent != nil && itemReq.DiscountPercent.GreaterThan(decimal.Zero) {
				manualDiscount = lineTotal.Mul(*itemReq.DiscountPercent).Div(decimal.NewFromInt(100)).RoundBank(2)
			}

			itemDiscount := autoDiscount
			if manualDiscount.GreaterThan(autoDiscount) {
				itemDiscount = manualDiscount
			}

			discountedTotal := lineTotal.Sub(itemDiscount)

			// Calculate tax
			var taxRate decimal.Decimal
			var taxAmount decimal.Decimal
			if product.TaxGroup != nil {
				taxRate = product.TaxGroup.TotalRate
				if product.TaxGroup.Inclusive {
					taxAmount = discountedTotal.Mul(taxRate).Div(decimal.NewFromInt(100).Add(taxRate)).RoundBank(2)
				} else {
					taxAmount = discountedTotal.Mul(taxRate).Div(decimal.NewFromInt(100)).RoundBank(2)
				}
			}

			var finalLineTotal decimal.Decimal
			if product.TaxGroup != nil && !product.TaxGroup.Inclusive {
				finalLineTotal = discountedTotal.Add(taxAmount)
			} else {
				finalLineTotal = discountedTotal
			}

			itemData = append(itemData, models.OrderItem{
				ProductID:      product.ID,
				VariantID:       itemReq.VariantID,
				ProductName:     product.Name,
				SKU:             product.SKU,
				Quantity:        quantity,
				UnitPrice:       unitPrice,
				CostPrice:       product.CostPrice,
				DiscountAmount:  itemDiscount,
				TaxRate:         taxRate,
				TaxAmount:       taxAmount,
				LineTotal:       finalLineTotal,
				Notes:           itemReq.Notes,
			})

			subtotal = subtotal.Add(lineTotal)
			totalDiscount = totalDiscount.Add(itemDiscount)
			totalTax = totalTax.Add(taxAmount)

			// Deduct inventory if tracked
			if product.TrackInventory {
				saleFactor := product.SaleFactor
				if saleFactor.Equal(decimal.Zero) {
					saleFactor = decimal.NewFromInt(1)
				}
				deductQty := quantity.Mul(saleFactor)

				inventory := &models.Inventory{}
				result := tx.Where("product_id = ? AND outlet_id = ? AND variant_id IS NULL", product.ID, req.OutletID).First(inventory)
				if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
					return result.Error
				}
				if result.Error == gorm.ErrRecordNotFound {
					return &util.BusinessException{Message: fmt.Sprintf("No inventory for product %s at outlet", product.Name)}
				}

				newQty := inventory.QuantityOnHand.Sub(deductQty)
				if newQty.LessThan(decimal.Zero) {
					return &util.BusinessException{Message: fmt.Sprintf("Insufficient stock for product: %s", product.Name)}
				}

				if err := tx.Model(inventory).Update("quantity_on_hand", newQty).Error; err != nil {
					return err
				}
			}
		}

		// 6. Apply coupon discount
		couponDiscount := decimal.Zero
		var couponCode *string
		if req.CouponCode != nil {
			afterItemDiscount := subtotal.Sub(totalDiscount)
			coupon := &models.Coupon{}
			if err := tx.Where("code = ?", *req.CouponCode).First(coupon).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return &util.BusinessException{Message: fmt.Sprintf("Coupon not found: %s", *req.CouponCode)}
				}
				return err
			}

			// Validate coupon
			now := util.Now()
			if !coupon.Active {
				return &util.BusinessException{Message: "Coupon is not active"}
			}
			if coupon.StartDate != nil && coupon.StartDate.After(*now) {
				return &util.BusinessException{Message: "Coupon not yet valid"}
			}
			if coupon.ExpiryDate != nil && coupon.ExpiryDate.Before(*now) {
				return &util.BusinessException{Message: "Coupon has expired"}
			}
			if coupon.UsageLimit != nil && coupon.TimesUsed >= *coupon.UsageLimit {
				return &util.BusinessException{Message: "Coupon usage limit reached"}
			}
			if afterItemDiscount.LessThan(coupon.MinOrderAmount) {
				return &util.BusinessException{
					Message: fmt.Sprintf("Minimum order amount of %s required for this coupon", coupon.MinOrderAmount.StringFixed(2)),
				}
			}
			if coupon.CustomerID != nil && customer != nil && *coupon.CustomerID != customer.ID {
				return &util.BusinessException{Message: "Coupon not valid for this customer"}
			}

			couponDiscount = os.applyCoupon(coupon, afterItemDiscount)
			couponCode = req.CouponCode

			// Mark coupon as used
			if err := tx.Model(coupon).Update("times_used", gorm.Expr("times_used + 1")).Error; err != nil {
				return err
			}
		}

		// 7. Apply bill-level discount
		billDiscount := decimal.Zero
		if req.BillDiscountAmount != nil {
			billDiscount = *req.BillDiscountAmount
		} else if req.BillDiscountPercent != nil {
			afterCoupon := subtotal.Sub(totalDiscount).Sub(couponDiscount)
			billDiscount = afterCoupon.Mul(*req.BillDiscountPercent).Div(decimal.NewFromInt(100)).RoundBank(2)
		}

		// 8. Calculate final totals
		totalDiscountFinal := totalDiscount.Add(couponDiscount).Add(billDiscount)
		totalAfterDiscount := subtotal.Sub(totalDiscountFinal)
		totalAmount := totalAfterDiscount.Add(totalTax)

		// 9. Apply loyalty redemption
		loyaltyDiscount := decimal.Zero
		if req.LoyaltyPointsToRedeem != nil && req.LoyaltyPointsToRedeem.GreaterThan(decimal.Zero) && customer != nil {
			loyaltyDiscount = req.LoyaltyPointsToRedeem.Div(decimal.NewFromInt(10)).RoundBank(2)
			totalAmount = totalAmount.Sub(loyaltyDiscount)

			if err := tx.Model(customer).Update("loyalty_points", gorm.Expr("loyalty_points - ?", req.LoyaltyPointsToRedeem)).Error; err != nil {
				return err
			}
		}

		if totalAmount.LessThan(decimal.Zero) {
			totalAmount = decimal.Zero
		}

		// 10. Process payments
		totalPaid := decimal.Zero
		var paymentData []models.Payment

		for _, payReq := range req.Payments {
			if payReq.PaymentMethod == "CREDIT_NOTE" && payReq.CreditNoteID != nil {
				cn := &models.CreditNote{}
				if err := tx.First(cn, *payReq.CreditNoteID).Error; err != nil {
					return err
				}

				newRemaining := cn.RemainingAmount.Sub(payReq.Amount)
				newUsed := cn.UsedAmount.Add(payReq.Amount)
				newStatus := "ACTIVE"
				if newRemaining.LessThanOrEqual(decimal.Zero) {
					newStatus = "FULLY_USED"
				}

				if err := tx.Model(cn).Updates(map[string]interface{}{
					"used_amount":      newUsed,
					"remaining_amount": newRemaining,
					"status":           newStatus,
				}).Error; err != nil {
					return err
				}
			}

			paymentData = append(paymentData, models.Payment{
				PaymentMethod:   models.PaymentMethod(payReq.PaymentMethod),
				Amount:          payReq.Amount,
				ReferenceNumber: payReq.ReferenceNumber,
				Status:          models.PaymentStatusCompleted,
				CreditNoteID:    payReq.CreditNoteID,
			})

			totalPaid = totalPaid.Add(payReq.Amount)
		}

		changeAmount := totalPaid.Sub(totalAmount)
		if changeAmount.LessThan(decimal.Zero) {
			changeAmount = decimal.Zero
		}

		// Determine order type (credit sale or regular)
		isCredit := false
		for _, p := range paymentData {
			if p.PaymentMethod == "CREDIT_SALE" {
				isCredit = true
				break
			}
		}

		// 11. Generate order number
		outletCode := ""
		if outlet.Code != nil {
			outletCode = *outlet.Code
		}
		orderNum, err := util.GenerateOrderNumber(tx, outletCode)
		if err != nil {
			return err
		}

		// 12. Create order
		order := &models.Order{
			OrderNumber:    orderNum,
			OutletID:       req.OutletID,
			CashierID:      req.CashierID,
			ShiftID:        req.ShiftID,
			CustomerID:     req.CustomerID,
			Status:         models.OrderStatusCompleted,
			Subtotal:       subtotal,
			DiscountAmount: totalDiscountFinal,
			TaxAmount:      totalTax,
			TotalAmount:    totalAmount,
			PaidAmount:     totalPaid,
			ChangeAmount:   changeAmount,
			CouponCode:     couponCode,
			DiscountReason: req.DiscountReason,
			Notes:          req.Notes,
		}

		if isCredit {
			order.OrderType = models.OrderTypeCreditSale
		} else {
			order.OrderType = models.OrderTypeSale
		}

		// Set payment items
		order.Payments = paymentData
		order.Items = itemData

		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// 13. Handle customer updates if provided
		if customer != nil {
			// Update credit outstanding
			creditAmount := decimal.Zero
			for _, p := range paymentData {
				if p.PaymentMethod == "CREDIT_SALE" {
					creditAmount = creditAmount.Add(p.Amount)
				}
			}
			if creditAmount.GreaterThan(decimal.Zero) {
				if err := tx.Model(customer).Update("outstanding_due", gorm.Expr("outstanding_due + ?", creditAmount)).Error; err != nil {
					return err
				}
			}

			// Calculate and add loyalty points
			pointsEarned := totalAmount.Mul(decimal.NewFromFloat(0.01)).RoundBank(0)
			if pointsEarned.GreaterThan(decimal.Zero) {
				if err := tx.Model(customer).Update("loyalty_points", gorm.Expr("loyalty_points + ?", pointsEarned)).Error; err != nil {
					return err
				}

				loyaltyTx := &models.LoyaltyTransaction{
					CustomerID:  customer.ID,
					OrderID:     &order.ID,
					Points:      pointsEarned,
					Type:        "EARNED",
					Description: stringPtr(fmt.Sprintf("Points earned on order %s", order.OrderNumber)),
				}
				if err := tx.Create(loyaltyTx).Error; err != nil {
					return err
				}
			}

			// Update total spent
			if err := tx.Model(customer).Update("total_spent", gorm.Expr("total_spent + ?", totalAmount)).Error; err != nil {
				return err
			}

			// Update order with loyalty points earned
			order.LoyaltyPointsEarned = pointsEarned
			if err := tx.Model(order).Update("loyalty_points_earned", pointsEarned).Error; err != nil {
				return err
			}
		}

		// 14. Update shift totals if provided
		if shift != nil {
			if err := tx.Model(shift).Updates(map[string]interface{}{
				"total_sales":     gorm.Expr("total_sales + ?", totalAmount),
				"total_discounts": gorm.Expr("total_discounts + ?", totalDiscountFinal),
				"total_orders":    gorm.Expr("total_orders + 1"),
				"expected_cash":   gorm.Expr("expected_cash + ?", totalAmount),
			}).Error; err != nil {
				return err
			}
		}

		// 15. Create invoice from order
		invoiceNum, err := util.GenerateInvoiceNumber(tx)
		if err != nil {
			return err
		}

		invoice := &models.Invoice{
			InvoiceNumber: invoiceNum,
			OrderID:       &order.ID,
			CustomerID:    req.CustomerID,
			OutletID:      req.OutletID,
			IssueDate:     time.Now(),
			Status:        models.InvoiceStatusPaid,
			Subtotal:      order.Subtotal,
			DiscountAmount: order.DiscountAmount,
			TaxAmount:     order.TaxAmount,
			TotalAmount:   order.TotalAmount,
			PaidAmount:    order.PaidAmount,
		}

		// Create invoice items from order items
		for _, item := range itemData {
			pid := item.ProductID
			discPct := decimal.Zero
			lineVal := item.Quantity.Mul(item.UnitPrice)
			if lineVal.GreaterThan(decimal.Zero) {
				discPct = item.DiscountAmount.Div(lineVal).Mul(decimal.NewFromInt(100)).RoundBank(2)
			}
			invoice.Items = append(invoice.Items, models.InvoiceItem{
				ProductID:       &pid,
				ProductName:     item.ProductName,
				ProductSKU:      item.SKU,
				Quantity:        item.Quantity,
				UnitPrice:       item.UnitPrice,
				DiscountPercent: discPct,
				TaxRate:         item.TaxRate,
				LineTotal:       item.LineTotal,
			})
		}

		if err := tx.Create(invoice).Error; err != nil {
			return err
		}

		response = CheckoutResponse{
			OrderID:       order.ID,
			OrderNumber:   order.OrderNumber,
			InvoiceID:     invoice.ID,
			InvoiceNumber: invoice.InvoiceNumber,
			TotalAmount:   order.TotalAmount,
			PaidAmount:    order.PaidAmount,
			ChangeAmount:  order.ChangeAmount,
		}

		return nil
	})

	return response, err
}

func (os *OrderService) ProcessReturn(req ReturnRequest) (*models.Order, error) {
	var returnOrder *models.Order

	err := os.db.Transaction(func(tx *gorm.DB) error {
		// Get original order with items
		originalOrder := &models.Order{}
		if err := tx.Preload("Items").Preload("Outlet").Preload("Customer").Preload("Cashier").
			First(originalOrder, req.OriginalOrderID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return &util.ResourceNotFoundException{Message: fmt.Sprintf("Order with ID %d not found", req.OriginalOrderID)}
			}
			return err
		}

		returnTotal := decimal.Zero
		var returnItems []models.OrderItem

		// Process each return item
		for _, itemReq := range req.Items {
			// Find original item
			var originalItem *models.OrderItem
			for i := range originalOrder.Items {
				if originalOrder.Items[i].ID == itemReq.OrderItemID {
					originalItem = &originalOrder.Items[i]
					break
				}
			}
			if originalItem == nil {
				return &util.ResourceNotFoundException{Message: fmt.Sprintf("OrderItem with ID %d not found", itemReq.OrderItemID)}
			}

			returnedQty := originalItem.ReturnedQuantity
			available := originalItem.Quantity.Sub(returnedQty)
			if itemReq.ReturnQuantity.GreaterThan(available) {
				return &util.BusinessException{
					Message: fmt.Sprintf("Return quantity exceeds available for: %s", originalItem.ProductName),
				}
			}

			returnLineTotal := originalItem.UnitPrice.Mul(itemReq.ReturnQuantity)
			returnItems = append(returnItems, models.OrderItem{
				ProductID:   originalItem.ProductID,
				ProductName: originalItem.ProductName,
				Quantity:    itemReq.ReturnQuantity,
				UnitPrice:   originalItem.UnitPrice,
				LineTotal:   returnLineTotal,
				Notes:       itemReq.Reason,
			})
			returnTotal = returnTotal.Add(returnLineTotal)

			// Update original item's returned quantity
			newReturned := returnedQty.Add(itemReq.ReturnQuantity)
			if err := tx.Model(originalItem).Update("returned_quantity", newReturned).Error; err != nil {
				return err
			}

			// Get product for inventory check
			product := &models.Product{}
			if err := tx.First(product, originalItem.ProductID).Error; err != nil {
				return err
			}

			// Restock inventory if tracked
			if product.TrackInventory {
				inventory := &models.Inventory{}
				result := tx.Where("product_id = ? AND outlet_id = ?", product.ID, originalOrder.OutletID).
					First(inventory)
				if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
					return result.Error
				}
				if result.Error == gorm.ErrRecordNotFound {
					// Create new inventory record
					inventory = &models.Inventory{
						ProductID:       product.ID,
						OutletID:        originalOrder.OutletID,
						QuantityOnHand:  itemReq.ReturnQuantity,
					}
					if err := tx.Create(inventory).Error; err != nil {
						return err
					}
				} else {
					newQty := inventory.QuantityOnHand.Add(itemReq.ReturnQuantity)
					if err := tx.Model(inventory).Update("quantity_on_hand", newQty).Error; err != nil {
						return err
					}
				}
			}
		}

		// Generate return order number
		returnNum, err := util.GenerateOrderNumber(tx, "RET")
		if err != nil {
			return err
		}

		// Create return order
		returnOrder = &models.Order{
			OrderNumber:    returnNum,
			OutletID:       originalOrder.OutletID,
			CashierID:      originalOrder.CashierID,
			CustomerID:     originalOrder.CustomerID,
			Status:         models.OrderStatusCompleted,
			OrderType:      models.OrderTypeReturn,
			Subtotal:       returnTotal.Neg(),
			TotalAmount:    returnTotal.Neg(),
			Items:          returnItems,
		}

		// Create return payment
		returnMethod := "CASH"
		if req.ReturnMethod != nil {
			returnMethod = *req.ReturnMethod
		}

		returnOrder.Payments = []models.Payment{
			{
				PaymentMethod: models.PaymentMethod(returnMethod),
				Amount:        returnTotal,
				Status:        models.PaymentStatusRefunded,
				Notes:         req.Reason,
			},
		}

		if err := tx.Create(returnOrder).Error; err != nil {
			return err
		}

		// Create credit note if return method is CREDIT_NOTE
		if req.ReturnMethod != nil && *req.ReturnMethod == "CREDIT_NOTE" && originalOrder.Customer != nil {
			creditNoteNum, err := util.GenerateCreditNoteNumber(tx)
			if err != nil {
				return err
			}

			cn := &models.CreditNote{
				CreditNoteNumber: creditNoteNum,
				CustomerID:       originalOrder.Customer.ID,
				OriginalOrderID:  &originalOrder.ID,
				OutletID:         originalOrder.OutletID,
				TotalAmount:      returnTotal,
				RemainingAmount:  returnTotal,
				UsedAmount:       decimal.Zero,
				Reason:           req.Reason,
				Status:           models.CreditNoteStatusActive,
			}
			expiryDate := time.Now().AddDate(1, 0, 0)
			cn.ExpiryDate = &expiryDate

			if err := tx.Create(cn).Error; err != nil {
				return err
			}
		}

		// Determine new status for original order
		totalReturned := decimal.Zero
		totalOrdered := decimal.Zero

		for _, item := range originalOrder.Items {
			totalOrdered = totalOrdered.Add(item.Quantity)
			totalReturned = totalReturned.Add(item.ReturnedQuantity)
		}

		// Add current return items
		for _, item := range req.Items {
			totalReturned = totalReturned.Add(item.ReturnQuantity)
		}

		newStatus := models.OrderStatusPartiallyRefunded
		if totalReturned.GreaterThanOrEqual(totalOrdered) {
			newStatus = models.OrderStatusRefunded
		}

		if err := tx.Model(originalOrder).Update("status", newStatus).Error; err != nil {
			return err
		}

		return nil
	})

	return returnOrder, err
}

func (os *OrderService) GetByOrderNumber(orderNumber string) (*models.Order, error) {
	order := &models.Order{}
	err := os.db.Preload("Items").Preload("Items.Product").Preload("Items.Variant").
		Preload("Payments").Preload("Customer").Preload("Outlet").
		Preload("Cashier").Where("order_number = ?", orderNumber).First(order).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Order not found: %s", orderNumber)}
	}

	return order, err
}

func (os *OrderService) GetByOutlet(outletId int, page, size int, status *string, from, to *time.Time) ([]models.Order, int64, error) {
	query := os.db.Where("outlet_id = ?", outletId)

	if status != nil {
		query = query.Where("status = ?", *status)
	}

	if from != nil && to != nil {
		query = query.Where("created_at >= ? AND created_at <= ?", from, to)
	}

	var orders []models.Order
	var total int64

	if err := query.Model(&models.Order{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Items").Preload("Items.Product").
		Preload("Payments").Preload("Customer").
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&orders).Error

	return orders, total, err
}

func (os *OrderService) GetByCustomer(customerId int, page, size int) ([]models.Order, int64, error) {
	query := os.db.Where("customer_id = ?", customerId)

	var orders []models.Order
	var total int64

	if err := query.Model(&models.Order{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Preload("Items").Preload("Items.Product").
		Preload("Payments").
		Order("created_at DESC").
		Offset(offset).Limit(size).
		Find(&orders).Error

	return orders, total, err
}

func (os *OrderService) HoldOrder(orderId int) (*models.Order, error) {
	order := &models.Order{}
	if err := os.db.First(order, orderId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Order with ID %d not found", orderId)}
		}
		return nil, err
	}

	if err := os.db.Model(order).Update("status", models.OrderStatusHeld).Error; err != nil {
		return nil, err
	}

	return order, nil
}

// Helper methods
func (os *OrderService) resolvePriceFromList(tx *gorm.DB, productId int, variantId *int, customerId int, basePrice decimal.Decimal) decimal.Decimal {
	customer := &models.Customer{}
	if err := tx.First(customer, customerId).Error; err != nil {
		return basePrice
	}

	now := util.Now()

	priceLists := []models.PriceList{}
	query := tx.Where("active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now)

	if err := query.Preload("Items").Find(&priceLists).Error; err != nil {
		return basePrice
	}

	for _, pl := range priceLists {
		var item *models.PriceListItem
		for i := range pl.Items {
			if pl.Items[i].ProductID == productId {
				if variantId != nil && pl.Items[i].VariantID != nil && *pl.Items[i].VariantID == *variantId {
					item = &pl.Items[i]
					break
				} else if variantId == nil && pl.Items[i].VariantID == nil {
					item = &pl.Items[i]
					break
				}
			}
		}

		if item != nil {
			if item.SellingPrice != nil && item.SellingPrice.GreaterThan(decimal.Zero) {
				return *item.SellingPrice
			} else if item.DiscountPercent != nil && *item.DiscountPercent > 0 {
				return basePrice.Mul(decimal.NewFromInt(100).Sub(decimal.NewFromFloat(*item.DiscountPercent))).Div(decimal.NewFromInt(100)).RoundBank(2)
			}
		}
	}

	return basePrice
}

func (os *OrderService) calculateItemDiscount(tx *gorm.DB, productId int, quantity, unitPrice decimal.Decimal) (decimal.Decimal, error) {
	now := util.Now()
	discounts := []models.Discount{}

	if err := tx.Where("active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now).
		Order("priority DESC").
		Find(&discounts).Error; err != nil {
		return decimal.Zero, err
	}

	bestDiscount := decimal.Zero
	lineTotal := unitPrice.Mul(quantity)

	for _, d := range discounts {
		var discountAmount decimal.Decimal

		if d.ValueType == "PERCENTAGE" {
			discountAmount = lineTotal.Mul(d.Value).Div(decimal.NewFromInt(100)).RoundBank(2)
		} else if d.ValueType == "FLAT" {
			discountAmount = d.Value
		}

		if d.MaxDiscountAmount != nil && discountAmount.GreaterThan(*d.MaxDiscountAmount) {
			discountAmount = *d.MaxDiscountAmount
		}

		if discountAmount.GreaterThan(bestDiscount) {
			bestDiscount = discountAmount
		}
	}

	return bestDiscount, nil
}

func (os *OrderService) applyCoupon(coupon *models.Coupon, orderAmount decimal.Decimal) decimal.Decimal {
	var discount decimal.Decimal

	if coupon.ValueType == "PERCENTAGE" {
		discount = orderAmount.Mul(coupon.Value).Div(decimal.NewFromInt(100)).RoundBank(2)
	} else if coupon.ValueType == "FLAT" {
		discount = coupon.Value
	}

	if coupon.MaxDiscountAmount != nil && discount.GreaterThan(*coupon.MaxDiscountAmount) {
		discount = *coupon.MaxDiscountAmount
	}

	return discount
}
