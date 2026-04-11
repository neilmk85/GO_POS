package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

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

	util.SendSuccess(w, "Custom roles retrieved", roles)
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

	util.SendSuccess(w, "Custom role retrieved", role)
}

// Create creates a new custom role
func (crh *CustomRoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CustomRole
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		util.SendError(w, http.StatusBadRequest, "Name is required")
		return
	}

	req.Active = true

	if err := crh.db.Create(&req).Error; err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role created", req)
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

	var req models.CustomRole
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

	// Update fields
	if req.DisplayName != "" {
		role.DisplayName = req.DisplayName
	}
	if req.Description != nil {
		role.Description = req.Description
	}
	if req.Permissions != nil {
		role.Permissions = req.Permissions
	}
	if req.Color != nil {
		role.Color = req.Color
	}

	if err := crh.db.Save(role).Error; err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Custom role updated", role)
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
