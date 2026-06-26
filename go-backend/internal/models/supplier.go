package models

import "time"

type Supplier struct {
	ID            int             `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name          string          `gorm:"column:name" json:"name"`
	ContactPerson *string         `gorm:"column:contact_person" json:"contactPerson"`
	Phone         *string         `gorm:"column:phone" json:"phone"`
	Email         *string         `gorm:"column:email" json:"email"`
	Address       *string         `gorm:"column:address" json:"address"`
	City          *string         `gorm:"column:city" json:"city"`
	State         *string         `gorm:"column:state" json:"state"`
	Pincode       *string         `gorm:"column:pincode" json:"pincode"`
	GSTIN         *string         `gorm:"column:gstin" json:"gstin"`
	PAN           *string         `gorm:"column:pan" json:"pan"`
	PaymentTerms  *int            `gorm:"column:payment_terms" json:"paymentTerms"`
	TDSSectionID  *int            `gorm:"column:tds_section_id" json:"tdsSectionId"`
	VendorType    *string         `gorm:"column:vendor_type;size:50" json:"vendorType"`
	Notes         *string         `gorm:"column:notes;type:text" json:"notes"`
	Active        bool            `gorm:"column:is_active;default:true" json:"active"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy     *string         `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy     *string         `gorm:"column:updated_by" json:"updatedBy"`

	TDSSection     *TDSSection     `gorm:"foreignKey:TDSSectionID" json:"tdsSection,omitempty"`
	PurchaseOrders []PurchaseOrder `gorm:"foreignKey:SupplierID" json:"purchaseOrders,omitempty"`
	PurchaseBills  []PurchaseBill  `gorm:"foreignKey:SupplierID" json:"purchaseBills,omitempty"`
}

func (Supplier) TableName() string {
	return "suppliers"
}
