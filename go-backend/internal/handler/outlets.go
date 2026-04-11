package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type OutletsHandler struct {
	db *gorm.DB
}

func NewOutletsHandler(db *gorm.DB) *OutletsHandler {
	return &OutletsHandler{db: db}
}

// GetAll retrieves all outlets
func (h *OutletsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	var outlets []models.Outlet
	if err := h.db.Order("name ASC").Find(&outlets).Error; err != nil {
		slog.Error("[OutletsHandler] Failed to get outlets", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to load outlets")
		return
	}

	util.SendSuccess(w, "Success", outlets)
}

// GetByID retrieves a single outlet by ID
func (h *OutletsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	var outlet models.Outlet
	if err := h.db.Where("id = ?", id).First(&outlet).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			util.SendError(w, http.StatusNotFound, "Outlet not found")
		} else {
			slog.Error("[OutletsHandler] Failed to get outlet", "error", err, "id", id)
			util.SendError(w, http.StatusInternalServerError, "Failed to load outlet")
		}
		return
	}

	util.SendSuccess(w, "Success", outlet)
}

// Create creates a new outlet (SUPER_ADMIN only)
func (h *OutletsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var outlet models.Outlet
	if err := json.NewDecoder(r.Body).Decode(&outlet); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.db.Create(&outlet).Error; err != nil {
		slog.Error("[OutletsHandler] Failed to create outlet", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to create outlet")
		return
	}

	util.SendSuccess(w, "Outlet created", outlet)
}

// Update updates an existing outlet
func (h *OutletsHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	var outlet models.Outlet
	if err := h.db.Where("id = ?", id).First(&outlet).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			util.SendError(w, http.StatusNotFound, "Outlet not found")
		} else {
			slog.Error("[OutletsHandler] Failed to get outlet", "error", err)
			util.SendError(w, http.StatusInternalServerError, "Failed to load outlet")
		}
		return
	}

	var updateData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Remove nested relations from update
	delete(updateData, "users")
	delete(updateData, "inventories")

	if err := h.db.Model(&outlet).Updates(updateData).Error; err != nil {
		slog.Error("[OutletsHandler] Failed to update outlet", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to update outlet")
		return
	}

	util.SendSuccess(w, "Outlet updated", outlet)
}
