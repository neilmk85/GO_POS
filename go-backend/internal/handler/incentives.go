package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type IncentiveHandler struct {
	service *service.IncentiveService
}

func NewIncentiveHandler(is *service.IncentiveService) *IncentiveHandler {
	return &IncentiveHandler{service: is}
}

// ─── Rules Endpoints ──────────────────────────────────────────────────────

func (ih *IncentiveHandler) GetRules(w http.ResponseWriter, r *http.Request) {
	outletId := (*int)(nil)
	if outletStr := r.URL.Query().Get("outletId"); outletStr != "" {
		if id, err := strconv.Atoi(outletStr); err == nil {
			outletId = &id
		}
	}

	result, err := ih.service.GetRules(outletId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentive rules retrieved", result)
}

func (ih *IncentiveHandler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var req service.IncentiveRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := ih.service.CreateRule(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentive rule created", result)
}

func (ih *IncentiveHandler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid rule ID")
		return
	}

	var req service.IncentiveRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := ih.service.UpdateRule(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentive rule updated", result)
}

func (ih *IncentiveHandler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid rule ID")
		return
	}

	if err := ih.service.DeleteRule(id); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentive rule deleted", nil)
}

// ─── Payouts Endpoints ────────────────────────────────────────────────────

func (ih *IncentiveHandler) GetPayouts(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	month := 0
	if monthStr := r.URL.Query().Get("month"); monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil {
			month = m
		}
	}

	year := 0
	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	result, err := ih.service.GetPayouts(outletId, month, year)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentive payouts retrieved", result)
}

func (ih *IncentiveHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	month := 0
	if monthStr := r.URL.Query().Get("month"); monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil {
			month = m
		}
	}

	year := 0
	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}

	result, err := ih.service.GetLeaderboard(outletId, month, year)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Leaderboard retrieved", result)
}

func (ih *IncentiveHandler) Recalculate(w http.ResponseWriter, r *http.Request) {
	var req service.RecalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	count, err := ih.service.Recalculate(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Incentives recalculated", map[string]int{"count": count})
}
