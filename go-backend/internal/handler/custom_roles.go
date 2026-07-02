package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type customRoleReq struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	Color       string   `json:"color"`
}

type customRoleResp struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	DisplayName string   `json:"displayName"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
	Color       *string  `json:"color"`
	Active      bool     `json:"active"`
}

func toCustomRoleResp(r models.CustomRole) customRoleResp {
	perms := []string{}
	if r.Permissions != nil && *r.Permissions != "" {
		_ = json.Unmarshal([]byte(*r.Permissions), &perms)
	}
	return customRoleResp{
		ID:          r.ID,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		Description: r.Description,
		Permissions: perms,
		Color:       r.Color,
		Active:      r.Active,
	}
}

func (req customRoleReq) toModel() models.CustomRole {
	permsJSON, _ := json.Marshal(req.Permissions)
	permsStr := string(permsJSON)
	role := models.CustomRole{
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Active:      true,
	}
	if req.Description != "" {
		role.Description = &req.Description
	}
	role.Permissions = &permsStr
	if req.Color != "" {
		role.Color = &req.Color
	}
	return role
}

type CustomRoleHandler struct {
	db *gorm.DB
}

func NewCustomRoleHandler(db *gorm.DB) *CustomRoleHandler {
	return &CustomRoleHandler{db: db}
}

// GetAll retrieves all active custom roles
func (crh *CustomRoleHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	var roles []models.CustomRole
	if err := crh.db.Where("is_active = ?", true).Find(&roles).Error; err != nil {
		handleError(w, err)
		return
	}

	resp := make([]customRoleResp, len(roles))
	for i, r := range roles {
		resp[i] = toCustomRoleResp(r)
	}
	util.SendSuccess(w, "Custom roles retrieved", resp)
}

// GetByID retrieves a specific custom role by ID
func (crh *CustomRoleHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		util.SendError(w, http.StatusBadRequest, "ID is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	role := &models.CustomRole{}
	if err := crh.db.First(role, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			util.SendError(w, http.StatusNotFound, "Custom role not found")
			return
		}
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role retrieved", toCustomRoleResp(*role))
}

// Create creates a new custom role
func (crh *CustomRoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req customRoleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		util.SendError(w, http.StatusBadRequest, "Name is required")
		return
	}

	role := req.toModel()
	if err := crh.db.Create(&role).Error; err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role created", toCustomRoleResp(role))
}

// Update updates a custom role
func (crh *CustomRoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		util.SendError(w, http.StatusBadRequest, "ID is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req customRoleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	role := &models.CustomRole{}
	if err := crh.db.First(role, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			util.SendError(w, http.StatusNotFound, "Custom role not found")
			return
		}
		handleError(w, err)
		return
	}

	if req.DisplayName != "" {
		role.DisplayName = req.DisplayName
	}
	if req.Description != "" {
		role.Description = &req.Description
	}
	permsJSON, _ := json.Marshal(req.Permissions)
	permsStr := string(permsJSON)
	role.Permissions = &permsStr
	if req.Color != "" {
		role.Color = &req.Color
	}

	if err := crh.db.Save(role).Error; err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role updated", toCustomRoleResp(*role))
}

// Delete deletes a custom role (soft delete by marking inactive)
func (crh *CustomRoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		util.SendError(w, http.StatusBadRequest, "ID is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	role := &models.CustomRole{}
	if err := crh.db.First(role, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			util.SendError(w, http.StatusNotFound, "Custom role not found")
			return
		}
		handleError(w, err)
		return
	}

	if err := crh.db.Model(role).Update("is_active", false).Error; err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role deleted", nil)
}
