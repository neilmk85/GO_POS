package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type MachineHandler struct {
	service *service.MachineService
}

func NewMachineHandler(s *service.MachineService) *MachineHandler {
	return &MachineHandler{service: s}
}

// GET /api/production/machines
func (h *MachineHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	var outletPtr *int
	if v := r.URL.Query().Get("outletId"); v != "" {
		if o, err := strconv.Atoi(v); err == nil {
			outletPtr = &o
		}
	}
	var typePtr *models.MachineType
	if v := r.URL.Query().Get("machineType"); v != "" {
		t := models.MachineType(v)
		typePtr = &t
	}
	var activePtr *bool
	if v := r.URL.Query().Get("active"); v != "" {
		a := v == "true"
		activePtr = &a
	}

	machines, total, err := h.service.GetAll(outletPtr, typePtr, activePtr, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, machines, total, totalPages, size, page)
}

// GET /api/production/machines/{id}
func (h *MachineHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	m, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Machine retrieved", m)
}

// POST /api/production/machines
func (h *MachineHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	var req service.CreateMachineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	m, err := h.service.Create(req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Machine created", m)
}

// PUT /api/production/machines/{id}
func (h *MachineHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var req service.UpdateMachineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	m, err := h.service.Update(id, req, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Machine updated", m)
}

// PATCH /api/production/machines/{id}/toggle-active
func (h *MachineHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	m, err := h.service.ToggleActive(id, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Machine updated", m)
}
