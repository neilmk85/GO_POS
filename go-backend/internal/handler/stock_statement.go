package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type StockStatementHandler struct {
	svc *service.StockStatementService
}

func NewStockStatementHandler(svc *service.StockStatementService) *StockStatementHandler {
	return &StockStatementHandler{svc: svc}
}

func (h *StockStatementHandler) GetStatement(w http.ResponseWriter, r *http.Request) {
	outletId, _ := strconv.Atoi(r.URL.Query().Get("outletId"))
	if outletId == 0 {
		util.SendError(w, http.StatusBadRequest, "outletId required")
		return
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid from date")
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid to date")
		return
	}
	// Include the full to-date day
	to = to.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	rows, err := h.svc.GetStatement(outletId, from, to)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "stock statement fetched", rows)
}
