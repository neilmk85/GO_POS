package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type OverheadConfigHandler struct {
	service *service.OverheadConfigService
}

func NewOverheadConfigHandler(s *service.OverheadConfigService) *OverheadConfigHandler {
	return &OverheadConfigHandler{service: s}
}

// GET /api/production/overhead-configs
func (h *OverheadConfigHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	var outletPtr *int
	if v := r.URL.Query().Get("outletId"); v != "" {
		if o, err := strconv.Atoi(v); err == nil {
			outletPtr = &o
		}
	}
	var activePtr *bool
	if v := r.URL.Query().Get("active"); v != "" {
		a := v == "true"
		activePtr = &a
	}

	configs, total, err := h.service.GetAll(outletPtr, activePtr, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, configs, total, totalPages, size, page)
}

// GET /api/production/overhead-configs/{id}
func (h *OverheadConfigHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	cfg, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Overhead config retrieved", cfg)
}

// POST /api/production/overhead-configs
func (h *OverheadConfigHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	var req service.CreateOverheadConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	cfg, err := h.service.Create(req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Overhead config created", cfg)
}

// PUT /api/production/overhead-configs/{id}
func (h *OverheadConfigHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req service.UpdateOverheadConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	cfg, err := h.service.Update(id, req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Overhead config updated", cfg)
}

// PATCH /api/production/overhead-configs/{id}/toggle-active
func (h *OverheadConfigHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	cfg, err := h.service.ToggleActive(id, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Overhead config updated", cfg)
}
