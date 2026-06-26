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

// ─── TDS Receivables ──────────────────────────────────────────────────────────

// GET /api/tds/receivables?outletId=&from=&to=
func (h *TDSHandler) ListReceivables(w http.ResponseWriter, r *http.Request) {
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
	to, err := time.Parse("2006-01-02", r.URL.Query().Get("to"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid to date")
		return
	}
	to = to.Add(time.Hour*23 + time.Minute*59 + time.Second*59)

	rows, err := h.service.ListReceivables(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS receivables retrieved", rows)
}

// POST /api/tds/receivables
func (h *TDSHandler) CreateReceivable(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutletID      int     `json:"outletId"`
		TDSSectionID  int     `json:"tdsSectionId"`
		CustomerName  string  `json:"customerName"`
		InvoiceNumber string  `json:"invoiceNumber"`
		PaymentDate   string  `json:"paymentDate"`
		BaseAmount    float64 `json:"baseAmount"`
		TDSRate       float64 `json:"tdsRate"`
		TDSAmount     float64 `json:"tdsAmount"`
		Notes         string  `json:"notes"`
		CreatedBy     string  `json:"createdBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	paymentDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid paymentDate")
		return
	}
	rec, err := h.service.RecordReceivable(
		req.OutletID, req.TDSSectionID,
		req.CustomerName, req.InvoiceNumber,
		paymentDate,
		decimal.NewFromFloat(req.BaseAmount),
		decimal.NewFromFloat(req.TDSRate),
		decimal.NewFromFloat(req.TDSAmount),
		req.Notes, req.CreatedBy,
	)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS receivable recorded", rec)
}

// PUT /api/tds/receivables/{id}
func (h *TDSHandler) UpdateReceivable(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req struct {
		OutletID      int     `json:"outletId"`
		TDSSectionID  int     `json:"tdsSectionId"`
		CustomerName  string  `json:"customerName"`
		InvoiceNumber string  `json:"invoiceNumber"`
		PaymentDate   string  `json:"paymentDate"`
		BaseAmount    float64 `json:"baseAmount"`
		TDSRate       float64 `json:"tdsRate"`
		TDSAmount     float64 `json:"tdsAmount"`
		Status        string  `json:"status"`
		Notes         string  `json:"notes"`
		ReceivedDate  *string `json:"receivedDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	paymentDate, err := time.Parse("2006-01-02", req.PaymentDate)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid paymentDate")
		return
	}
	var receivedDate *time.Time
	if req.ReceivedDate != nil && *req.ReceivedDate != "" {
		t, err := time.Parse("2006-01-02", *req.ReceivedDate)
		if err != nil {
			util.SendError(w, http.StatusBadRequest, "Invalid receivedDate")
			return
		}
		receivedDate = &t
	}
	rec, err := h.service.UpdateReceivable(
		id, req.OutletID, req.TDSSectionID,
		req.CustomerName, req.InvoiceNumber,
		req.Status, req.Notes,
		paymentDate,
		decimal.NewFromFloat(req.BaseAmount),
		decimal.NewFromFloat(req.TDSRate),
		decimal.NewFromFloat(req.TDSAmount),
		receivedDate,
	)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS receivable updated", rec)
}

// DELETE /api/tds/receivables/{id}
func (h *TDSHandler) DeleteReceivable(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	outletId, _ := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err := h.service.DeleteReceivable(id, outletId); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS receivable deleted", nil)
}

// GET /api/reports/tds-inward?outletId=&from=&to=
func (h *TDSHandler) GetReceivableReport(w http.ResponseWriter, r *http.Request) {
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
	to, err := time.Parse("2006-01-02", r.URL.Query().Get("to"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid to date")
		return
	}
	to = to.Add(time.Hour*23 + time.Minute*59 + time.Second*59)
	result, err := h.service.GetReceivableReport(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "TDS inward report retrieved", result)
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
