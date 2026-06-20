package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type WorkOrderHandler struct {
	svc *service.WorkOrderService
}

func NewWorkOrderHandler(svc *service.WorkOrderService) *WorkOrderHandler {
	return &WorkOrderHandler{svc: svc}
}

type workOrderItemRequest struct {
	Description string  `json:"description"`
	Unit        string  `json:"unit"`
	Quantity    float64 `json:"quantity"`
	Rate        float64 `json:"rate"`
	Amount      float64 `json:"amount"`
	SortOrder   int     `json:"sortOrder"`
}

type workOrderRequest struct {
	ContractorID   int                    `json:"contractorId"`
	ContractorName string                 `json:"contractorName"`
	Title          string                 `json:"title"`
	Location       *string                `json:"location"`
	StartDate      *string                `json:"startDate"`
	EndDate        *string                `json:"endDate"`
	Status         models.WorkOrderStatus `json:"status"`
	Notes          *string                `json:"notes"`
	Items          []workOrderItemRequest  `json:"items"`
}

func (r workOrderRequest) toModel() models.WorkOrder {
	o := models.WorkOrder{
		ContractorID:   r.ContractorID,
		ContractorName: r.ContractorName,
		Title:          r.Title,
		Location:       r.Location,
		StartDate:      r.StartDate,
		EndDate:        r.EndDate,
		Notes:          r.Notes,
	}
	if r.Status != "" {
		o.Status = r.Status
	}
	for i, item := range r.Items {
		o.Items = append(o.Items, models.WorkOrderItem{
			Description: item.Description,
			Unit:        item.Unit,
			Quantity:    decimal.NewFromFloat(item.Quantity),
			Rate:        decimal.NewFromFloat(item.Rate),
			Amount:      decimal.NewFromFloat(item.Amount),
			SortOrder:   i,
		})
	}
	return o
}

// GET /api/work-orders
func (h *WorkOrderHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	orders, err := h.svc.GetAll(search, status)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work orders retrieved", orders)
}

// GET /api/work-orders/{id}
func (h *WorkOrderHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	o, err := h.svc.GetByID(id)
	if err != nil {
		util.SendError(w, http.StatusNotFound, "not found")
		return
	}
	util.SendSuccess(w, "Work order retrieved", o)
}

// POST /api/work-orders
func (h *WorkOrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req workOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	createdBy := ""
	if user != nil {
		createdBy = user.Email
	}
	o, err := h.svc.Create(req.toModel(), createdBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work order created", o)
}

// PUT /api/work-orders/{id}
func (h *WorkOrderHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req workOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	updatedBy := ""
	if user != nil {
		updatedBy = user.Email
	}
	o, err := h.svc.Update(id, req.toModel(), updatedBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work order updated", o)
}

// PATCH /api/work-orders/{id}/status
func (h *WorkOrderHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var body struct {
		Status models.WorkOrderStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, err.Error())
		return
	}
	user, _ := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	updatedBy := ""
	if user != nil {
		updatedBy = user.Email
	}
	o, err := h.svc.UpdateStatus(id, body.Status, updatedBy)
	if err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Status updated", o)
}

// DELETE /api/work-orders/{id}
func (h *WorkOrderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		util.SendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	util.SendSuccess(w, "Work order deleted", nil)
}
