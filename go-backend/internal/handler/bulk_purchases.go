package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type BulkPurchaseHandler struct {
	service *service.BulkPurchaseService
}

func NewBulkPurchaseHandler(bps *service.BulkPurchaseService) *BulkPurchaseHandler {
	return &BulkPurchaseHandler{service: bps}
}

// Create POST /api/bulk-purchases
func (bph *BulkPurchaseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	bp, err := bph.service.RecordPurchase(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Bulk purchase recorded", "id", bp.ID, "referenceNumber", bp.ReferenceNumber, "user", user.Email)
	util.SendSuccess(w, "Bulk purchase recorded", map[string]interface{}{
		"id":                bp.ID,
		"referenceNumber":   bp.ReferenceNumber,
	})
}

// GetAll GET /api/bulk-purchases
func (bph *BulkPurchaseHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

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

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")

	var purchases []models.BulkPurchase
	var total int64

	if from != "" && to != "" {
		if fromDate, err := time.Parse("2006-01-02", from); err == nil {
			if toDate, err := time.Parse("2006-01-02", to); err == nil {
				purchases, total, err = bph.service.GetHistoryByDate(page, size, outletIdInt, fromDate, toDate)
				if err != nil {
					handleError(w, err)
					return
				}
			}
		}
	} else {
		purchases, total, err = bph.service.GetHistory(page, size, outletIdInt)
		if err != nil {
			handleError(w, err)
			return
		}
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, purchases, total, totalPages, size, page)
}

// GetStats GET /api/bulk-purchases/stats
func (bph *BulkPurchaseHandler) GetStats(w http.ResponseWriter, r *http.Request) {
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

	stats, err := bph.service.GetStats(outletIdInt)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Stats retrieved", stats)
}

// GetByProduct GET /api/bulk-purchases/product?productId={productId}
func (bph *BulkPurchaseHandler) GetByProduct(w http.ResponseWriter, r *http.Request) {
	productId, err := strconv.Atoi(r.URL.Query().Get("productId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

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

	purchases, err := bph.service.GetHistoryByProduct(productId, outletIdInt)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Product history retrieved", purchases)
}

// UpdateConversionStatus PATCH /api/bulk-purchases/{id}/conversion-status
func (bph *BulkPurchaseHandler) UpdateConversionStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bulk purchase ID")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		util.SendError(w, http.StatusBadRequest, "Status query parameter is required")
		return
	}

	bp, err := bph.service.UpdateConversionStatus(id, status)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Status updated", map[string]interface{}{
		"id":                bp.ID,
		"conversionStatus":  bp.ConversionStatus,
	})
}

// Convert POST /api/bulk-purchases/{id}/convert
func (bph *BulkPurchaseHandler) Convert(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bulk purchase ID")
		return
	}

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	targetProductId := int(req["targetProductId"].(float64))
	fromBaseQty := decimal.NewFromFloat(req["fromBaseQty"].(float64))
	saleQty := decimal.NewFromFloat(req["saleQty"].(float64))

	var saleUom *string
	if su, ok := req["saleUom"].(string); ok {
		saleUom = &su
	}

	var notes *string
	if n, ok := req["notes"].(string); ok {
		notes = &n
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)

	conversion, err := bph.service.Convert(id, targetProductId, fromBaseQty, saleQty, saleUom, notes)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Bulk purchase conversion recorded", "bulkPurchaseId", id, "targetProductId", targetProductId, "user", user.Email)
	util.SendSuccess(w, "Conversion recorded", conversion)
}

// GetConversions GET /api/bulk-purchases/{id}/conversions
func (bph *BulkPurchaseHandler) GetConversions(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid bulk purchase ID")
		return
	}

	conversions, err := bph.service.GetConversions(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Conversions retrieved", conversions)
}
