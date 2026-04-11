package models

type PriceListCustomer struct {
	PriceListID int `gorm:"primaryKey;column:price_list_id" json:"priceListId"`
	CustomerID  int `gorm:"primaryKey;column:customer_id" json:"customerId"`

	PriceList *PriceList `gorm:"foreignKey:PriceListID" json:"priceList"`
	Customer  *Customer  `gorm:"foreignKey:CustomerID" json:"customer"`
}

func (PriceListCustomer) TableName() string {
	return "price_list_customers"
}
