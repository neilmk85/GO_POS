package models

import "time"

type CartHold struct {
	ID        int       `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	UserID    int       `gorm:"column:user_id;index" json:"userId"`
	OutletID  int       `gorm:"column:outlet_id;index" json:"outletId"`
	CartData  string    `gorm:"column:cart_data;type:text" json:"cartData"`
	Note      string    `gorm:"column:note" json:"note"`
	HeldAt    time.Time `gorm:"column:held_at" json:"heldAt"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"-"`
}

func (CartHold) TableName() string { return "cart_holds" }
