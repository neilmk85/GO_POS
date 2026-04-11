package models

type ProductImage struct {
	ID           int    `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	ProductID    int    `gorm:"column:product_id" json:"productId"`
	ImageURL     string `gorm:"column:image_url" json:"imageUrl"`
	Primary      bool   `gorm:"column:is_primary;default:false" json:"primary"`
	DisplayOrder int    `gorm:"column:display_order;default:0" json:"displayOrder"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
}

func (ProductImage) TableName() string {
	return "product_images"
}
