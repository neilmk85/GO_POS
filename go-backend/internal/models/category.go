package models

import "time"

type Category struct {
	ID          int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name        string     `gorm:"column:name" json:"name"`
	Description *string    `gorm:"column:description" json:"description"`
	ImageURL    *string    `gorm:"column:image_url" json:"imageUrl"`
	DisplayOrder int       `gorm:"column:display_order;default:0" json:"displayOrder"`
	Active      bool       `gorm:"column:is_active;default:true" json:"active"`
	ParentID    *int       `gorm:"column:parent_id" json:"parentId"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy   *string    `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy   *string    `gorm:"column:updated_by" json:"updatedBy"`

	Parent               *Category          `gorm:"foreignKey:ParentID" json:"parent"`
	Children             []Category         `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Products             []Product          `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
	DiscountCategories   []DiscountCategory `gorm:"foreignKey:CategoryID" json:"discountCategories,omitempty"`
}

func (Category) TableName() string {
	return "categories"
}
