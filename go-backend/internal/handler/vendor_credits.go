package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type VendorCreditHandler struct {
	service *service.VendorCreditService
}

func NewVendorCreditHandler(s *service.VendorCreditService) *VendorCreditHandler {
	return &VendorCreditHandler{service: s}
}

// GET /api/vendor-credits
func (h *VendorCreditHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)
	var outletID, supplierID *int
	if v := r.URL.Query().Get("outletId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			outletID = &id
		}
	}
	if v := r.URL.Query().Get("supplierId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			supplierID = &id
		}
	}
	rows, total, err := h.service.GetAll(outletID, supplierID, page, size)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, rows, total, totalPages, size, page)
}

// POST /api/vendor-credits
func (h *VendorCreditHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	var req struct {
		SupplierID int     `json:"supplierId"`
		OutletID   int     `json:"outletId"`
		Amount     float64 `json:"amount"`
		Reason     string  `json:"reason"`
		CreditDate string  `json:"creditDate"`
		Notes      *string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.SupplierID == 0 || req.Amount <= 0 || req.Reason == "" {
		util.SendError(w, http.StatusBadRequest, "supplierId, amount, and reason are required")
		return
	}
	date := time.Now()
	if req.CreditDate != "" {
		if t, err := time.Parse("2006-01-02", req.CreditDate); err == nil {
			date = t
		}
	}
	if req.OutletID == 0 && user.OutletID != nil {
		req.OutletID = *user.OutletID
	}
	vc, err := h.service.Create(req.SupplierID, req.OutletID, decimal.NewFromFloat(req.Amount),
		req.Reason, date, req.Notes, user.Email)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Vendor credit created", vc)
}

// POST /api/vendor-credits/{id}/apply
func (h *VendorCreditHandler) Apply(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req struct {
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	vc, err := h.service.Apply(id, decimal.NewFromFloat(req.Amount))
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Credit applied", vc)
}
