package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type dailyProgressRequest struct {
	SiteProjectID    int     `json:"siteProjectId"`
	WorkPackageID    int     `json:"workPackageId"`
	Date             string  `json:"date"`
	QtyCompleted     string  `json:"qtyCompleted"`
	Unit             string  `json:"unit"`
	WeatherCondition *string `json:"weatherCondition"`
	Remarks          *string `json:"remarks"`
	RecordedBy       *string `json:"recordedBy"`
}

func (r dailyProgressRequest) toModel() models.DailyProgress {
	qty, _ := decimal.NewFromString(r.QtyCompleted)
	unit := r.Unit
	if unit == "" {
		unit = "LS"
	}
	return models.DailyProgress{
		SiteProjectID:    r.SiteProjectID,
		WorkPackageID:    r.WorkPackageID,
		Date:             r.Date,
		QtyCompleted:     qty,
		Unit:             unit,
		WeatherCondition: r.WeatherCondition,
		Remarks:          r.Remarks,
		RecordedBy:       r.RecordedBy,
	}
}

type DailyProgressHandler struct {
	service *service.DailyProgressService
}

func NewDailyProgressHandler(s *service.DailyProgressService) *DailyProgressHandler {
	return &DailyProgressHandler{service: s}
}

// GetByProject GET /api/site-projects/{projectId}/daily-progress
func (h *DailyProgressHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	date := r.URL.Query().Get("date")
	records, err := h.service.GetByProject(projectID, date)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Daily progress records retrieved", records)
}

// GetByID GET /api/daily-progress/{id}
func (h *DailyProgressHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	rec, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Record retrieved", rec)
}

// Create POST /api/daily-progress
func (h *DailyProgressHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dailyProgressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.SiteProjectID == 0 || req.WorkPackageID == 0 {
		util.SendError(w, http.StatusBadRequest, "SiteProjectID and WorkPackageID are required")
		return
	}
	if req.Date == "" {
		util.SendError(w, http.StatusBadRequest, "Date is required")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	rec, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Daily progress created", "id", rec.ID, "date", rec.Date, "user", user.Email)
	util.SendSuccess(w, "Daily progress recorded", rec)
}

// Update PUT /api/daily-progress/{id}
func (h *DailyProgressHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req dailyProgressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email
	rec, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Daily progress updated", rec)
}

// Delete DELETE /api/daily-progress/{id}
func (h *DailyProgressHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Daily progress deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Deleted", map[string]int{"id": id})
}
