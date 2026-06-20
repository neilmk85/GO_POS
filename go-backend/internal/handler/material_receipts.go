package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type materialReceiptRequest struct {
	SiteProjectID int     `json:"siteProjectId"`
	MaterialName  string  `json:"materialName"`
	Specification *string `json:"specification"`
	Unit          string  `json:"unit"`
	Qty           string  `json:"qty"`
	SupplierName  *string `json:"supplierName"`
	InvoiceNo     *string `json:"invoiceNo"`
	ReceivedDate  string  `json:"receivedDate"`
	ReceivedBy    *string `json:"receivedBy"`
	VehicleNo     *string `json:"vehicleNo"`
	Notes         *string `json:"notes"`
}

func (r materialReceiptRequest) toModel() models.MaterialReceipt {
	qty, _ := decimal.NewFromString(r.Qty)
	unit := r.Unit
	if unit == "" {
		unit = "Nos"
	}
	return models.MaterialReceipt{
		SiteProjectID: r.SiteProjectID,
		MaterialName:  r.MaterialName,
		Specification: r.Specification,
		Unit:          unit,
		Qty:           qty,
		SupplierName:  r.SupplierName,
		InvoiceNo:     r.InvoiceNo,
		ReceivedDate:  r.ReceivedDate,
		ReceivedBy:    r.ReceivedBy,
		VehicleNo:     r.VehicleNo,
		Notes:         r.Notes,
	}
}

type MaterialReceiptHandler struct {
	service *service.MaterialReceiptService
}

func NewMaterialReceiptHandler(s *service.MaterialReceiptService) *MaterialReceiptHandler {
	return &MaterialReceiptHandler{service: s}
}

// GetByProject GET /api/site-projects/{projectId}/material-receipts
func (h *MaterialReceiptHandler) GetByProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	records, err := h.service.GetByProject(projectID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Material receipts retrieved", records)
}

// GetStockRegister GET /api/site-projects/{projectId}/stock-register
func (h *MaterialReceiptHandler) GetStockRegister(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	entries, err := h.service.GetStockRegister(projectID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Stock register retrieved", entries)
}

// GetByID GET /api/material-receipts/{id}
func (h *MaterialReceiptHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	rec, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Material receipt retrieved", rec)
}

// Create POST /api/material-receipts
func (h *MaterialReceiptHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req materialReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.MaterialName == "" {
		util.SendError(w, http.StatusBadRequest, "MaterialName is required")
		return
	}
	if req.ReceivedDate == "" {
		util.SendError(w, http.StatusBadRequest, "ReceivedDate is required")
		return
	}
	if req.SiteProjectID == 0 {
		util.SendError(w, http.StatusBadRequest, "SiteProjectID is required")
		return
	}

	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.CreatedBy = &user.Email

	rec, err := h.service.Create(m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Material receipt created", "id", rec.ID, "material", rec.MaterialName, "user", user.Email)
	util.SendSuccess(w, "Material receipt created", rec)
}

// Update PUT /api/material-receipts/{id}
func (h *MaterialReceiptHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	var req materialReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	m := req.toModel()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	m.UpdatedBy = &user.Email

	rec, err := h.service.Update(id, m)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Material receipt updated", "id", rec.ID, "user", user.Email)
	util.SendSuccess(w, "Material receipt updated", rec)
}

// Delete DELETE /api/material-receipts/{id}
func (h *MaterialReceiptHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	if err := h.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Material receipt deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Deleted", map[string]int{"id": id})
}
