package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type TDSHandler struct {
	service *service.TDSService
}

func NewTDSHandler(s *service.TDSService) *TDSHandler {
	return &TDSHandler{service: s}
}

// GET /api/tds/sections
func (h *TDSHandler) GetSections(w http.ResponseWriter, r *http.Request) {
	sections, err := h.service.GetAllSections()
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS sections retrieved", sections)
}

// POST /api/tds/sections
func (h *TDSHandler) CreateSection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SectionCode string  `json:"sectionCode"`
		Description string  `json:"description"`
		Rate        float64 `json:"rate"`
		Threshold   float64 `json:"threshold"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	sec, err := h.service.CreateSection(
		req.SectionCode, req.Description,
		decimal.NewFromFloat(req.Rate),
		decimal.NewFromFloat(req.Threshold),
	)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS section created", sec)
}

// PUT /api/tds/sections/{id}
func (h *TDSHandler) UpdateSection(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req struct {
		SectionCode string  `json:"sectionCode"`
		Description string  `json:"description"`
		Rate        float64 `json:"rate"`
		Threshold   float64 `json:"threshold"`
		IsActive    bool    `json:"isActive"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	sec, err := h.service.UpdateSection(
		id, req.SectionCode, req.Description,
		decimal.NewFromFloat(req.Rate),
		decimal.NewFromFloat(req.Threshold),
		req.IsActive,
	)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS section updated", sec)
}

// DELETE /api/tds/sections/{id}
func (h *TDSHandler) DeleteSection(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	if err := h.service.DeleteSection(id); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS section deleted", nil)
}

// GET /api/reports/tds?outletId=&from=&to=
func (h *TDSHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outletId")
		return
	}
	from, err := time.Parse("2006-01-02", r.URL.Query().Get("from"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid from date")
		return
	}
	toStr := r.URL.Query().Get("to")
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid to date")
		return
	}
	to = to.Add(time.Hour*23 + time.Minute*59 + time.Second*59)

	result, err := h.service.GetReport(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS report retrieved", result)
}
