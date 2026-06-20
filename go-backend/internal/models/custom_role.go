package models

type CustomRole struct {
	ID          int     `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name        string  `gorm:"uniqueIndex;size:191;column:name" json:"name"`
	DisplayName string  `gorm:"column:display_name" json:"displayName"`
	Description *string `gorm:"column:description" json:"description"`
	Permissions *string `gorm:"column:permissions;type:json" json:"permissions"`
	Color       *string `gorm:"column:color" json:"color"`
	Active      bool    `gorm:"column:is_active;default:true" json:"active"`
}

func (CustomRole) TableName() string {
	return "custom_roles"
}
