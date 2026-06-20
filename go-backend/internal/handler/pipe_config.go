package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type PipeConfigHandler struct {
	service *service.PipeConfigService
}

func NewPipeConfigHandler(s *service.PipeConfigService) *PipeConfigHandler {
	return &PipeConfigHandler{service: s}
}

// GET /api/production/pipe-configs
func (h *PipeConfigHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	var diamPtr *int
	if v := r.URL.Query().Get("diameterMm"); v != "" {
		d, err := strconv.Atoi(v)
		if err == nil {
			diamPtr = &d
		}
	}
	var pcPtr *string
	if v := r.URL.Query().Get("pressureClass"); v != "" {
		pcPtr = &v
	}
	var activePtr *bool
	if v := r.URL.Query().Get("active"); v != "" {
		a := v == "true"
		activePtr = &a
	}

	configs, total, err := h.service.GetAll(diamPtr, pcPtr, activePtr, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, configs, total, totalPages, size, page)
}

// GET /api/production/pipe-configs/lookup?diameterMm=600&pressureClass=10kg
func (h *PipeConfigHandler) Lookup(w http.ResponseWriter, r *http.Request) {
	diamStr := r.URL.Query().Get("diameterMm")
	pc := r.URL.Query().Get("pressureClass")
	if diamStr == "" || pc == "" {
		util.SendError(w, http.StatusBadRequest, "diameterMm and pressureClass are required")
		return
	}
	diam, err := strconv.Atoi(diamStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "diameterMm must be an integer")
		return
	}
	cfg, err := h.service.GetByDiameterAndPressure(diam, pc)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Pipe config found", cfg)
}

// GET /api/production/pipe-configs/{id}
func (h *PipeConfigHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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
	util.SendSuccess(w, "Pipe config retrieved", cfg)
}

// POST /api/production/pipe-configs
func (h *PipeConfigHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	var req service.CreatePipeConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	cfg, err := h.service.Create(req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Pipe config created", cfg)
}

// PUT /api/production/pipe-configs/{id}
func (h *PipeConfigHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req service.UpdatePipeConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	cfg, err := h.service.Update(id, req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Pipe config updated", cfg)
}

// PATCH /api/production/pipe-configs/{id}/toggle-active
func (h *PipeConfigHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
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
	util.SendSuccess(w, "Pipe config updated", cfg)
}

// PUT /api/production/pipe-configs/{id}/materials
func (h *PipeConfigHandler) UpsertMaterials(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req service.UpsertMaterialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.service.UpsertMaterials(id, req, user.Email); err != nil {
		handleError(w, err)
		return
	}
	cfg, _ := h.service.GetByID(id)
	util.SendSuccess(w, "Materials updated", cfg)
}
