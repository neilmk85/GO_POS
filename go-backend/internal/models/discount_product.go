package models

type DiscountProduct struct {
	DiscountID int `gorm:"primaryKey;column:discount_id" json:"discountId"`
	ProductID  int `gorm:"primaryKey;column:product_id" json:"productId"`

	Discount *Discount `gorm:"foreignKey:DiscountID" json:"discount"`
	Product  *Product  `gorm:"foreignKey:ProductID" json:"product"`
}

func (DiscountProduct) TableName() string {
	return "discount_products"
}
