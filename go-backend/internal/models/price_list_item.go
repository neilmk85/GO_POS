package models

import "github.com/shopspring/decimal"

type PriceListItem struct {
	ID              int              `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	PriceListID     int              `gorm:"uniqueIndex:idx_pricelist_product_variant;column:price_list_id" json:"priceListId"`
	ProductID       int              `gorm:"uniqueIndex:idx_pricelist_product_variant;column:product_id" json:"productId"`
	VariantID       *int             `gorm:"uniqueIndex:idx_pricelist_product_variant;column:variant_id" json:"variantId"`
	SellingPrice    *decimal.Decimal `gorm:"column:selling_price;type:decimal(10,2)" json:"sellingPrice"`
	DiscountPercent *float64         `gorm:"column:discount_percent" json:"discountPercent"`

	PriceList *PriceList      `gorm:"foreignKey:PriceListID" json:"priceList"`
	Product   *Product        `gorm:"foreignKey:ProductID" json:"product"`
	Variant   *ProductVariant `gorm:"foreignKey:VariantID" json:"variant"`
}

func (PriceListItem) TableName() string {
	return "price_list_items"
}
