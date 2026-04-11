package models

type UserRole struct {
	UserID int `gorm:"primaryKey;column:user_id" json:"userId"`
	RoleID int `gorm:"primaryKey;column:role_id" json:"roleId"`

	User *User `gorm:"foreignKey:UserID" json:"user"`
	Role *Role `gorm:"foreignKey:RoleID" json:"role"`
}

func (UserRole) TableName() string {
	return "user_roles"
}
