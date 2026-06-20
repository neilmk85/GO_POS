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

type labourAttendanceRequest struct {
	SiteProjectID int     `json:"siteProjectId"`
	WorkPackageID *int    `json:"workPackageId"`
	Date          string  `json:"date"`
	Category      string  `json:"category"`
	Count         int     `json:"count"`
	WagePerHead   string  `json:"wagePerHead"`
	TotalWages    string  `json:"totalWages"`
	RecordedBy    *string `json:"recordedBy"`
	Notes         *string `json:"notes"`
}

func (r labourAttendanceRequest) toModel() models.LabourAttendance {
	wage, _ := decimal.NewFromString(r.WagePerHead)
	total, _ := decimal.NewFromString(r.TotalWages)
	return models.LabourAttendance{
		SiteProjectID: r.SiteProjectID,
		WorkPackageID: r.WorkPackageID,
		Date:          r.Date,
		Category:      r.Category,
		Count:         r.Count,
		WagePerHead:   wage,
		TotalWages:    total,
		RecordedBy:    r.RecordedBy,
		Notes:         r.Notes,
	}
}

type LabourAttendanceHandler struct {
	service *service.LabourAttendanceService
}

func NewLabourAttendanceHandler(s *service.LabourAttendanceService) *LabourAttendanceHandler {
	return &LabourAttendanceHandler{service: s}
}

// GetByProject GET /api/site-projects/{projectId}/labour-attendance
func (h *LabourAttendanceHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
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
	util.SendSuccess(w, "Labour attendance records retrieved", records)
}

// GetByID GET /api/labour-attendance/{id}
func (h *LabourAttendanceHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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

// Create POST /api/labour-attendance
func (h *LabourAttendanceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req labourAttendanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.SiteProjectID == 0 {
		util.SendError(w, http.StatusBadRequest, "SiteProjectID is required")
		return
	}
	if req.Date == "" {
		util.SendError(w, http.StatusBadRequest, "Date is required")
		return
	}
	if req.Category == "" {
		util.SendError(w, http.StatusBadRequest, "Category is required")
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
	slog.Info("Labour attendance created", "id", rec.ID, "date", rec.Date, "user", user.Email)
	util.SendSuccess(w, "Labour attendance recorded", rec)
}

// Update PUT /api/labour-attendance/{id}
func (h *LabourAttendanceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req labourAttendanceRequest
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
	util.SendSuccess(w, "Labour attendance updated", rec)
}

// Delete DELETE /api/labour-attendance/{id}
func (h *LabourAttendanceHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	slog.Info("Labour attendance deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Deleted", map[string]int{"id": id})
}
