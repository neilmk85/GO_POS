package models

import "time"

type StockTransfer struct {
	ID             int            `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	TransferNumber string         `gorm:"uniqueIndex;column:transfer_number" json:"transferNumber"`
	FromOutletID   int            `gorm:"column:from_outlet_id" json:"fromOutletId"`
	ToOutletID     int            `gorm:"column:to_outlet_id" json:"toOutletId"`
	RequestedByID  *int           `gorm:"column:requested_by" json:"requestedById"`
	ApprovedByID   *int           `gorm:"column:approved_by" json:"approvedById"`
	ReceivedByID   *int           `gorm:"column:received_by" json:"receivedById"`
	Status         TransferStatus `gorm:"column:status;default:REQUESTED" json:"status"`
	Notes          *string        `gorm:"column:notes" json:"notes"`
	Reason         *string        `gorm:"column:reason" json:"reason"`
	CreatedAt      time.Time      `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time      `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	CreatedBy      *string        `gorm:"column:created_by" json:"createdBy"`
	UpdatedBy      *string        `gorm:"column:updated_by" json:"updatedBy"`

	FromOutlet  *Outlet              `gorm:"foreignKey:FromOutletID;references:ID" json:"fromOutlet"`
	ToOutlet    *Outlet              `gorm:"foreignKey:ToOutletID;references:ID" json:"toOutlet"`
	RequestedBy *User                `gorm:"foreignKey:RequestedByID;references:ID" json:"requestedBy"`
	ApprovedBy  *User                `gorm:"foreignKey:ApprovedByID;references:ID" json:"approvedBy"`
	ReceivedBy  *User                `gorm:"foreignKey:ReceivedByID;references:ID" json:"receivedBy"`
	Items       []StockTransferItem  `gorm:"foreignKey:TransferID" json:"items,omitempty"`
}

func (StockTransfer) TableName() string {
	return "stock_transfers"
}
