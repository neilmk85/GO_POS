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

type workPackageRequest struct {
	SiteProjectID int     `json:"siteProjectId"`
	Phase         string  `json:"phase"`
	Description   string  `json:"description"`
	Location      *string `json:"location"`
	Unit          string  `json:"unit"`
	PlannedQty    string  `json:"plannedQty"`
	ExecutionType string  `json:"executionType"`
	Status        string  `json:"status"`
	Notes         *string `json:"notes"`
}

func (r workPackageRequest) toModel() models.WorkPackage {
	qty, _ := decimal.NewFromString(r.PlannedQty)
	status := r.Status
	if status == "" {
		status = "PLANNED"
	}
	unit := r.Unit
	if unit == "" {
		unit = "LS"
	}
	return models.WorkPackage{
		SiteProjectID: r.SiteProjectID,
		Phase:         r.Phase,
		Description:   r.Description,
		Location:      r.Location,
		Unit:          unit,
		PlannedQty:    qty,
		ExecutionType: r.ExecutionType,
		Status:        status,
		Notes:         r.Notes,
	}
}

type WorkPackageHandler struct {
	service *service.WorkPackageService
}

func NewWorkPackageHandler(s *service.WorkPackageService) *WorkPackageHandler {
	return &WorkPackageHandler{service: s}
}

// GetByProject GET /api/site-projects/{projectId}/work-packages
func (h *WorkPackageHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	execType := r.URL.Query().Get("executionType")
	phase := r.URL.Query().Get("phase")

	var execPtr, phasePtr *string
	if execType != "" {
		execPtr = &execType
	}
	if phase != "" {
		phasePtr = &phase
	}

	pkgs, err := h.service.GetByProject(projectID, execPtr, phasePtr)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Work packages retrieved", pkgs)
}

// GetByID GET /api/work-packages/{id}
func (h *WorkPackageHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid work package ID")
		return
	}
	p, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Work package retrieved", p)
}

// Create POST /api/work-packages
func (h *WorkPackageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req workPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Description == "" {
		util.SendError(w, http.StatusBadRequest, "Description is required")
		return
	}
	if req.ExecutionType != "INHOUSE" && req.ExecutionType != "SUBCONTRACTED" {
		util.SendError(w, http.StatusBadRequest, "ExecutionType must be INHOUSE or SUBCONTRACTED")
		return
	}
	if req.SiteProjectID == 0 {
		util.SendError(w, http.StatusBadRequest, "SiteProjectID is required")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	pkg, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Work package created", "id", pkg.ID, "type", pkg.ExecutionType, "user", user.Email)
	util.SendSuccess(w, "Work package created", pkg)
}

// Update PUT /api/work-packages/{id}
func (h *WorkPackageHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid work package ID")
		return
	}

	var req workPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email

	pkg, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Work package updated", "id", pkg.ID, "user", user.Email)
	util.SendSuccess(w, "Work package updated", pkg)
}

// UpdateStatus PATCH /api/work-packages/{id}/status
func (h *WorkPackageHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid work package ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		util.SendError(w, http.StatusBadRequest, "Status is required")
		return
	}

	pkg, err := h.service.UpdateStatus(id, body.Status)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Status updated", pkg)
}

// Delete DELETE /api/work-packages/{id}
func (h *WorkPackageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid work package ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Work package deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Work package deleted", map[string]int{"id": id})
}
