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

type equipmentLogRequest struct {
	SiteProjectID int     `json:"siteProjectId"`
	WorkPackageID *int    `json:"workPackageId"`
	Date          string  `json:"date"`
	EquipmentName string  `json:"equipmentName"`
	EquipmentType *string `json:"equipmentType"`
	HoursWorked   string  `json:"hoursWorked"`
	IdleHours     string  `json:"idleHours"`
	FuelConsumed  string  `json:"fuelConsumed"`
	OperatorName  *string `json:"operatorName"`
	Remarks       *string `json:"remarks"`
	RecordedBy    *string `json:"recordedBy"`
}

func (r equipmentLogRequest) toModel() models.EquipmentLog {
	hours, _ := decimal.NewFromString(r.HoursWorked)
	idle, _ := decimal.NewFromString(r.IdleHours)
	fuel, _ := decimal.NewFromString(r.FuelConsumed)
	return models.EquipmentLog{
		SiteProjectID: r.SiteProjectID,
		WorkPackageID: r.WorkPackageID,
		Date:          r.Date,
		EquipmentName: r.EquipmentName,
		EquipmentType: r.EquipmentType,
		HoursWorked:   hours,
		IdleHours:     idle,
		FuelConsumed:  fuel,
		OperatorName:  r.OperatorName,
		Remarks:       r.Remarks,
		RecordedBy:    r.RecordedBy,
	}
}

type EquipmentLogHandler struct {
	service *service.EquipmentLogService
}

func NewEquipmentLogHandler(s *service.EquipmentLogService) *EquipmentLogHandler {
	return &EquipmentLogHandler{service: s}
}

// GetByProject GET /api/site-projects/{projectId}/equipment-logs
func (h *EquipmentLogHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
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
	util.SendSuccess(w, "Equipment logs retrieved", records)
}

// GetByID GET /api/equipment-logs/{id}
func (h *EquipmentLogHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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

// Create POST /api/equipment-logs
func (h *EquipmentLogHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req equipmentLogRequest
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
	if req.EquipmentName == "" {
		util.SendError(w, http.StatusBadRequest, "EquipmentName is required")
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
	slog.Info("Equipment log created", "id", rec.ID, "equipment", rec.EquipmentName, "user", user.Email)
	util.SendSuccess(w, "Equipment log recorded", rec)
}

// Update PUT /api/equipment-logs/{id}
func (h *EquipmentLogHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req equipmentLogRequest
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
	util.SendSuccess(w, "Equipment log updated", rec)
}

// Delete DELETE /api/equipment-logs/{id}
func (h *EquipmentLogHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	slog.Info("Equipment log deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Deleted", map[string]int{"id": id})
}
