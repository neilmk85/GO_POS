package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PurchaseReturnService struct {
	db *gorm.DB
}

func NewPurchaseReturnService(db *gorm.DB) *PurchaseReturnService {
	return &PurchaseReturnService{db: db}
}

// GetAll returns paginated list of purchase returns
func (prs *PurchaseReturnService) GetAll(page, size int, outletId *int, from, to *time.Time) (returns []models.PurchaseReturn, total int64, err error) {
	query := prs.db

	if outletId != nil {
		query = query.Where("outlet_id = ?", *outletId)
	}

	if from != nil && to != nil {
		query = query.Where("created_at >= ? AND created_at <= ?",
			*from, to.Add(24*time.Hour))
	}

	if err := query.Model(&models.PurchaseReturn{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Preload("PurchaseOrder", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Supplier")
		}).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&returns).Error

	return returns, total, err
}

// GetByID returns a purchase return by ID
func (prs *PurchaseReturnService) GetByID(id int) (*models.PurchaseReturn, error) {
	ret := &models.PurchaseReturn{}
	err := prs.db.
		Preload("PurchaseOrder", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Supplier")
		}).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Product")
		}).
		First(ret, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase return with ID %d not found", id)}
	}

	return ret, err
}

// Create creates a new purchase return
func (prs *PurchaseReturnService) Create(data map[string]interface{}) (*models.PurchaseReturn, error) {
	poId := int(data["purchaseOrderId"].(float64))
	outletId := int(data["outletId"].(float64))

	// Verify PO exists
	po := &models.PurchaseOrder{}
	if err := prs.db.
		Preload("Items").
		First(po, poId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", poId)}
		}
		return nil, err
	}

	returnNumber, err := util.GeneratePurchaseReturnNumber(prs.db)
	if err != nil {
		return nil, err
	}

	items := data["items"].([]interface{})
	var totalAmount decimal.Decimal
	var itemsData []models.PurchaseReturnItem

	for _, item := range items {
		itemMap := item.(map[string]interface{})
		qty := decimal.NewFromFloat(itemMap["returnedQuantity"].(float64))
		cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
		lineTotal := qty.Mul(cost)

		totalAmount = totalAmount.Add(lineTotal)

		itemData := models.PurchaseReturnItem{
			ProductID:        int(itemMap["productId"].(float64)),
			ReturnedQuantity: qty,
			UnitCost:         cost,
			LineTotal:        lineTotal,
		}

		if productName, ok := itemMap["productName"].(string); ok {
			itemData.ProductName = &productName
		}

		if poItemId, ok := itemMap["purchaseOrderItemId"].(float64); ok {
			poItemIdInt := int(poItemId)
			itemData.PurchaseOrderItemID = &poItemIdInt
		}

		itemsData = append(itemsData, itemData)
	}

	ret := models.PurchaseReturn{
		ReturnNumber:    returnNumber,
		PurchaseOrderID: poId,
		OutletID:        outletId,
		Status:          models.PurchaseReturnStatusCompleted,
		TotalAmount:     totalAmount,
	}

	if reason, ok := data["reason"].(string); ok {
		ret.Reason = &reason
	}

	if creditMethod, ok := data["creditMethod"].(string); ok {
		cm := models.CreditMethod(creditMethod)
		ret.CreditMethod = &cm
	}

	if notes, ok := data["notes"].(string); ok {
		ret.Notes = &notes
	}

	ret.Items = itemsData

	// Create with inventory adjustment
	return &ret, prs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&ret).Error; err != nil {
			return err
		}

		// Deduct inventory for all returned items
		now := time.Now()
		for _, item := range itemsData {
			var inv models.Inventory
			result := tx.Where("product_id = ? AND outlet_id = ?", item.ProductID, outletId).First(&inv)

			if result.Error == nil {
				// Update inventory - deduct the returned quantity
				if err := tx.Model(&inv).
					Update("quantity_on_hand", gorm.Expr("quantity_on_hand - ?", item.ReturnedQuantity)).
					Update("last_stock_update", now).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}
