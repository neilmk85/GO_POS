package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type PurchaseBillHandler struct {
	service *service.PurchaseBillService
}

func NewPurchaseBillHandler(pbs *service.PurchaseBillService) *PurchaseBillHandler {
	return &PurchaseBillHandler{service: pbs}
}

// GetAll GET /api/purchase-bills
func (pbh *PurchaseBillHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	supplierId := r.URL.Query().Get("supplierId")
	var supplierIdPtr *int
	if supplierId != "" {
		if id, err := strconv.Atoi(supplierId); err == nil {
			supplierIdPtr = &id
		}
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	var fromPtr, toPtr *time.Time
	if from := r.URL.Query().Get("from"); from != "" {
		if parsedDate, err := time.Parse("2006-01-02", from); err == nil {
			fromPtr = &parsedDate
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if parsedDate, err := time.Parse("2006-01-02", to); err == nil {
			toPtr = &parsedDate
		}
	}

	bills, total, err := pbh.service.GetAll(page, size, outletIdPtr, supplierIdPtr, statusPtr, fromPtr, toPtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, bills, total, totalPages, size, page)
}

// GetByID GET /api/purchase-bills/{id}
func (pbh *PurchaseBillHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bill ID")
		return
	}

	bill, err := pbh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase bill retrieved", bill)
}

// GetSummary GET /api/purchase-bills/summary
func (pbh *PurchaseBillHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	outletId := r.URL.Query().Get("outletId")
	if outletId == "" {
		util.SendError(w, http.StatusBadRequest, "outletId query parameter is required")
		return
	}

	outletIdInt, err := strconv.Atoi(outletId)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outletId")
		return
	}

	var fromPtr, toPtr *time.Time
	if from := r.URL.Query().Get("from"); from != "" {
		if parsedDate, err := time.Parse("2006-01-02", from); err == nil {
			fromPtr = &parsedDate
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if parsedDate, err := time.Parse("2006-01-02", to); err == nil {
			toPtr = &parsedDate
		}
	}

	summary, err := pbh.service.GetSummary(outletIdInt, fromPtr, toPtr)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Summary retrieved", summary)
}

// Create POST /api/purchase-bills
func (pbh *PurchaseBillHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	bill, err := pbh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Purchase bill created", "id", bill.ID, "billNumber", bill.BillNumber, "user", user.Email)
	util.SendSuccess(w, "Bill created", map[string]interface{}{
		"id":         bill.ID,
		"billNumber": bill.BillNumber,
	})
}

// CreateFromPO POST /api/purchase-bills/from-po?poId={poId}
func (pbh *PurchaseBillHandler) CreateFromPO(w http.ResponseWriter, r *http.Request) {
	poId, err := strconv.Atoi(r.URL.Query().Get("poId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid PO ID")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)

	bill, err := pbh.service.CreateFromPO(poId)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Purchase bill created from PO", "id", bill.ID, "billNumber", bill.BillNumber, "poId", poId, "user", user.Email)
	util.SendSuccess(w, "Bill created from PO", map[string]interface{}{
		"id":         bill.ID,
		"billNumber": bill.BillNumber,
	})
}

// RecordPayment POST /api/purchase-bills/{id}/payment
func (pbh *PurchaseBillHandler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bill ID")
		return
	}

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	amount, ok := req["amount"].(float64)
	if !ok {
		util.SendError(w, http.StatusBadRequest, "Amount is required")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)

	bill, err := pbh.service.RecordPayment(id, decimal.NewFromFloat(amount), nil, nil)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Payment recorded", "billId", id, "amount", amount, "status", bill.Status, "user", user.Email)
	util.SendSuccess(w, "Payment recorded", map[string]interface{}{
		"id":         bill.ID,
		"paidAmount": bill.PaidAmount,
		"status":     bill.Status,
	})
}

// Delete DELETE /api/purchase-bills/{id}
func (pbh *PurchaseBillHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bill ID")
		return
	}

	err = pbh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Purchase bill deleted", "id", id, "user", user.Email)

	util.SendSuccess(w, "Bill deleted", map[string]int{"id": id})
}
