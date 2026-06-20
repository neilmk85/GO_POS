package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type SalesOrderHandler struct {
	service *service.SalesOrderService
}

func NewSalesOrderHandler(sos *service.SalesOrderService) *SalesOrderHandler {
	return &SalesOrderHandler{service: sos}
}

// GetAll retrieves paginated sales orders with optional filters
func (soh *SalesOrderHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	customerIDStr := r.URL.Query().Get("customerId")
	statusStr := r.URL.Query().Get("status")
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	var outletID, customerID *int
	var status *string
	var from, to *time.Time

	if outletIDStr != "" {
		id, err := strconv.Atoi(outletIDStr)
		if err == nil {
			outletID = &id
		}
	}

	if customerIDStr != "" {
		id, err := strconv.Atoi(customerIDStr)
		if err == nil {
			customerID = &id
		}
	}

	if statusStr != "" {
		status = &statusStr
	}

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

	page, size := util.ParsePagination(r)

	orders, total, err := soh.service.GetAll(outletID, customerID, status, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, orders, total, totalPages, size, page)
}

// Create creates a new sales order
func (soh *SalesOrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.SalesOrderCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	so, err := soh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales Order created", so)
}

// GetByID retrieves a sales order by ID (with PipeConfig + ProductionOrder on items)
func (soh *SalesOrderHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		util.SendError(w, http.StatusBadRequest, "ID is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	so, err := soh.service.GetByIDWithPipeConfig(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales Order retrieved", so)
}

// ConvertItemToPO converts a single SO line item to a Production Order
func (soh *SalesOrderHandler) ConvertItemToPO(w http.ResponseWriter, r *http.Request) {
	itemIDStr := r.PathValue("itemId")
	itemID, err := strconv.Atoi(itemIDStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	outletID := 1 // default outlet
	if v := r.URL.Query().Get("outletId"); v != "" {
		if id, e := strconv.Atoi(v); e == nil {
			outletID = id
		}
	}

	po, err := soh.service.ConvertItemToPO(itemID, outletID)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Production Order created", po)
}

// ConvertAllToPOs converts all unconverted pipe items in a SO to Production Orders
func (soh *SalesOrderHandler) ConvertAllToPOs(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	outletID := 1
	if v := r.URL.Query().Get("outletId"); v != "" {
		if oid, e := strconv.Atoi(v); e == nil {
			outletID = oid
		}
	}

	pos, err := soh.service.ConvertAllToPOs(id, outletID)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Production Orders created", pos)
}

// Update updates a sales order (DRAFT only)
func (soh *SalesOrderHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if idStr == "" {
		util.SendError(w, http.StatusBadRequest, "ID is required")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req service.SalesOrderUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	so, err := soh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales Order updated", so)
}

// Confirm transitions a DRAFT sales order to CONFIRMED status
func (soh *SalesOrderHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	so, err := soh.service.Confirm(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Sales Order confirmed", so)
}
