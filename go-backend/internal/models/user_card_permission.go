package models

type UserCardPermission struct {
	ID       uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID   int    `gorm:"column:user_id;not null;index" json:"userId"`
	CardKey  string `gorm:"column:card_key;size:100;not null" json:"cardKey"`
	CardType string `gorm:"column:card_type;size:50;not null" json:"cardType"` // 'business' | 'pccp'
}

func (UserCardPermission) TableName() string { return "user_card_permissions" }
