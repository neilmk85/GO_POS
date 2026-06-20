package models

import "time"

type Contractor struct {
	ID            int       `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name          string    `gorm:"column:name;not null" json:"name"`
	ContactPerson *string   `gorm:"column:contact_person" json:"contactPerson"`
	Phone         *string   `gorm:"column:phone" json:"phone"`
	Email         *string   `gorm:"column:email" json:"email"`
	GSTIN         *string   `gorm:"column:gstin" json:"gstin"`
	PAN           *string   `gorm:"column:pan" json:"pan"`
	Address       *string   `gorm:"column:address" json:"address"`
	City          *string   `gorm:"column:city" json:"city"`
	State         *string   `gorm:"column:state" json:"state"`
	Pincode       *string   `gorm:"column:pincode" json:"pincode"`
	// CIVIL | PIPE_LAYING | CONCRETE | FABRICATION | ELECTRICAL | OTHER
	TradeType     *string   `gorm:"column:trade_type" json:"tradeType"`
	DefaultTDSRate *float64 `gorm:"column:default_tds_rate" json:"defaultTDSRate"`
	Notes         *string   `gorm:"column:notes;type:text" json:"notes"`
	Active        bool      `gorm:"column:is_active;default:true" json:"active"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string   `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string   `gorm:"column:updated_by" json:"updatedBy"`
}

func (Contractor) TableName() string {
	return "contractors"
}
