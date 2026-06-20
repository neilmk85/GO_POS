package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type VendorPaymentHandler struct {
	service     *service.VendorPaymentService
	billService *service.PurchaseBillService
	tdsService  *service.TDSService
}

func NewVendorPaymentHandler(s *service.VendorPaymentService, bs *service.PurchaseBillService, ts *service.TDSService) *VendorPaymentHandler {
	return &VendorPaymentHandler{service: s, billService: bs, tdsService: ts}
}

// GET /api/vendor-payments
func (h *VendorPaymentHandler) GetAll(w http.ResponseWriter, r *http.Request) {
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

// POST /api/vendor-payments
func (h *VendorPaymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	var req struct {
		BillID          int      `json:"billId"`
		Amount          float64  `json:"amount"`
		PaymentMethod   string   `json:"paymentMethod"`
		ReferenceNumber string   `json:"referenceNumber"`
		PaymentDate     string   `json:"paymentDate"`
		Notes           *string  `json:"notes"`
		TDSSectionID    *int     `json:"tdsSectionId"`
		TDSAmount       *float64 `json:"tdsAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Record payment on the bill (gross amount before TDS)
	method := req.PaymentMethod
	ref := req.ReferenceNumber
	bill, err := h.billService.RecordPayment(req.BillID, decimal.NewFromFloat(req.Amount), &method, &ref)
	if err != nil {
		handleError(w, err)
		return
	}

	// Parse date
	pd := time.Now()
	if req.PaymentDate != "" {
		if t, err := time.Parse("2006-01-02", req.PaymentDate); err == nil {
			pd = t
		}
	}

	pm := models.VendorPaymentBankTransfer
	if req.PaymentMethod != "" {
		pm = models.VendorPaymentMethod(req.PaymentMethod)
	}

	tdsAmt := decimal.Zero
	if req.TDSAmount != nil {
		tdsAmt = decimal.NewFromFloat(*req.TDSAmount)
	}

	vp, err := h.service.CreateWithTDS(
		req.BillID, bill.SupplierID, bill.OutletID,
		decimal.NewFromFloat(req.Amount), pm, ref, pd, req.Notes, user.Email,
		req.TDSSectionID, tdsAmt,
	)
	if err != nil {
		handleError(w, err)
		return
	}

	// Record TDS deduction entry if TDS was deducted
	if req.TDSSectionID != nil && tdsAmt.GreaterThan(decimal.Zero) {
		// Fetch section rate
		sections, _ := h.tdsService.GetAllSections()
		var tdsRate decimal.Decimal
		for _, sec := range sections {
			if sec.ID == *req.TDSSectionID {
				tdsRate = sec.Rate
				break
			}
		}
		baseAmt := decimal.NewFromFloat(req.Amount)
		h.tdsService.RecordDeduction(
			vp.ID, bill.SupplierID, bill.OutletID, req.BillID, *req.TDSSectionID,
			pd, baseAmt, tdsRate, tdsAmt, user.Email,
		)
	}

	util.SendSuccess(w, "Payment recorded", vp)
}
