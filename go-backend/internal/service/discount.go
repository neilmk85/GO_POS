package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type DiscountService struct {
	db *gorm.DB
}

func NewDiscountService(db *gorm.DB) *DiscountService {
	return &DiscountService{db: db}
}

type DiscountCreateRequest struct {
	Name               string          `json:"name"`
	Description        *string         `json:"description,omitempty"`
	ApplyOn            string          `json:"applyOn"`
	ValueType          string          `json:"valueType"`
	Value              decimal.Decimal `json:"value"`
	MaxDiscountAmount  *decimal.Decimal `json:"maxDiscountAmount,omitempty"`
	Active             bool            `json:"active"`
	Priority           int             `json:"priority"`
	StartDate          *time.Time      `json:"startDate,omitempty"`
	EndDate            *time.Time      `json:"endDate,omitempty"`
	ProductIds         []int           `json:"productIds,omitempty"`
	CategoryIds        []int           `json:"categoryIds,omitempty"`
}

type CouponCreateRequest struct {
	Code               string          `json:"code"`
	Description        *string         `json:"description,omitempty"`
	ValueType          string          `json:"valueType"`
	Value              decimal.Decimal `json:"value"`
	MaxDiscountAmount  *decimal.Decimal `json:"maxDiscountAmount,omitempty"`
	MinOrderAmount     decimal.Decimal `json:"minOrderAmount"`
	UsageLimit         *int            `json:"usageLimit,omitempty"`
	Active             bool            `json:"active"`
	StartDate          *time.Time      `json:"startDate,omitempty"`
	ExpiryDate         *time.Time      `json:"expiryDate,omitempty"`
	CustomerID         *int            `json:"customerId,omitempty"`
}

func (ds *DiscountService) GetAll(active *bool) ([]models.Discount, error) {
	query := ds.db

	if active != nil {
		query = query.Where("active = ?", *active)
	}

	var discounts []models.Discount
	err := query.Preload("Products").Preload("Products.Product").
		Preload("Categories").Preload("Categories.Category").
		Order("created_at DESC").
		Find(&discounts).Error

	return discounts, err
}

func (ds *DiscountService) GetByID(id int) (*models.Discount, error) {
	discount := &models.Discount{}
	err := ds.db.Preload("Products").Preload("Products.Product").
		Preload("Categories").Preload("Categories.Category").
		First(discount, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Discount with ID %d not found", id)}
	}

	return discount, err
}

func (ds *DiscountService) Create(req DiscountCreateRequest) (*models.Discount, error) {
	discount := &models.Discount{
		Name:              req.Name,
		Description:       req.Description,
		ApplyOn:           models.ApplyOn(req.ApplyOn),
		ValueType:         models.ValueType(req.ValueType),
		Value:             req.Value,
		MaxDiscountAmount: req.MaxDiscountAmount,
		Active:            req.Active,
		Priority:          req.Priority,
		StartDate:         req.StartDate,
		EndDate:           req.EndDate,
	}

	if err := ds.db.Create(discount).Error; err != nil {
		return nil, err
	}

	// Add product links
	if len(req.ProductIds) > 0 {
		for _, pid := range req.ProductIds {
			dp := &models.DiscountProduct{
				DiscountID: discount.ID,
				ProductID:  pid,
			}
			if err := ds.db.Create(dp).Error; err != nil {
				return nil, err
			}
		}
	}

	// Add category links
	if len(req.CategoryIds) > 0 {
		for _, cid := range req.CategoryIds {
			dc := &models.DiscountCategory{
				DiscountID: discount.ID,
				CategoryID: cid,
			}
			if err := ds.db.Create(dc).Error; err != nil {
				return nil, err
			}
		}
	}

	return ds.GetByID(discount.ID)
}

func (ds *DiscountService) Update(id int, req DiscountCreateRequest) (*models.Discount, error) {
	discount := &models.Discount{}
	if err := ds.db.First(discount, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Discount with ID %d not found", id)}
		}
		return nil, err
	}

	updates := map[string]interface{}{
		"name":                 req.Name,
		"description":          req.Description,
		"apply_on":             req.ApplyOn,
		"value_type":           req.ValueType,
		"value":                req.Value,
		"max_discount_amount":  req.MaxDiscountAmount,
		"active":               req.Active,
		"priority":             req.Priority,
		"start_date":           req.StartDate,
		"end_date":             req.EndDate,
	}

	if err := ds.db.Model(discount).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Update product links
	if err := ds.db.Where("discount_id = ?", id).Delete(&models.DiscountProduct{}).Error; err != nil {
		return nil, err
	}
	if len(req.ProductIds) > 0 {
		for _, pid := range req.ProductIds {
			dp := &models.DiscountProduct{
				DiscountID: id,
				ProductID:  pid,
			}
			if err := ds.db.Create(dp).Error; err != nil {
				return nil, err
			}
		}
	}

	// Update category links
	if err := ds.db.Where("discount_id = ?", id).Delete(&models.DiscountCategory{}).Error; err != nil {
		return nil, err
	}
	if len(req.CategoryIds) > 0 {
		for _, cid := range req.CategoryIds {
			dc := &models.DiscountCategory{
				DiscountID: id,
				CategoryID: cid,
			}
			if err := ds.db.Create(dc).Error; err != nil {
				return nil, err
			}
		}
	}

	return ds.GetByID(id)
}

func (ds *DiscountService) Delete(id int) error {
	discount := &models.Discount{}
	if err := ds.db.First(discount, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Discount with ID %d not found", id)}
		}
		return err
	}

	if err := ds.db.Delete(discount).Error; err != nil {
		return err
	}

	return nil
}

func (ds *DiscountService) GetActiveForProduct(productId int) ([]models.Discount, error) {
	now := time.Now()
	var discounts []models.Discount

	err := ds.db.Where("active = ?", true).
		Where("(start_date IS NULL OR start_date <= ?)", now).
		Where("(end_date IS NULL OR end_date >= ?)", now).
		Preload("Products").
		Order("priority DESC").
		Find(&discounts).Error

	return discounts, err
}

func (ds *DiscountService) PreviewDiscount(productId int, quantity, unitPrice decimal.Decimal) (decimal.Decimal, error) {
	activeDiscounts, err := ds.GetActiveForProduct(productId)
	if err != nil {
		return decimal.Zero, err
	}

	bestDiscount := decimal.Zero
	lineTotal := unitPrice.Mul(quantity)

	for _, d := range activeDiscounts {
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

// Coupon operations
func (ds *DiscountService) GetAllCoupons(active *bool) ([]models.Coupon, error) {
	query := ds.db

	if active != nil {
		query = query.Where("active = ?", *active)
	}

	var coupons []models.Coupon
	err := query.Order("created_at DESC").Find(&coupons).Error

	return coupons, err
}

func (ds *DiscountService) CreateCoupon(req CouponCreateRequest) (*models.Coupon, error) {
	coupon := &models.Coupon{
		Code:              req.Code,
		Description:       req.Description,
		ValueType:         models.ValueType(req.ValueType),
		Value:             req.Value,
		MaxDiscountAmount: req.MaxDiscountAmount,
		MinOrderAmount:    req.MinOrderAmount,
		UsageLimit:        req.UsageLimit,
		Active:            req.Active,
		StartDate:         req.StartDate,
		ExpiryDate:        req.ExpiryDate,
		CustomerID:        req.CustomerID,
		TimesUsed:         0,
	}

	if err := ds.db.Create(coupon).Error; err != nil {
		return nil, err
	}

	return coupon, nil
}

func (ds *DiscountService) UpdateCoupon(id int, req CouponCreateRequest) (*models.Coupon, error) {
	coupon := &models.Coupon{}
	if err := ds.db.First(coupon, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Coupon with ID %d not found", id)}
		}
		return nil, err
	}

	updates := map[string]interface{}{
		"code":                 req.Code,
		"description":          req.Description,
		"value_type":           req.ValueType,
		"value":                req.Value,
		"max_discount_amount":  req.MaxDiscountAmount,
		"min_order_amount":     req.MinOrderAmount,
		"usage_limit":          req.UsageLimit,
		"active":               req.Active,
		"start_date":           req.StartDate,
		"expiry_date":          req.ExpiryDate,
		"customer_id":          req.CustomerID,
	}

	if err := ds.db.Model(coupon).Updates(updates).Error; err != nil {
		return nil, err
	}

	return coupon, nil
}

func (ds *DiscountService) DeleteCoupon(id int) error {
	coupon := &models.Coupon{}
	if err := ds.db.First(coupon, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Coupon with ID %d not found", id)}
		}
		return err
	}

	return ds.db.Delete(coupon).Error
}

func (ds *DiscountService) ValidateCoupon(code string, orderAmount decimal.Decimal, customerId *int) (*models.Coupon, error) {
	coupon := &models.Coupon{}
	if err := ds.db.Where("code = ?", code).First(coupon).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.BusinessException{Message: fmt.Sprintf("Coupon not found: %s", code)}
		}
		return nil, err
	}

	if !coupon.Active {
		return nil, &util.BusinessException{Message: "Coupon is not active"}
	}

	now := time.Now()
	if coupon.StartDate != nil && coupon.StartDate.After(now) {
		return nil, &util.BusinessException{Message: "Coupon not yet valid"}
	}
	if coupon.ExpiryDate != nil && coupon.ExpiryDate.Before(now) {
		return nil, &util.BusinessException{Message: "Coupon has expired"}
	}
	if coupon.UsageLimit != nil && coupon.TimesUsed >= *coupon.UsageLimit {
		return nil, &util.BusinessException{Message: "Coupon usage limit reached"}
	}
	if orderAmount.LessThan(coupon.MinOrderAmount) {
		return nil, &util.BusinessException{
			Message: fmt.Sprintf("Minimum order amount of %.2f required for this coupon", coupon.MinOrderAmount),
		}
	}
	if coupon.CustomerID != nil && (customerId == nil || *coupon.CustomerID != *customerId) {
		return nil, &util.BusinessException{Message: "Coupon not valid for this customer"}
	}

	return coupon, nil
}
