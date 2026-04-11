package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type BulkPurchaseService struct {
	db *gorm.DB
}

func NewBulkPurchaseService(db *gorm.DB) *BulkPurchaseService {
	return &BulkPurchaseService{db: db}
}

// RecordPurchase creates a bulk purchase and updates inventory
func (bps *BulkPurchaseService) RecordPurchase(data map[string]interface{}) (*models.BulkPurchase, error) {
	productId := int(data["productId"].(float64))
	outletId := int(data["outletId"].(float64))
	purchaseQty := decimal.NewFromFloat(data["purchaseQty"].(float64))

	// Verify product exists
	product := &models.Product{}
	if err := bps.db.First(product, productId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", productId)}
		}
		return nil, err
	}

	// Get purchase factor
	purchaseFactor := decimal.NewFromInt(1)
	if product.PurchaseFactor.GreaterThan(decimal.Zero) {
		purchaseFactor = product.PurchaseFactor
	}

	baseQty := purchaseQty.Mul(purchaseFactor)

	referenceNumber, err := util.GenerateBulkPurchaseNumber(bps.db)
	if err != nil {
		return nil, err
	}

	bp := models.BulkPurchase{
		ReferenceNumber:  referenceNumber,
		ProductID:        productId,
		OutletID:         outletId,
		PurchaseUOM:      product.PurchaseUOM,
		PurchaseQty:      purchaseQty,
		PurchaseFactor:   &purchaseFactor,
		BaseQty:          &baseQty,
		BaseUOM:          &product.UnitOfMeasure,
		ConversionStatus: models.ConversionStatusNotConverted,
	}

	if costPerUnit, ok := data["costPerUnit"].(float64); ok {
		costDec := decimal.NewFromFloat(costPerUnit)
		bp.CostPerUnit = &costDec
		totalCost := costDec.Mul(purchaseQty)
		bp.TotalCost = &totalCost
	}

	if supplier, ok := data["supplier"].(string); ok {
		bp.Supplier = &supplier
	}

	if invoiceNumber, ok := data["invoiceNumber"].(string); ok {
		bp.InvoiceNumber = &invoiceNumber
	}

	if purchaseDate, ok := data["purchaseDate"].(string); ok {
		if parsedDate, err := time.Parse("2006-01-02", purchaseDate); err == nil {
			bp.PurchaseDate = &parsedDate
		}
	} else {
		now := time.Now()
		bp.PurchaseDate = &now
	}

	if notes, ok := data["notes"].(string); ok {
		bp.Notes = &notes
	}

	// Create with inventory update
	return &bp, bps.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&bp).Error; err != nil {
			return err
		}

		// Add to inventory
		var inv models.Inventory
		result := tx.Where("product_id = ? AND outlet_id = ?", productId, outletId).First(&inv)

		now := time.Now()
		if result.Error == gorm.ErrRecordNotFound {
			// Create new inventory
			if err := tx.Create(&models.Inventory{
				ProductID:       productId,
				OutletID:        outletId,
				QuantityOnHand:  baseQty,
				LastStockUpdate: &now,
			}).Error; err != nil {
				return err
			}
		} else if result.Error == nil {
			// Update existing inventory
			if err := tx.Model(&inv).
				Update("quantity_on_hand", gorm.Expr("quantity_on_hand + ?", baseQty)).
				Update("last_stock_update", now).Error; err != nil {
				return err
			}
		} else {
			return result.Error
		}

		return nil
	})
}

// GetHistory returns paginated bulk purchases for an outlet
func (bps *BulkPurchaseService) GetHistory(page, size int, outletId int) (purchases []models.BulkPurchase, total int64, err error) {
	query := bps.db.Where("outlet_id = ?", outletId)

	if err := query.Model(&models.BulkPurchase{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Product").
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&purchases).Error

	return purchases, total, err
}

// GetHistoryByDate returns bulk purchases filtered by date range
func (bps *BulkPurchaseService) GetHistoryByDate(page, size int, outletId int, from, to time.Time) (purchases []models.BulkPurchase, total int64, err error) {
	query := bps.db.Where("outlet_id = ? AND purchase_date >= ? AND purchase_date <= ?",
		outletId, from, to)

	if err := query.Model(&models.BulkPurchase{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("Product").
		Order("purchase_date DESC").
		Offset(offset).
		Limit(size).
		Find(&purchases).Error

	return purchases, total, err
}

// GetHistoryByProduct returns bulk purchases for a specific product
func (bps *BulkPurchaseService) GetHistoryByProduct(productId, outletId int) ([]models.BulkPurchase, error) {
	var purchases []models.BulkPurchase
	err := bps.db.
		Where("product_id = ? AND outlet_id = ?", productId, outletId).
		Order("created_at DESC").
		Find(&purchases).Error
	return purchases, err
}

// UpdateConversionStatus updates conversion status
func (bps *BulkPurchaseService) UpdateConversionStatus(id int, status string) (*models.BulkPurchase, error) {
	bp := &models.BulkPurchase{}
	if err := bps.db.Model(bp).Where("id = ?", id).Update("conversion_status", status).Error; err != nil {
		return nil, err
	}

	return bp, bps.db.First(bp, id).Error
}

// Convert converts bulk purchase quantity to sellable items
func (bps *BulkPurchaseService) Convert(bulkPurchaseId int, targetProductId int, fromBaseQty decimal.Decimal, saleQty decimal.Decimal, saleUom *string, notes *string) (*models.BulkPurchaseConversion, error) {
	bp := &models.BulkPurchase{}
	if err := bps.db.First(bp, bulkPurchaseId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Bulk purchase with ID %d not found", bulkPurchaseId)}
		}
		return nil, err
	}

	available := (*bp.BaseQty).Sub(bp.ConvertedBaseQty)
	if fromBaseQty.GreaterThan(available) {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    fmt.Sprintf("Insufficient base quantity. Available: %s", available.String()),
		}
	}

	// Create conversion with inventory update
	conversion := models.BulkPurchaseConversion{
		BulkPurchaseID: bulkPurchaseId,
		TargetProductID: targetProductId,
		OutletID:       bp.OutletID,
		FromBaseQty:    fromBaseQty,
		SaleQty:        saleQty,
	}

	if saleUom != nil {
		conversion.SaleUOM = saleUom
	}

	if notes != nil {
		conversion.Notes = notes
	}

	return &conversion, bps.db.Transaction(func(tx *gorm.DB) error {
		// Create conversion record
		if err := tx.Create(&conversion).Error; err != nil {
			return err
		}

		// Add to target product inventory
		var inv models.Inventory
		result := tx.Where("product_id = ? AND outlet_id = ?", targetProductId, bp.OutletID).First(&inv)

		now := time.Now()
		if result.Error == gorm.ErrRecordNotFound {
			// Create new inventory
			if err := tx.Create(&models.Inventory{
				ProductID:       targetProductId,
				OutletID:        bp.OutletID,
				QuantityOnHand:  saleQty,
				LastStockUpdate: &now,
			}).Error; err != nil {
				return err
			}
		} else if result.Error == nil {
			// Update existing inventory
			if err := tx.Model(&inv).
				Update("quantity_on_hand", gorm.Expr("quantity_on_hand + ?", saleQty)).
				Update("last_stock_update", now).Error; err != nil {
				return err
			}
		} else {
			return result.Error
		}

		// Update bulk purchase conversion status
		newConverted := bp.ConvertedBaseQty.Add(fromBaseQty)
		var newStatus models.ConversionStatus
		if newConverted.GreaterThanOrEqual(*bp.BaseQty) {
			newStatus = models.ConversionStatusConverted
		} else {
			newStatus = models.ConversionStatusPartiallyConverted
		}

		return tx.Model(bp).
			Update("converted_base_qty", newConverted).
			Update("conversion_status", newStatus).Error
	})
}

// GetConversions returns all conversions for a bulk purchase
func (bps *BulkPurchaseService) GetConversions(bulkPurchaseId int) ([]models.BulkPurchaseConversion, error) {
	var conversions []models.BulkPurchaseConversion
	err := bps.db.
		Where("bulk_purchase_id = ?", bulkPurchaseId).
		Preload("TargetProduct").
		Order("converted_at DESC").
		Find(&conversions).Error
	return conversions, err
}

// GetStats returns aggregate statistics for bulk purchases
func (bps *BulkPurchaseService) GetStats(outletId int) (map[string]interface{}, error) {
	today := time.Now()
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	tomorrow := today.AddDate(0, 0, 1)

	var todayPurchases []models.BulkPurchase
	if err := bps.db.Where("outlet_id = ? AND purchase_date >= ? AND purchase_date < ?",
		outletId, today, tomorrow).Find(&todayPurchases).Error; err != nil {
		return nil, err
	}

	var allPurchases []models.BulkPurchase
	if err := bps.db.Where("outlet_id = ?", outletId).Find(&allPurchases).Error; err != nil {
		return nil, err
	}

	var todayTotal decimal.Decimal
	for _, bp := range todayPurchases {
		if bp.TotalCost != nil {
			todayTotal = todayTotal.Add(*bp.TotalCost)
		}
	}

	var allTotal decimal.Decimal
	for _, bp := range allPurchases {
		if bp.TotalCost != nil {
			allTotal = allTotal.Add(*bp.TotalCost)
		}
	}

	return map[string]interface{}{
		"todayCount":      len(todayPurchases),
		"todayTotal":      todayTotal,
		"allTimeCount":    len(allPurchases),
		"allTimeTotal":    allTotal,
	}, nil
}
