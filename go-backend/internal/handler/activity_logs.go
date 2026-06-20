package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type ActivityLogHandler struct {
	db *gorm.DB
}

func NewActivityLogHandler(db *gorm.DB) *ActivityLogHandler {
	return &ActivityLogHandler{db: db}
}

// GetAll retrieves paginated activity logs with optional filters
func (alh *ActivityLogHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("userId")
	module := r.URL.Query().Get("module")
	action := r.URL.Query().Get("action")
	search := r.URL.Query().Get("search")
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	var userID *int
	var from, to *time.Time

	if userIDStr != "" {
		id, err := strconv.Atoi(userIDStr)
		if err == nil {
			userID = &id
		}
	}

	if fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr+"T00:00:00Z")
		if err == nil {
			from = &t
		}
	}

	if toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr+"T23:59:59Z")
		if err == nil {
			to = &t
		}
	}

	page, size := util.ParsePagination(r)

	// Build query — outletID is accepted but not used as a hard filter
	// so logs created before outlet tracking was added are still visible
	query := alh.db
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if module != "" {
		query = query.Where("module = ?", module)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if from != nil && to != nil {
		query = query.Where("created_at BETWEEN ? AND ?", from, to)
	}
	if search != "" {
		query = query.Where(
			"description LIKE ? OR user_name LIKE ? OR user_email LIKE ? OR module LIKE ?",
			"%"+search+"%",
			"%"+search+"%",
			"%"+search+"%",
			"%"+search+"%",
		)
	}

	// Count total
	var total int64
	if err := query.Model(&models.ActivityLog{}).Count(&total).Error; err != nil {
		handleError(w, err)
		return
	}

	// Fetch paginated results
	var logs []models.ActivityLog
	if err := query.Order("created_at DESC").
		Offset(page * size).
		Limit(size).
		Find(&logs).Error; err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, logs, total, totalPages, size, page)
}
