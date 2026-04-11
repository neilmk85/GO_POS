package models

type DiscountCategory struct {
	DiscountID int `gorm:"primaryKey;column:discount_id" json:"discountId"`
	CategoryID int `gorm:"primaryKey;column:category_id" json:"categoryId"`

	Discount *Discount  `gorm:"foreignKey:DiscountID" json:"discount"`
	Category *Category  `gorm:"foreignKey:CategoryID" json:"category"`
}

func (DiscountCategory) TableName() string {
	return "discount_categories"
}
