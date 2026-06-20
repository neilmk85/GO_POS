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
	var poId int
	if v, ok := data["purchaseOrderId"]; ok {
		poId = int(v.(float64))
	}
	outletId := int(data["outletId"].(float64))

	// Verify PO exists only when a PO ID is provided
	if poId > 0 {
		po := &models.PurchaseOrder{}
		if err := prs.db.Preload("Items").First(po, poId).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Purchase order with ID %d not found", poId)}
			}
			return nil, err
		}
	}

	returnNumber, err := util.GeneratePurchaseReturnNumber(prs.db)
	if err != nil {
		return nil, err
	}

	rawItems, _ := data["items"].([]interface{})
	var totalAmount decimal.Decimal
	var itemsData []models.PurchaseReturnItem

	for _, item := range rawItems {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		qty := decimal.NewFromFloat(toFloatVal(itemMap["returnedQuantity"]))
		cost := decimal.NewFromFloat(toFloatVal(itemMap["unitCost"]))
		lineTotal := qty.Mul(cost)
		totalAmount = totalAmount.Add(lineTotal)

		itemData := models.PurchaseReturnItem{
			ReturnedQuantity: qty,
			UnitCost:         cost,
			LineTotal:        lineTotal,
		}

		if productName, ok := itemMap["productName"].(string); ok && productName != "" {
			itemData.ProductName = &productName
		}
		if productId, ok := itemMap["productId"].(float64); ok && productId > 0 {
			itemData.ProductID = int(productId)
		}
		if poItemId, ok := itemMap["purchaseOrderItemId"].(float64); ok && poItemId > 0 {
			v := int(poItemId)
			itemData.PurchaseOrderItemID = &v
		}

		itemsData = append(itemsData, itemData)
	}

	ret := models.PurchaseReturn{
		ReturnNumber: returnNumber,
		OutletID:     outletId,
		Status:       models.PurchaseReturnStatusCompleted,
		TotalAmount:  totalAmount,
	}
	if poId > 0 {
		ret.PurchaseOrderID = &poId
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

func toFloatVal(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}
