package service

import (
	"fmt"
	"log/slog"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// UserResponse represents a user with roles and outlet
type UserResponse struct {
	ID                 int          `json:"id"`
	Name               string       `json:"name"`
	Email              string       `json:"email"`
	Phone              *string      `json:"phone"`
	EmployeeCode       *string      `json:"employeeCode"`
	PinCode            *string      `json:"pinCode"`
	OutletID           *int         `json:"outletId"`
	Active             bool         `json:"active"`
	LastLogin          *string      `json:"lastLogin"`
	ProfileImage       *string      `json:"profileImage"`
	MaxDiscountPercent float64      `json:"maxDiscountPercent"`
	CreatedAt          string       `json:"createdAt"`
	UpdatedAt          string       `json:"updatedAt"`
	CreatedBy          *string      `json:"createdBy"`
	UpdatedBy          *string      `json:"updatedBy"`
	Roles              []string     `json:"roles"`
	Outlet             *models.Outlet `json:"outlet"`
}

// CreateUserRequest represents the request to create a user
type CreateUserRequest struct {
	Name               string   `json:"name"`
	Email              string   `json:"email"`
	Password           string   `json:"password"`
	Phone              *string  `json:"phone"`
	EmployeeCode       *string  `json:"employeeCode"`
	PinCode            *string  `json:"pinCode"`
	OutletID           *int     `json:"outletId"`
	Roles              []string `json:"roles"`
	MaxDiscountPercent *float64 `json:"maxDiscountPercent"`
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	Name               *string  `json:"name"`
	Phone              *string  `json:"phone"`
	EmployeeCode       *string  `json:"employeeCode"`
	PinCode            *string  `json:"pinCode"`
	OutletID           *int     `json:"outletId"`
	Roles              []string `json:"roles"`
	MaxDiscountPercent *float64 `json:"maxDiscountPercent"`
	ProfileImage       *string  `json:"profileImage"`
}

// UpdateProfileRequest represents the request to update own profile
type UpdateProfileRequest struct {
	Name         *string `json:"name"`
	Phone        *string `json:"phone"`
	ProfileImage *string `json:"profileImage"`
}

// toUserResponse converts a User model to UserResponse
func (s *UserService) toUserResponse(user *models.User) *UserResponse {
	roles := make([]string, 0, len(user.UserRoles))
	for _, ur := range user.UserRoles {
		if ur.Role != nil {
			roles = append(roles, string(ur.Role.Name))
		}
	}

	lastLogin := ""
	if user.LastLogin != nil {
		lastLogin = user.LastLogin.Format("2006-01-02T15:04:05Z07:00")
	}

	return &UserResponse{
		ID:                 user.ID,
		Name:               user.Name,
		Email:              user.Email,
		Phone:              user.Phone,
		EmployeeCode:       user.EmployeeCode,
		PinCode:            user.PinCode,
		OutletID:           user.OutletID,
		Active:             user.Active,
		LastLogin:          &lastLogin,
		ProfileImage:       user.ProfileImage,
		MaxDiscountPercent: user.MaxDiscountPercent,
		CreatedAt:          user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:          user.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		CreatedBy:          user.CreatedBy,
		UpdatedBy:          user.UpdatedBy,
		Roles:              roles,
		Outlet:             user.Outlet,
	}
}

// GetAll returns all users with roles and outlet, optionally filtered by outlet
func (s *UserService) GetAll(outletID *int) ([]UserResponse, error) {
	var users []models.User
	query := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Order("created_at DESC")

	if outletID != nil {
		query = query.Where("outlet_id = ?", *outletID)
	}

	if err := query.Find(&users).Error; err != nil {
		slog.Error("[UserService] Failed to get all users", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load users",
		}
	}

	responses := make([]UserResponse, 0, len(users))
	for i := range users {
		responses = append(responses, *s.toUserResponse(&users[i]))
	}

	return responses, nil
}

// GetByID returns a single user by ID
func (s *UserService) GetByID(id int) (*UserResponse, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("id = ?", id).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{
				Message: fmt.Sprintf("User not found"),
			}
		}
		slog.Error("[UserService] Failed to get user by ID", "error", err, "id", id)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load user",
		}
	}

	return s.toUserResponse(&user), nil
}

// GetByOutlet returns all users for a specific outlet
func (s *UserService) GetByOutlet(outletID int) ([]UserResponse, error) {
	return s.GetAll(&outletID)
}

// Create creates a new user
func (s *UserService) Create(req *CreateUserRequest) (*UserResponse, error) {
	// Check if email already exists
	var existingUser models.User
	err := s.db.Where("email = ?", req.Email).First(&existingUser).Error
	if err == nil {
		return nil, &util.BusinessException{
			StatusCode: 400,
			Message:    fmt.Sprintf("Email already in use: %s", req.Email),
		}
	}
	if err != gorm.ErrRecordNotFound {
		slog.Error("[UserService] Failed to check email uniqueness", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	// Get role IDs
	var roleIDs []int
	if len(req.Roles) > 0 {
		var roles []models.Role
		if err := s.db.Where("name IN ?", req.Roles).Find(&roles).Error; err != nil {
			slog.Error("[UserService] Failed to find roles", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message:    "One or more roles not found",
			}
		}
		for _, role := range roles {
			roleIDs = append(roleIDs, role.ID)
		}
	} else {
		// Default role: CASHIER
		var cashierRole models.Role
		if err := s.db.Where("name = ?", models.RoleCashier).First(&cashierRole).Error; err == nil {
			roleIDs = append(roleIDs, cashierRole.ID)
		}
	}

	// Hash password
	hashedPassword, err := util.HashPassword(req.Password)
	if err != nil {
		slog.Error("[UserService] Failed to hash password", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	maxDiscount := 10.0
	if req.MaxDiscountPercent != nil {
		maxDiscount = *req.MaxDiscountPercent
	}

	// Create user
	user := &models.User{
		Name:               req.Name,
		Email:              req.Email,
		Password:           hashedPassword,
		Phone:              req.Phone,
		EmployeeCode:       req.EmployeeCode,
		PinCode:            req.PinCode,
		OutletID:           req.OutletID,
		Active:             true,
		MaxDiscountPercent: maxDiscount,
	}

	if err := s.db.Create(user).Error; err != nil {
		slog.Error("[UserService] Failed to create user", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to create user",
		}
	}

	// Create user roles
	for _, roleID := range roleIDs {
		userRole := &models.UserRole{
			UserID: user.ID,
			RoleID: roleID,
		}
		if err := s.db.Create(userRole).Error; err != nil {
			slog.Error("[UserService] Failed to create user role", "error", err)
		}
	}

	// Reload user with roles and outlet
	user, err = s.getUserWithRoles(req.Email)
	if err != nil {
		slog.Error("[UserService] Failed to reload user after creation", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to load created user",
		}
	}

	return s.toUserResponse(user), nil
}

// Update updates an existing user
func (s *UserService) Update(id int, req *UpdateUserRequest) (*UserResponse, error) {
	// Check if user exists
	user, err := s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	updateData := map[string]interface{}{}

	if req.Name != nil {
		updateData["name"] = *req.Name
		user.Name = *req.Name
	}
	if req.Phone != nil {
		updateData["phone"] = *req.Phone
		user.Phone = req.Phone
	}
	if req.EmployeeCode != nil {
		updateData["employee_code"] = *req.EmployeeCode
		user.EmployeeCode = req.EmployeeCode
	}
	if req.PinCode != nil {
		updateData["pin_code"] = *req.PinCode
		user.PinCode = req.PinCode
	}
	if req.OutletID != nil {
		updateData["outlet_id"] = *req.OutletID
		user.OutletID = req.OutletID
	}
	if req.MaxDiscountPercent != nil {
		updateData["max_discount_percent"] = *req.MaxDiscountPercent
		user.MaxDiscountPercent = *req.MaxDiscountPercent
	}
	if req.ProfileImage != nil {
		updateData["profile_image"] = *req.ProfileImage
		user.ProfileImage = req.ProfileImage
	}

	// Update roles if provided
	if len(req.Roles) > 0 {
		// Delete existing roles
		if err := s.db.Where("user_id = ?", id).Delete(&models.UserRole{}).Error; err != nil {
			slog.Error("[UserService] Failed to delete user roles", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update user roles",
			}
		}

		// Get new role IDs
		var roles []models.Role
		if err := s.db.Where("name IN ?", req.Roles).Find(&roles).Error; err != nil {
			slog.Error("[UserService] Failed to find roles", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message:    "One or more roles not found",
			}
		}

		// Create new user roles
		for _, role := range roles {
			userRole := &models.UserRole{
				UserID: id,
				RoleID: role.ID,
			}
			if err := s.db.Create(userRole).Error; err != nil {
				slog.Error("[UserService] Failed to create user role", "error", err)
			}
		}
	}

	if len(updateData) > 0 {
		if err := s.db.Model(user).Updates(updateData).Error; err != nil {
			slog.Error("[UserService] Failed to update user", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update user",
			}
		}
	}

	// Reload with roles and outlet
	user, err = s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// ToggleActive toggles the active status of a user
func (s *UserService) ToggleActive(id int) (*UserResponse, error) {
	user, err := s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	newActive := !user.Active
	if err := s.db.Model(user).Update("is_active", newActive).Error; err != nil {
		slog.Error("[UserService] Failed to toggle user active", "error", err)
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to toggle user active status",
		}
	}

	user.Active = newActive

	// Reload with roles and outlet
	user, err = s.getUserByID(id)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// ResetPassword changes a user's password
func (s *UserService) ResetPassword(id int, newPassword string) error {
	user, err := s.getUserByID(id)
	if err != nil {
		return err
	}

	hashedPassword, err := util.HashPassword(newPassword)
	if err != nil {
		slog.Error("[UserService] Failed to hash password", "error", err)
		return &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	if err := s.db.Model(user).Update("password", hashedPassword).Error; err != nil {
		slog.Error("[UserService] Failed to reset password", "error", err)
		return &util.BusinessException{
			StatusCode: 500,
			Message:    "Failed to reset password",
		}
	}

	return nil
}

// ChangePassword changes a user's password with current password verification
func (s *UserService) ChangePassword(id int, currentPassword, newPassword string) error {
	user, err := s.getUserByID(id)
	if err != nil {
		return err
	}

	// Verify current password
	if !util.ComparePassword(currentPassword, user.Password) {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "Current password is incorrect",
		}
	}

	return s.ResetPassword(id, newPassword)
}

// GetProfile returns the profile of the current user
func (s *UserService) GetProfile(userID int) (*UserResponse, error) {
	return s.GetByID(userID)
}

// UpdateProfile updates the profile of the current user
func (s *UserService) UpdateProfile(userID int, req *UpdateProfileRequest) (*UserResponse, error) {
	user, err := s.getUserByID(userID)
	if err != nil {
		return nil, err
	}

	updateData := map[string]interface{}{}

	if req.Name != nil {
		updateData["name"] = *req.Name
		user.Name = *req.Name
	}
	if req.Phone != nil {
		updateData["phone"] = *req.Phone
		user.Phone = req.Phone
	}
	if req.ProfileImage != nil {
		updateData["profile_image"] = *req.ProfileImage
		user.ProfileImage = req.ProfileImage
	}

	if len(updateData) > 0 {
		if err := s.db.Model(user).Updates(updateData).Error; err != nil {
			slog.Error("[UserService] Failed to update profile", "error", err)
			return nil, &util.BusinessException{
				StatusCode: 500,
				Message:    "Failed to update profile",
			}
		}
	}

	// Reload with roles and outlet
	user, err = s.getUserByID(userID)
	if err != nil {
		return nil, err
	}

	return s.toUserResponse(user), nil
}

// Helper function to get user with roles and outlet
func (s *UserService) getUserWithRoles(email string) (*models.User, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("email = ?", email).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

// Helper function to get user by ID with roles and outlet
func (s *UserService) getUserByID(id int) (*models.User, error) {
	var user models.User
	err := s.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Where("id = ?", id).
		First(&user).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{
				Message: "User not found",
			}
		}
		return nil, &util.BusinessException{
			StatusCode: 500,
			Message:    "Internal server error",
		}
	}

	return &user, nil
}
