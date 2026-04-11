package models

import "time"

type PriceList struct {
	ID          int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name        string     `gorm:"column:name" json:"name"`
	Description *string    `gorm:"column:description" json:"description"`
	Active      bool       `gorm:"column:is_active;default:true" json:"active"`
	Priority    int        `gorm:"column:priority;default:0" json:"priority"`
	StartDate   *time.Time `gorm:"column:start_date" json:"startDate"`
	EndDate     *time.Time `gorm:"column:end_date" json:"endDate"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`

	Items     []PriceListItem     `gorm:"foreignKey:PriceListID" json:"items,omitempty"`
	Segments  []PriceListSegment  `gorm:"foreignKey:PriceListID" json:"segments,omitempty"`
	Customers []PriceListCustomer `gorm:"foreignKey:PriceListID" json:"customers,omitempty"`
}

func (PriceList) TableName() string {
	return "price_lists"
}
