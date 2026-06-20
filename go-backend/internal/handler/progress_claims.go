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

type progressClaimItemRequest struct {
	ID                    int     `json:"id"`
	Description           string  `json:"description"`
	Unit                  string  `json:"unit"`
	ContractedQty         string  `json:"contractedQty"`
	PreviousCumulativeQty string  `json:"previousCumulativeQty"`
	ClaimedQty            string  `json:"claimedQty"`
	VerifiedQty           string  `json:"verifiedQty"`
	Remark                *string `json:"remark"`
	SortOrder             int     `json:"sortOrder"`
}

func (r progressClaimItemRequest) toModel() models.ProgressClaimItem {
	contracted, _ := decimal.NewFromString(r.ContractedQty)
	prevCumul, _ := decimal.NewFromString(r.PreviousCumulativeQty)
	claimed, _ := decimal.NewFromString(r.ClaimedQty)
	verified, _ := decimal.NewFromString(r.VerifiedQty)
	unit := r.Unit
	if unit == "" {
		unit = "LS"
	}
	return models.ProgressClaimItem{
		ID:                    r.ID,
		Description:           r.Description,
		Unit:                  unit,
		ContractedQty:         contracted,
		PreviousCumulativeQty: prevCumul,
		ClaimedQty:            claimed,
		VerifiedQty:           verified,
		Remark:                r.Remark,
		SortOrder:             r.SortOrder,
	}
}

type progressClaimRequest struct {
	WorkOrderID int                        `json:"workOrderId"`
	WONumber    string                     `json:"woNumber"`
	ClaimDate   string                     `json:"claimDate"`
	Notes       *string                    `json:"notes"`
	Items       []progressClaimItemRequest `json:"items"`
}

type verifyClaimRequest struct {
	Status     string                     `json:"status"`
	VerifiedBy string                     `json:"verifiedBy"`
	Items      []progressClaimItemRequest `json:"items"`
}

type ProgressClaimHandler struct {
	service *service.ProgressClaimService
}

func NewProgressClaimHandler(s *service.ProgressClaimService) *ProgressClaimHandler {
	return &ProgressClaimHandler{service: s}
}

// GetAll GET /api/progress-claims
func (h *ProgressClaimHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	var woID *int
	if v := r.URL.Query().Get("workOrderId"); v != "" {
		if id, err := strconv.Atoi(v); err == nil {
			woID = &id
		}
	}
	status := r.URL.Query().Get("status")

	claims, err := h.service.GetAll(woID, status)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Progress claims retrieved", claims)
}

// GetByWorkOrder GET /api/work-orders/{workOrderId}/progress-claims
func (h *ProgressClaimHandler) GetByWorkOrder(w http.ResponseWriter, r *http.Request) {
	woID, err := strconv.Atoi(r.PathValue("workOrderId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid work order ID")
		return
	}
	claims, err := h.service.GetByWorkOrder(woID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Progress claims retrieved", claims)
}

// GetByID GET /api/progress-claims/{id}
func (h *ProgressClaimHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	c, err := h.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Progress claim retrieved", c)
}

// Create POST /api/progress-claims
func (h *ProgressClaimHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req progressClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.WorkOrderID == 0 {
		util.SendError(w, http.StatusBadRequest, "WorkOrderID is required")
		return
	}
	if req.ClaimDate == "" {
		util.SendError(w, http.StatusBadRequest, "ClaimDate is required")
		return
	}
	if len(req.Items) == 0 {
		util.SendError(w, http.StatusBadRequest, "At least one item is required")
		return
	}

	items := make([]models.ProgressClaimItem, len(req.Items))
	for i, item := range req.Items {
		items[i] = item.toModel()
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	claim := models.ProgressClaim{
		WorkOrderID: req.WorkOrderID,
		WONumber:    req.WONumber,
		ClaimDate:   req.ClaimDate,
		Status:      models.ProgressClaimStatusPending,
		Notes:       req.Notes,
		Items:       items,
		CreatedBy:   &user.Email,
	}

	result, err := h.service.Create(claim)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Progress claim created", "id", result.ID, "workOrder", req.WorkOrderID, "user", user.Email)
	util.SendSuccess(w, "Progress claim created", result)
}

// Update PUT /api/progress-claims/{id}
func (h *ProgressClaimHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req progressClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	items := make([]models.ProgressClaimItem, len(req.Items))
	for i, item := range req.Items {
		items[i] = item.toModel()
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	data := models.ProgressClaim{
		ClaimDate: req.ClaimDate,
		Notes:     req.Notes,
		Items:     items,
		UpdatedBy: &user.Email,
	}

	result, err := h.service.Update(id, data)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Progress claim updated", "id", id, "user", user.Email)
	util.SendSuccess(w, "Progress claim updated", result)
}

// Verify PATCH /api/progress-claims/{id}/verify
func (h *ProgressClaimHandler) Verify(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req verifyClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Status != models.ProgressClaimStatusVerified && req.Status != models.ProgressClaimStatusDisputed {
		util.SendError(w, http.StatusBadRequest, "Status must be VERIFIED or DISPUTED")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	verifiedBy := req.VerifiedBy
	if verifiedBy == "" {
		verifiedBy = user.Email
	}

	items := make([]models.ProgressClaimItem, len(req.Items))
	for i, item := range req.Items {
		items[i] = item.toModel()
	}

	result, err := h.service.Verify(id, verifiedBy, items, req.Status)
	if err != nil {
		handleError(w, err)
		return
	}
	slog.Info("Progress claim verified", "id", id, "status", req.Status, "user", user.Email)
	util.SendSuccess(w, "Progress claim verified", result)
}

// Delete DELETE /api/progress-claims/{id}
func (h *ProgressClaimHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	slog.Info("Progress claim deleted", "id", id, "user", user.Email)
	util.SendSuccess(w, "Progress claim deleted", map[string]int{"id": id})
}
