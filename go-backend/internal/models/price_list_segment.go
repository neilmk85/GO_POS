package models

type PriceListSegment struct {
	PriceListID int             `gorm:"primaryKey;column:price_list_id" json:"priceListId"`
	Segment     CustomerSegment `gorm:"primaryKey;column:segment" json:"segment"`

	PriceList *PriceList `gorm:"foreignKey:PriceListID" json:"priceList"`
}

func (PriceListSegment) TableName() string {
	return "price_list_segments"
}
