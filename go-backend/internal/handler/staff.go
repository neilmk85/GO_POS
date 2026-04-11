package handler

import (
	"encoding/csv"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type StaffHandler struct {
	db            *gorm.DB
	userService   *StaffUserService
}

// StaffUserService is a wrapper around UserService for staff-specific operations
type StaffUserService interface {
	GetAll(outletID *int) ([]interface{}, error)
}

func NewStaffHandler(db *gorm.DB) *StaffHandler {
	return &StaffHandler{
		db: db,
	}
}

// GetAll retrieves all staff users, optionally filtered by outlet
func (h *StaffHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	var outletID *int
	if outletIDStr != "" {
		id, err := strconv.Atoi(outletIDStr)
		if err != nil {
			util.SendError(w, http.StatusBadRequest, "Invalid outletId")
			return
		}
		outletID = &id
	}

	var users []models.User
	query := h.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Order("name ASC")

	if outletID != nil {
		query = query.Where("outlet_id = ?", *outletID)
	}

	if err := query.Find(&users).Error; err != nil {
		slog.Error("[StaffHandler] Failed to get staff", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to load staff")
		return
	}

	util.SendSuccess(w, "Success", users)
}

// ExportCSV exports staff data as CSV
func (h *StaffHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	var outletID *int
	if outletIDStr != "" {
		id, err := strconv.Atoi(outletIDStr)
		if err != nil {
			util.SendError(w, http.StatusBadRequest, "Invalid outletId")
			return
		}
		outletID = &id
	}

	var users []models.User
	query := h.db.
		Preload("UserRoles", func(db *gorm.DB) *gorm.DB {
			return db.Preload("Role")
		}).
		Preload("Outlet").
		Order("name ASC")

	if outletID != nil {
		query = query.Where("outlet_id = ?", *outletID)
	}

	if err := query.Find(&users).Error; err != nil {
		slog.Error("[StaffHandler] Failed to get staff for export", "error", err)
		util.SendError(w, http.StatusInternalServerError, "Failed to load staff")
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=staff_export.csv")
	w.Header().Set("Content-Type", "text/csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"name", "email", "phone", "roles", "outlet", "active"})

	// Write data
	for _, user := range users {
		roles := ""
		for i, ur := range user.UserRoles {
			if i > 0 {
				roles += ";"
			}
			if ur.Role != nil {
				roles += string(ur.Role.Name)
			}
		}

		outletName := ""
		if user.Outlet != nil {
			outletName = user.Outlet.Name
		}

		phone := ""
		if user.Phone != nil {
			phone = *user.Phone
		}

		active := "false"
		if user.Active {
			active = "true"
		}

		writer.Write([]string{user.Name, user.Email, phone, roles, outletName, active})
	}
}
