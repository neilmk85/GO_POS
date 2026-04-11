package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ShiftHandler struct {
	service *service.ShiftService
}

func NewShiftHandler(ss *service.ShiftService) *ShiftHandler {
	return &ShiftHandler{service: ss}
}

func (sh *ShiftHandler) Open(w http.ResponseWriter, r *http.Request) {
	var req service.ShiftOpenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	shift, err := sh.service.Open(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Shift opened", shift)
}

func (sh *ShiftHandler) Close(w http.ResponseWriter, r *http.Request) {
	shiftId, err := strconv.Atoi(r.PathValue("shiftId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid shift ID")
		return
	}

	var req service.ShiftCloseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	shift, err := sh.service.Close(shiftId, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Shift closed", shift)
}

func (sh *ShiftHandler) GetCurrent(w http.ResponseWriter, r *http.Request) {
	cashierId, err := strconv.Atoi(r.PathValue("cashierId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid cashier ID")
		return
	}

	shift, err := sh.service.GetCurrent(cashierId)
	if err != nil {
		handleError(w, err)
		return
	}

	if shift == nil {
		util.SendSuccess(w, "No open shift", nil)
		return
	}

	util.SendSuccess(w, "Current shift retrieved", shift)
}

func (sh *ShiftHandler) GetByOutlet(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.PathValue("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	var from, to *time.Time
	if fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err == nil {
			from = &t
		}
	}
	if toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr+"T23:59:59Z")
		if err == nil {
			to = &t
		}
	}

	shifts, total, err := sh.service.GetByOutlet(outletId, page, size, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, shifts, total, totalPages, size, page)
}
