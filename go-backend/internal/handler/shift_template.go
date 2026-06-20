package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ShiftTemplateHandler struct {
	service *service.ShiftTemplateService
}

func NewShiftTemplateHandler(s *service.ShiftTemplateService) *ShiftTemplateHandler {
	return &ShiftTemplateHandler{service: s}
}

// GET /api/production/shift-templates
func (h *ShiftTemplateHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	// If outletId is provided, return shifts for that outlet without pagination
	if v := r.URL.Query().Get("outletId"); v != "" {
		outletID, err := strconv.Atoi(v)
		if err != nil {
			util.SendError(w, http.StatusBadRequest, "Invalid outletId")
			return
		}
		shifts, err := h.service.GetByOutlet(outletID)
		if err != nil {
			handleError(w, err)
			return
		}
		util.SendSuccess(w, "Shift templates retrieved", shifts)
		return
	}

	shifts, total, err := h.service.GetAll(page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, shifts, total, totalPages, size, page)
}

// GET /api/production/shift-templates/{id}
func (h *ShiftTemplateHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	sh, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Shift template retrieved", sh)
}

// POST /api/production/shift-templates  (upsert by outletId+shiftName)
func (h *ShiftTemplateHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	var req service.UpsertShiftTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	sh, err := h.service.Upsert(req)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Shift template saved", sh)
}

// DELETE /api/production/shift-templates/{id}
func (h *ShiftTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Shift template deleted", nil)
}
