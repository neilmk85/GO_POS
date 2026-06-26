package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PipePurchaseService struct {
	db *gorm.DB
}

func NewPipePurchaseService(db *gorm.DB) *PipePurchaseService {
	return &PipePurchaseService{db: db}
}

// creditInventory finds-or-creates the FINISHED_PIPE product and adds qty to inventory.
func (s *PipePurchaseService) creditInventory(tx *gorm.DB, pipeName string, outletID, qty int, by string) error {
	var product models.Product
	result := tx.Where("name = ? AND item_type = ?", pipeName, "FINISHED_PIPE").First(&product)
	if result.Error == gorm.ErrRecordNotFound {
		product = models.Product{
			Name:           pipeName,
			ItemType:       "FINISHED_PIPE",
			ProductType:    "PHYSICAL",
			UnitOfMeasure:  "pcs",
			TrackInventory: true,
			Active:         true,
			CreatedBy:      &by,
			UpdatedBy:      &by,
		}
		if err := tx.Create(&product).Error; err != nil {
			return fmt.Errorf("failed to create finished-goods product: %w", err)
		}
	} else if result.Error != nil {
		return fmt.Errorf("error looking up finished-goods product: %w", result.Error)
	}

	delta := decimal.NewFromInt(int64(qty))
	now := time.Now()

	var inv models.Inventory
	invResult := tx.Where("product_id = ? AND outlet_id = ? AND variant_id IS NULL", product.ID, outletID).First(&inv)
	if invResult.Error == gorm.ErrRecordNotFound {
		inv = models.Inventory{
			ProductID:       product.ID,
			OutletID:        outletID,
			QuantityOnHand:  delta,
			ReorderLevel:    0,
			ReorderQuantity: 0,
			LastStockUpdate: &now,
			CreatedBy:       &by,
			UpdatedBy:       &by,
		}
		return tx.Create(&inv).Error
	} else if invResult.Error != nil {
		return fmt.Errorf("error looking up inventory: %w", invResult.Error)
	}

	return tx.Model(&inv).Updates(map[string]interface{}{
		"quantity_on_hand":  inv.QuantityOnHand.Add(delta),
		"last_stock_update": now,
		"updated_by":        by,
	}).Error
}

// debitInventory reverses a previous credit. Goes negative if needed.
func (s *PipePurchaseService) debitInventory(tx *gorm.DB, pipeName string, outletID, qty int) error {
	var product models.Product
	if err := tx.Where("name = ? AND item_type = ?", pipeName, "FINISHED_PIPE").First(&product).Error; err != nil {
		return nil // product doesn't exist — nothing to debit
	}

	var inv models.Inventory
	if err := tx.Where("product_id = ? AND outlet_id = ? AND variant_id IS NULL", product.ID, outletID).First(&inv).Error; err != nil {
		return nil // inventory row doesn't exist — nothing to debit
	}

	delta := decimal.NewFromInt(int64(qty))
	now := time.Now()
	return tx.Model(&inv).Updates(map[string]interface{}{
		"quantity_on_hand":  inv.QuantityOnHand.Sub(delta),
		"last_stock_update": now,
	}).Error
}

func (s *PipePurchaseService) List(outletID int, from, to string) ([]models.ThirdPartyPipePurchase, error) {
	var records []models.ThirdPartyPipePurchase
	q := s.db.Where("outlet_id = ?", outletID).
		Preload("Supplier").Preload("PipeConfig").
		Order("purchase_date DESC, id DESC")
	if from != "" {
		q = q.Where("purchase_date >= ?", from)
	}
	if to != "" {
		q = q.Where("purchase_date <= ?", to)
	}
	return records, q.Find(&records).Error
}

func (s *PipePurchaseService) Create(req models.ThirdPartyPipePurchase) (*models.ThirdPartyPipePurchase, error) {
	var result *models.ThirdPartyPipePurchase
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&req).Error; err != nil {
			return err
		}
		result = &req
		return s.creditInventory(tx, req.PipeName, req.OutletID, req.Quantity, req.CreatedBy)
	})
	return result, err
}

func (s *PipePurchaseService) Update(id uint, req models.ThirdPartyPipePurchase) (*models.ThirdPartyPipePurchase, error) {
	var existing models.ThirdPartyPipePurchase
	if err := s.db.First(&existing, id).Error; err != nil {
		return nil, fmt.Errorf("purchase not found: %w", err)
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		oldName := existing.PipeName
		oldQty := existing.Quantity
		oldOutlet := existing.OutletID

		nameChanged := req.PipeName != "" && req.PipeName != oldName
		newQty := req.Quantity
		if newQty == 0 {
			newQty = oldQty
		}

		if nameChanged {
			// Reverse old entirely; credit new entirely
			if err := s.debitInventory(tx, oldName, oldOutlet, oldQty); err != nil {
				return err
			}
			if err := s.creditInventory(tx, req.PipeName, req.OutletID, newQty, existing.CreatedBy); err != nil {
				return err
			}
		} else if newQty != oldQty {
			// Same pipe, qty changed — apply delta
			delta := newQty - oldQty
			if delta > 0 {
				if err := s.creditInventory(tx, oldName, oldOutlet, delta, existing.CreatedBy); err != nil {
					return err
				}
			} else {
				if err := s.debitInventory(tx, oldName, oldOutlet, -delta); err != nil {
					return err
				}
			}
		}

		// Apply field updates
		updates := map[string]interface{}{
			"vendor_name":    req.VendorName,
			"invoice_number": req.InvoiceNumber,
			"purchase_date":  req.PurchaseDate,
			"pipe_name":      req.PipeName,
			"quantity":       newQty,
			"unit_rate":      req.UnitRate,
			"total_amount":   req.TotalAmount,
			"notes":          req.Notes,
		}
		if req.SupplierID != nil {
			updates["supplier_id"] = req.SupplierID
		}
		if req.PipeConfigID != nil {
			updates["pipe_config_id"] = req.PipeConfigID
		}
		return tx.Model(&existing).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	s.db.Preload("Supplier").Preload("PipeConfig").First(&existing, id)
	return &existing, nil
}

func (s *PipePurchaseService) Delete(id uint) error {
	var existing models.ThirdPartyPipePurchase
	if err := s.db.First(&existing, id).Error; err != nil {
		return fmt.Errorf("purchase not found: %w", err)
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.debitInventory(tx, existing.PipeName, existing.OutletID, existing.Quantity); err != nil {
			return err
		}
		return tx.Delete(&existing).Error
	})
}
