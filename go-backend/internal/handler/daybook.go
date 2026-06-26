package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type DayBookHandler struct {
	svc *service.DayBookService
}

func NewDayBookHandler(svc *service.DayBookService) *DayBookHandler {
	return &DayBookHandler{svc: svc}
}

func (h *DayBookHandler) GetEntries(w http.ResponseWriter, r *http.Request) {
	outletId, _ := strconv.Atoi(r.URL.Query().Get("outletId"))
	if outletId == 0 {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	from := time.Now().Truncate(24 * time.Hour)
	to := from
	if fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = t
		}
	}
	if toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			to = t
		}
	}

	entries, err := h.svc.GetEntries(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Day book entries", entries)
}
