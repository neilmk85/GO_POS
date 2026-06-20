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

type materialIssueRequest struct {
	SiteProjectID  int     `json:"siteProjectId"`
	WorkOrderID    *int    `json:"workOrderId"`
	WorkPackageID  *int    `json:"workPackageId"`
	IssuedTo       string  `json:"issuedTo"`
	ContractorID   *int    `json:"contractorId"`
	ContractorName *string `json:"contractorName"`
	MaterialName   string  `json:"materialName"`
	Specification  *string `json:"specification"`
	Unit           string  `json:"unit"`
	Qty            string  `json:"qty"`
	IssueDate      string  `json:"issueDate"`
	IssuedBy       *string `json:"issuedBy"`
	VehicleNo      *string `json:"vehicleNo"`
	Notes          *string `json:"notes"`
}

func (r materialIssueRequest) toModel() models.MaterialIssue {
	qty, _ := decimal.NewFromString(r.Qty)
	unit := r.Unit
	if unit == "" {
		unit = "Nos"
	}
	return models.MaterialIssue{
		SiteProjectID:  r.SiteProjectID,
		WorkOrderID:    r.WorkOrderID,
		WorkPackageID:  r.WorkPackageID,
		IssuedTo:       r.IssuedTo,
		ContractorID:   r.ContractorID,
		ContractorName: r.ContractorName,
		MaterialName:   r.MaterialName,
		Specification:  r.Specification,
		Unit:           unit,
		Qty:            qty,
		IssueDate:      r.IssueDate,
		IssuedBy:       r.IssuedBy,
		VehicleNo:      r.VehicleNo,
		Notes:          r.Notes,
	}
}

type MaterialIssueHandler struct {
	service *service.MaterialIssueService
}

func NewMaterialIssueHandler(s *service.MaterialIssueService) *MaterialIssueHandler {
	return &MaterialIssueHandler{service: s}
}

// GetAll GET /api/material-issues
func (h *MaterialIssueHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	f := service.MaterialIssueFilters{}

	if v := r.URL.Query().Get("siteProjectId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			f.SiteProjectID = &id
		}
	}
	if v := r.URL.Query().Get("workOrderId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			f.WorkOrderID = &id
		}
	}
	if v := r.URL.Query().Get("contractorId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			f.ContractorID = &id
		}
	}
	f.IssuedTo = r.URL.Query().Get("issuedTo")

	issues, err := h.service.GetAll(f)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Material issues retrieved", issues)
}

// GetByID GET /api/material-issues/{id}
func (h *MaterialIssueHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	m, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Material issue retrieved", m)
}

// Create POST /api/material-issues
func (h *MaterialIssueHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req materialIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.MaterialName == "" {
		util.SendError(w, http.StatusBadRequest, "MaterialName is required")
		return
	}
	if req.IssuedTo != "SUBCONTRACTOR" && req.IssuedTo != "INHOUSE" {
		util.SendError(w, http.StatusBadRequest, "IssuedTo must be SUBCONTRACTOR or INHOUSE")
		return
	}
	if req.IssueDate == "" {
		util.SendError(w, http.StatusBadRequest, "IssueDate is required")
		return
	}
	if req.SiteProjectID == 0 {
		util.SendError(w, http.StatusBadRequest, "SiteProjectID is required")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	issue, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Material issue created", "id", issue.ID, "material", issue.MaterialName, "user", user.Email)
	util.SendSuccess(w, "Material issue created", issue)
}

// Update PUT /api/material-issues/{id}
func (h *MaterialIssueHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req materialIssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email

	issue, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Material issue updated", "id", issue.ID, "user", user.Email)
	util.SendSuccess(w, "Material issue updated", issue)
}

// Delete DELETE /api/material-issues/{id}
func (h *MaterialIssueHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	slog.Info("Material issue deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Material issue deleted", map[string]int{"id": id})
}
