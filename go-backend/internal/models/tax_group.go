package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type TaxGroup struct {
	ID        int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name      string           `gorm:"uniqueIndex;size:191;column:name" json:"name"`
	TotalRate decimal.Decimal  `gorm:"column:total_rate;type:decimal(5,2)" json:"totalRate"`
	CGSTRate  *decimal.Decimal `gorm:"column:cgst_rate;type:decimal(5,2)" json:"cgstRate"`
	SGSTRate  *decimal.Decimal `gorm:"column:sgst_rate;type:decimal(5,2)" json:"sgstRate"`
	IGSTRate  *decimal.Decimal `gorm:"column:igst_rate;type:decimal(5,2)" json:"igstRate"`
	CessRate  decimal.Decimal  `gorm:"column:cess_rate;type:decimal(5,2);default:0" json:"cessRate"`
	HSNCode   *string          `gorm:"column:hsn_code" json:"hsnCode"`
	Inclusive bool             `gorm:"column:is_inclusive;default:false" json:"inclusive"`
	Active    bool             `gorm:"column:is_active;default:true" json:"active"`
	CreatedAt time.Time        `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time        `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy *string          `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy *string          `gorm:"column:updated_by" json:"updatedBy"`

	Products []Product `gorm:"foreignKey:TaxGroupID" json:"products,omitempty"`
}

func (TaxGroup) TableName() string {
	return "tax_groups"
}

