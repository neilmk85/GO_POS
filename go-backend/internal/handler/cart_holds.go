package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type CartHoldHandler struct {
	service *service.CartHoldService
}

func NewCartHoldHandler(s *service.CartHoldService) *CartHoldHandler {
	return &CartHoldHandler{service: s}
}

// GET /api/cart-holds
func (h *CartHoldHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	outletID := 0
	if user.OutletID != nil {
		outletID = *user.OutletID
	}
	holds, err := h.service.GetAll(user.ID, outletID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cart holds retrieved", holds)
}

// POST /api/cart-holds
func (h *CartHoldHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	var req struct {
		CartData string `json:"cartData"`
		Note     string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	outletID := 0
	if user.OutletID != nil {
		outletID = *user.OutletID
	}
	hold, err := h.service.Create(user.ID, outletID, req.CartData, req.Note)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cart held", hold)
}

// DELETE /api/cart-holds/{id}
func (h *CartHoldHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}
	if err := h.service.Delete(id, user.ID); err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Cart hold deleted", nil)
}
