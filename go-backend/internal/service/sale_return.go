package service

import (
	"fmt"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type SaleReturnService struct {
	db *gorm.DB
}

func NewSaleReturnService(db *gorm.DB) *SaleReturnService {
	return &SaleReturnService{db: db}
}

func (s *SaleReturnService) GetAll(outletId int, page, size int, from, to *time.Time) ([]models.SaleReturn, int64, error) {
	query := s.db.Where("outlet_id = ?", outletId)
	if from != nil && to != nil {
		query = query.Where("created_at >= ? AND created_at <= ?", from, to.Add(24*time.Hour))
	}
	var total int64
	if err := query.Model(&models.SaleReturn{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var returns []models.SaleReturn
	err := query.Preload("Items").Order("created_at DESC").Offset(page * size).Limit(size).Find(&returns).Error
	return returns, total, err
}

func (s *SaleReturnService) Create(data map[string]interface{}) (*models.SaleReturn, error) {
	outletId, _ := data["outletId"].(float64)

	returnNumber, err := util.GenerateSaleReturnNumber(s.db)
	if err != nil {
		return nil, err
	}

	rawItems, _ := data["items"].([]interface{})
	var total decimal.Decimal
	var items []models.SaleReturnItem

	for _, raw := range rawItems {
		m, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		qty := decimal.NewFromFloat(toFloat(m["quantity"]))
		price := decimal.NewFromFloat(toFloat(m["unitPrice"]))
		line := qty.Mul(price)
		total = total.Add(line)
		name, _ := m["productName"].(string)
		items = append(items, models.SaleReturnItem{
			ProductName: name,
			Quantity:    qty,
			UnitPrice:   price,
			LineTotal:   line,
		})
	}

	ret := models.SaleReturn{
		ReturnNumber: returnNumber,
		OutletID:     int(outletId),
		TotalAmount:  total,
		Items:        items,
	}

	if v, ok := data["customerId"].(float64); ok && v > 0 {
		id := int(v)
		ret.CustomerID = &id
	}
	if v, ok := data["customerName"].(string); ok && v != "" {
		ret.CustomerName = &v
	}
	if v, ok := data["refNo"].(string); ok && v != "" {
		ret.RefNo = &v
	}
	if v, ok := data["reason"].(string); ok && v != "" {
		ret.Reason = &v
	}
	if v, ok := data["returnMethod"].(string); ok && v != "" {
		ret.ReturnMethod = &v
	}
	if v, ok := data["createdBy"].(string); ok && v != "" {
		ret.CreatedBy = &v
	}
	if v, ok := data["returnDate"].(string); ok && v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			ret.ReturnDate = &t
		}
	}

	if err := s.db.Create(&ret).Error; err != nil {
		return nil, err
	}
	return &ret, nil
}

func (s *SaleReturnService) GetByID(id int) (*models.SaleReturn, error) {
	var ret models.SaleReturn
	if err := s.db.Preload("Items").First(&ret, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Sale return %d not found", id)}
		}
		return nil, err
	}
	return &ret, nil
}

func toFloat(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}
