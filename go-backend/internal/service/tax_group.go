package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TaxGroupService struct {
	db *gorm.DB
}

func NewTaxGroupService(db *gorm.DB) *TaxGroupService {
	return &TaxGroupService{db: db}
}

// GetAll returns all tax groups
func (ts *TaxGroupService) GetAll() (taxGroups []models.TaxGroup, err error) {
	err = ts.db.Order("total_rate ASC").Find(&taxGroups).Error
	return taxGroups, err
}

// GetByID returns a single tax group by ID
func (ts *TaxGroupService) GetByID(id int) (taxGroup *models.TaxGroup, err error) {
	taxGroup = &models.TaxGroup{}
	err = ts.db.First(taxGroup, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("TaxGroup with ID %d not found", id)}
	}
	return taxGroup, err
}

// CreateTaxGroupDTO for tax group creation
type CreateTaxGroupDTO struct {
	Name      string           `json:"name"`
	TotalRate decimal.Decimal  `json:"totalRate"`
	CGSTRate  *decimal.Decimal `json:"cgstRate"`
	SGSTRate  *decimal.Decimal `json:"sgstRate"`
	IGSTRate  *decimal.Decimal `json:"igstRate"`
	CessRate  *decimal.Decimal `json:"cessRate"`
	HSNCode   *string          `json:"hsnCode"`
	Inclusive bool             `json:"inclusive"`
	Active    bool             `json:"active"`
	CreatedBy *string          `json:"createdBy"`
}

// Create creates a new tax group
func (ts *TaxGroupService) Create(dto CreateTaxGroupDTO) (taxGroup *models.TaxGroup, err error) {
	taxGroup = &models.TaxGroup{
		Name:      dto.Name,
		TotalRate: dto.TotalRate,
		CGSTRate:  dto.CGSTRate,
		SGSTRate:  dto.SGSTRate,
		IGSTRate:  dto.IGSTRate,
		HSNCode:   dto.HSNCode,
		Inclusive: dto.Inclusive,
		Active:    dto.Active,
		CreatedBy: dto.CreatedBy,
	}

	if dto.CessRate != nil {
		taxGroup.CessRate = *dto.CessRate
	} else {
		taxGroup.CessRate = decimal.Zero
	}

	err = ts.db.Create(taxGroup).Error
	if err != nil {
		return nil, err
	}

	return ts.GetByID(taxGroup.ID)
}

// Update updates an existing tax group
func (ts *TaxGroupService) Update(id int, dto CreateTaxGroupDTO) (taxGroup *models.TaxGroup, err error) {
	taxGroup = &models.TaxGroup{}
	if err := ts.db.First(taxGroup, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("TaxGroup with ID %d not found", id)}
		}
		return nil, err
	}

	updates := map[string]interface{}{
		"name":       dto.Name,
		"total_rate": dto.TotalRate,
		"cgst_rate":  dto.CGSTRate,
		"sgst_rate":  dto.SGSTRate,
		"igst_rate":  dto.IGSTRate,
		"hsn_code":   dto.HSNCode,
		"is_inclusive": dto.Inclusive,
		"is_active":  dto.Active,
		"updated_by": dto.CreatedBy,
	}

	if dto.CessRate != nil {
		updates["cess_rate"] = *dto.CessRate
	}

	if err := ts.db.Model(taxGroup).Updates(updates).Error; err != nil {
		return nil, err
	}

	return ts.GetByID(id)
}

// Delete deletes a tax group
func (ts *TaxGroupService) Delete(id int) error {
	taxGroup := &models.TaxGroup{}
	if err := ts.db.First(taxGroup, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("TaxGroup with ID %d not found", id)}
		}
		return err
	}

	return ts.db.Delete(taxGroup).Error
}
