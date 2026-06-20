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
)

type InventoryHandler struct {
	service *service.InventoryService
}

func NewInventoryHandler(is *service.InventoryService) *InventoryHandler {
	return &InventoryHandler{service: is}
}

func (ih *InventoryHandler) GetByProductAndOutlet(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("productId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	outletId, err := strconv.Atoi(r.PathValue("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	inventory, err := ih.service.GetByProductAndOutlet(productId, outletId)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Inventory retrieved", inventory)
}

func (ih *InventoryHandler) GetByProductAllOutlets(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.PathValue("productId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	inventories, err := ih.service.GetByProductAllOutlets(productId)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Inventories retrieved", inventories)
}

func (ih *InventoryHandler) GetByOutlet(w http.ResponseWriter, r *http.Request) {
	// outletId can come from path (/outlet/{outletId}) or query (?outletId=)
	rawOutlet := r.PathValue("outletId")
	if rawOutlet == "" {
		rawOutlet = r.URL.Query().Get("outletId")
	}
	outletId, err := strconv.Atoi(rawOutlet)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)
	itemType := r.URL.Query().Get("itemType")

	inventories, total, err := ih.service.GetByOutlet(outletId, itemType, page, size)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, inventories, total, totalPages, size, page)
}

func (ih *InventoryHandler) GetLowStock(w http.ResponseWriter, r *http.Request) {
	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	inventories, err := ih.service.GetLowStock(outletIdPtr)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Low stock items retrieved", inventories)
}

func (ih *InventoryHandler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var dto service.AdjustStockDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email
	if dto.UserID == nil {
		dto.UserID = &user.ID
	}

	adjustment, err := ih.service.AdjustStock(dto)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Stock adjusted", adjustment)
}

func (ih *InventoryHandler) UpdateReorderLevel(w http.ResponseWriter, r *http.Request) {
	var dto service.UpdateReorderLevelDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	inv, err := ih.service.UpdateReorderLevel(dto)
	if err != nil {
		handleInventoryError(w, err)
		return
	}
	util.SendSuccess(w, "Reorder level updated", inv)
}

func (ih *InventoryHandler) GetAdjustments(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	productId := r.URL.Query().Get("productId")
	var productIdPtr *int
	if productId != "" {
		if id, err := strconv.Atoi(productId); err == nil {
			productIdPtr = &id
		}
	}

	var from, to *time.Time
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			from = &t
		}
	}
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			to = &t
		}
	}

	dto := service.GetAdjustmentsDTO{
		OutletID:  outletIdPtr,
		ProductID: productIdPtr,
		From:      from,
		To:        to,
		Page:      page,
		Size:      size,
	}

	adjustments, total, err := ih.service.GetAdjustments(dto)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, adjustments, total, totalPages, size, page)
}

func (ih *InventoryHandler) CreateTransfer(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var dto service.CreateTransferDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email
	if dto.RequestedByID == nil {
		dto.RequestedByID = &user.ID
	}

	transfer, err := ih.service.CreateTransfer(dto)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Transfer created", transfer)
}

func (ih *InventoryHandler) ApproveTransfer(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	transferId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid transfer ID")
		return
	}

	approvedById := user.ID
	if approveStr := r.URL.Query().Get("approvedById"); approveStr != "" {
		if id, err := strconv.Atoi(approveStr); err == nil {
			approvedById = id
		}
	}

	transfer, err := ih.service.ApproveTransfer(transferId, approvedById)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Transfer approved", transfer)
}

func (ih *InventoryHandler) ShipTransfer(w http.ResponseWriter, r *http.Request) {
	transferId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid transfer ID")
		return
	}

	transfer, err := ih.service.ShipTransfer(transferId)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Transfer shipped", transfer)
}

func (ih *InventoryHandler) ReceiveTransfer(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	transferId, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid transfer ID")
		return
	}

	var body struct {
		ReceivedItems []service.ReceiveTransferItem `json:"receivedItems"`
		ReceivedById  *int                          `json:"receivedById"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	receivedById := user.ID
	if body.ReceivedById != nil {
		receivedById = *body.ReceivedById
	}

	transfer, err := ih.service.ReceiveTransfer(transferId, body.ReceivedItems, receivedById)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	util.SendSuccess(w, "Transfer received", transfer)
}

func (ih *InventoryHandler) GetTransfers(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	dto := service.GetTransfersDTO{
		OutletID: outletIdPtr,
		Status:   statusPtr,
		Page:     page,
		Size:     size,
	}

	transfers, total, err := ih.service.GetTransfers(dto)
	if err != nil {
		handleInventoryError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, transfers, total, totalPages, size, page)
}

func handleInventoryError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		util.SendError(w, be.Status, be.Message)
		return
	}

	if rn, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, rn.Message)
		return
	}

	slog.Error("Inventory handler error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}
