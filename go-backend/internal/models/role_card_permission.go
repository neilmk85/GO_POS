package models

type RoleCardPermission struct {
	ID       uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleName string `gorm:"column:role_name;size:100;not null;index" json:"roleName"`
	CardKey  string `gorm:"column:card_key;size:100;not null" json:"cardKey"`
	CardType string `gorm:"column:card_type;size:50;not null" json:"cardType"` // 'business' | 'pccp'
}

func (RoleCardPermission) TableName() string { return "role_card_permissions" }
