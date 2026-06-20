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
)

type siteProjectRequest struct {
	Name          string   `json:"name"`
	ClientName    string   `json:"clientName"`
	Location      string   `json:"location"`
	ContractNo    *string  `json:"contractNo"`
	ContractValue *float64 `json:"contractValue"`
	StartDate     *string  `json:"startDate"`
	EndDate       *string  `json:"endDate"`
	Status        string   `json:"status"`
	Notes         *string  `json:"notes"`
}

func (r siteProjectRequest) toModel() models.SiteProject {
	status := r.Status
	if status == "" {
		status = "ACTIVE"
	}
	return models.SiteProject{
		Name:          r.Name,
		ClientName:    r.ClientName,
		Location:      r.Location,
		ContractNo:    r.ContractNo,
		ContractValue: r.ContractValue,
		StartDate:     r.StartDate,
		EndDate:       r.EndDate,
		Status:        status,
		Notes:         r.Notes,
	}
}

type SiteProjectHandler struct {
	service *service.SiteProjectService
}

func NewSiteProjectHandler(s *service.SiteProjectService) *SiteProjectHandler {
	return &SiteProjectHandler{service: s}
}

// GetAll GET /api/site-projects
func (h *SiteProjectHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	projects, err := h.service.GetAll(searchPtr, statusPtr)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Site projects retrieved", projects)
}

// GetByID GET /api/site-projects/{id}
func (h *SiteProjectHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid site project ID")
		return
	}
	p, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Site project retrieved", p)
}

// Create POST /api/site-projects
func (h *SiteProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req siteProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		util.SendError(w, http.StatusBadRequest, "Project name is required")
		return
	}

	m := req.toModel()
	m.Active = true
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	p, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Site project created", "id", p.ID, "name", p.Name, "user", user.Email)
	util.SendSuccess(w, "Site project created", p)
}

// Update PUT /api/site-projects/{id}
func (h *SiteProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid site project ID")
		return
	}

	var req siteProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email

	p, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Site project updated", "id", p.ID, "name", p.Name, "user", user.Email)
	util.SendSuccess(w, "Site project updated", p)
}

// UpdateStatus PATCH /api/site-projects/{id}/status
func (h *SiteProjectHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid site project ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		util.SendError(w, http.StatusBadRequest, "Status is required")
		return
	}

	p, err := h.service.UpdateStatus(id, body.Status)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Status updated", p)
}

// Delete DELETE /api/site-projects/{id}
func (h *SiteProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid site project ID")
		return
	}

	p, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Site project deleted", "id", id, "name", p.Name, "user", user.Email)
	util.SendSuccess(w, "Site project deleted", map[string]int{"id": id})
}
