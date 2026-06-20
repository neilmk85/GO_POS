package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type SaleReturnHandler struct {
	service *service.SaleReturnService
}

func NewSaleReturnHandler(s *service.SaleReturnService) *SaleReturnHandler {
	return &SaleReturnHandler{service: s}
}

func (h *SaleReturnHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)
	outletId, _ := strconv.Atoi(r.URL.Query().Get("outletId"))

	var fromPtr, toPtr *time.Time
	if from := r.URL.Query().Get("from"); from != "" {
		if t, err := time.Parse("2006-01-02", from); err == nil {
			fromPtr = &t
		}
	}
	if to := r.URL.Query().Get("to"); to != "" {
		if t, err := time.Parse("2006-01-02", to); err == nil {
			toPtr = &t
		}
	}

	returns, total, err := h.service.GetAll(outletId, page, size, fromPtr, toPtr)
	if err != nil {
		handleError(w, err)
		return
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, returns, total, totalPages, size, page)
}

func (h *SaleReturnHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	ret, err := h.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Sale return created", ret)
}
