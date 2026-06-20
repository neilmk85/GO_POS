package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type OrderHandler struct {
	service *service.OrderService
}

func NewOrderHandler(os *service.OrderService) *OrderHandler {
	return &OrderHandler{service: os}
}

func (oh *OrderHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	var req service.CheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	response, err := oh.service.Checkout(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Order created", response)
}

func (oh *OrderHandler) ProcessReturn(w http.ResponseWriter, r *http.Request) {
	var req service.ReturnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := oh.service.ProcessReturn(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Return processed", result)
}

func (oh *OrderHandler) GetByOutlet(w http.ResponseWriter, r *http.Request) {
	outletIdStr := r.URL.Query().Get("outletId")
	if outletIdStr == "" {
		util.SendError(w, http.StatusBadRequest, "outletId query param is required")
		return
	}
	outletId, err := strconv.Atoi(outletIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)

	statusStr := r.URL.Query().Get("status")
	var status *string
	if statusStr != "" {
		status = &statusStr
	}

	orderTypeStr := r.URL.Query().Get("orderType")
	var orderType *string
	if orderTypeStr != "" {
		orderType = &orderTypeStr
	}

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

	orders, total, err := oh.service.GetByOutlet(outletId, page, size, status, orderType, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, orders, total, totalPages, size, page)
}

func (oh *OrderHandler) GetByCustomer(w http.ResponseWriter, r *http.Request) {
	customerId, err := strconv.Atoi(r.PathValue("customerId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	page, size := util.ParsePagination(r)

	orders, total, err := oh.service.GetByCustomer(customerId, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, orders, total, totalPages, size, page)
}

func (oh *OrderHandler) GetByOrderNumber(w http.ResponseWriter, r *http.Request) {
	orderNumber := r.PathValue("orderNumber")
	if orderNumber == "" {
		util.SendError(w, http.StatusBadRequest, "Order number is required")
		return
	}

	order, err := oh.service.GetByOrderNumber(orderNumber)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Order retrieved", order)
}

func (oh *OrderHandler) HoldOrder(w http.ResponseWriter, r *http.Request) {
	orderId, err := strconv.Atoi(r.PathValue("orderId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid order ID")
		return
	}

	order, err := oh.service.HoldOrder(orderId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Order held", order)
}

func (oh *OrderHandler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	orderId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid order ID")
		return
	}

	order, err := oh.service.CancelOrder(orderId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Order cancelled", order)
}
