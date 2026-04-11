package models

type Role struct {
	ID        int        `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	Name      RoleName   `gorm:"uniqueIndex;column:name;type:varchar(50)" json:"name"`
	UserRoles []UserRole `gorm:"foreignKey:RoleID" json:"userRoles,omitempty"`
}

func (Role) TableName() string {
	return "roles"
}
