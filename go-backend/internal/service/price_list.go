package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type PriceListService struct {
	db *gorm.DB
}

func NewPriceListService(db *gorm.DB) *PriceListService {
	return &PriceListService{db: db}
}

type PriceListItemRequest struct {
	ProductID       int              `json:"productId"`
	VariantID       *int             `json:"variantId,omitempty"`
	SellingPrice    *decimal.Decimal `json:"sellingPrice,omitempty"`
	DiscountPercent *decimal.Decimal `json:"discountPercent,omitempty"`
}

type PriceListCreateRequest struct {
	Name         string                  `json:"name"`
	Description  *string                 `json:"description,omitempty"`
	Active       bool                    `json:"active"`
	Priority     int                     `json:"priority"`
	StartDate    *time.Time              `json:"startDate,omitempty"`
	EndDate      *time.Time              `json:"endDate,omitempty"`
	Segments     []string                `json:"segments,omitempty"`
	CustomerIds  []int                   `json:"customerIds,omitempty"`
	Items        []PriceListItemRequest  `json:"items"`
}

func (pls *PriceListService) GetAll() ([]models.PriceList, error) {
	var priceLists []models.PriceList
	err := pls.db.Preload("Items").Preload("Segments").
		Preload("Customers").Preload("Customers.Customer").
		Order("priority DESC, created_at DESC").
		Find(&priceLists).Error

	return priceLists, err
}

func (pls *PriceListService) GetByID(id int) (*models.PriceList, error) {
	priceList := &models.PriceList{}
	err := pls.db.Preload("Items").Preload("Items.Product").Preload("Items.Variant").
		Preload("Segments").
		Preload("Customers").Preload("Customers.Customer").
		First(priceList, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("PriceList with ID %d not found", id)}
	}

	return priceList, err
}

func (pls *PriceListService) Create(req PriceListCreateRequest) (*models.PriceList, error) {
	priceList := &models.PriceList{
		Name:        req.Name,
		Description: req.Description,
		Active:      req.Active,
		Priority:    req.Priority,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
	}

	if err := pls.db.Create(priceList).Error; err != nil {
		return nil, err
	}

	// Add segments
	if len(req.Segments) > 0 {
		for _, segment := range req.Segments {
			ps := &models.PriceListSegment{
				PriceListID: priceList.ID,
				Segment:     models.CustomerSegment(segment),
			}
			if err := pls.db.Create(ps).Error; err != nil {
				return nil, err
			}
		}
	}

	// Add customers
	if len(req.CustomerIds) > 0 {
		for _, cid := range req.CustomerIds {
			pc := &models.PriceListCustomer{
				PriceListID: priceList.ID,
				CustomerID:  cid,
			}
			if err := pls.db.Create(pc).Error; err != nil {
				return nil, err
			}
		}
	}

	// Add items
	if len(req.Items) > 0 {
		for _, item := range req.Items {
			pli := &models.PriceListItem{
				PriceListID:     priceList.ID,
				ProductID:       item.ProductID,
				VariantID:       item.VariantID,
				SellingPrice:    item.SellingPrice,
				DiscountPercent: decimalPtrToFloat64Ptr(item.DiscountPercent),
			}
			if err := pls.db.Create(pli).Error; err != nil {
				return nil, err
			}
		}
	}

	return pls.GetByID(priceList.ID)
}

func (pls *PriceListService) Update(id int, req PriceListCreateRequest) (*models.PriceList, error) {
	priceList := &models.PriceList{}
	if err := pls.db.First(priceList, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("PriceList with ID %d not found", id)}
		}
		return nil, err
	}

	// Delete existing relations
	if err := pls.db.Where("price_list_id = ?", id).Delete(&models.PriceListSegment{}).Error; err != nil {
		return nil, err
	}
	if err := pls.db.Where("price_list_id = ?", id).Delete(&models.PriceListCustomer{}).Error; err != nil {
		return nil, err
	}
	if err := pls.db.Where("price_list_id = ?", id).Delete(&models.PriceListItem{}).Error; err != nil {
		return nil, err
	}

	// Update main fields
	updates := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"active":      req.Active,
		"priority":    req.Priority,
		"start_date":  req.StartDate,
		"end_date":    req.EndDate,
	}

	if err := pls.db.Model(priceList).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Re-add segments
	if len(req.Segments) > 0 {
		for _, segment := range req.Segments {
			ps := &models.PriceListSegment{
				PriceListID: id,
				Segment:     models.CustomerSegment(segment),
			}
			if err := pls.db.Create(ps).Error; err != nil {
				return nil, err
			}
		}
	}

	// Re-add customers
	if len(req.CustomerIds) > 0 {
		for _, cid := range req.CustomerIds {
			pc := &models.PriceListCustomer{
				PriceListID: id,
				CustomerID:  cid,
			}
			if err := pls.db.Create(pc).Error; err != nil {
				return nil, err
			}
		}
	}

	// Re-add items
	if len(req.Items) > 0 {
		for _, item := range req.Items {
			pli := &models.PriceListItem{
				PriceListID:     id,
				ProductID:       item.ProductID,
				VariantID:       item.VariantID,
				SellingPrice:    item.SellingPrice,
				DiscountPercent: decimalPtrToFloat64Ptr(item.DiscountPercent),
			}
			if err := pls.db.Create(pli).Error; err != nil {
				return nil, err
			}
		}
	}

	return pls.GetByID(id)
}

func (pls *PriceListService) ToggleActive(id int) (*models.PriceList, error) {
	priceList := &models.PriceList{}
	if err := pls.db.First(priceList, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("PriceList with ID %d not found", id)}
		}
		return nil, err
	}

	newActive := !priceList.Active
	if err := pls.db.Model(priceList).Update("active", newActive).Error; err != nil {
		return nil, err
	}

	return pls.GetByID(id)
}

func (pls *PriceListService) Delete(id int) error {
	priceList := &models.PriceList{}
	if err := pls.db.First(priceList, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("PriceList with ID %d not found", id)}
		}
		return err
	}

	return pls.db.Delete(priceList).Error
}

type ResolvedPrice struct {
	Price  decimal.Decimal `json:"price"`
	Source string          `json:"source"`
}

func (pls *PriceListService) ResolvePrice(productId int, variantId *int, customerId *int) (ResolvedPrice, error) {
	product := &models.Product{}
	if err := pls.db.First(product, productId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return ResolvedPrice{}, &util.ResourceNotFoundException{Message: fmt.Sprintf("Product with ID %d not found", productId)}
		}
		return ResolvedPrice{}, err
	}

	basePrice := product.SellingPrice

	// If no customer, return product price
	if customerId == nil {
		return ResolvedPrice{
			Price:  basePrice,
			Source: "product",
		}, nil
	}

	customer := &models.Customer{}
	if err := pls.db.First(customer, *customerId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return ResolvedPrice{
				Price:  basePrice,
				Source: "product",
			}, nil
		}
		return ResolvedPrice{}, err
	}

	now := time.Now()

	// Find applicable price lists
	priceLists := []models.PriceList{}
	if err := pls.db.Where("active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now).
		Preload("Items").
		Order("priority DESC").
		Find(&priceLists).Error; err != nil {
		return ResolvedPrice{}, err
	}

	var resolvedPrice *decimal.Decimal

	for _, pl := range priceLists {
		// Check if this price list applies to the customer
		// (by segment or explicit customer assignment)
		applicable := false
		for _, seg := range pl.Segments {
			if seg.Segment == customer.Segment {
				applicable = true
				break
			}
		}

		if !applicable {
			for _, pc := range pl.Customers {
				if pc.CustomerID == customer.ID {
					applicable = true
					break
				}
			}
		}

		if !applicable {
			continue
		}

		// Find price list item
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
			var price decimal.Decimal
			if item.SellingPrice != nil && item.SellingPrice.GreaterThan(decimal.Zero) {
				price = *item.SellingPrice
			} else if item.DiscountPercent != nil && *item.DiscountPercent > 0 {
				price = basePrice.Mul(decimal.NewFromInt(100).Sub(decimal.NewFromFloat(*item.DiscountPercent))).Div(decimal.NewFromInt(100)).RoundBank(2)
			} else {
				continue
			}

			if resolvedPrice == nil || price.LessThan(*resolvedPrice) {
				resolvedPrice = &price
			}
			break // First applicable price list wins
		}
	}

	if resolvedPrice != nil {
		return ResolvedPrice{
			Price:  *resolvedPrice,
			Source: "price_list",
		}, nil
	}

	return ResolvedPrice{
		Price:  basePrice,
		Source: "product",
	}, nil
}

func decimalPtrToFloat64Ptr(d *decimal.Decimal) *float64 {
	if d == nil {
		return nil
	}
	f := d.InexactFloat64()
	return &f
}
