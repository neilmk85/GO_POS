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

type PurchaseReturnHandler struct {
	service *service.PurchaseReturnService
}

func NewPurchaseReturnHandler(prs *service.PurchaseReturnService) *PurchaseReturnHandler {
	return &PurchaseReturnHandler{service: prs}
}

// GetAll GET /api/purchase-returns
func (prh *PurchaseReturnHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	outletId := r.URL.Query().Get("outletId")
	var outletIdPtr *int
	if outletId != "" {
		if id, err := strconv.Atoi(outletId); err == nil {
			outletIdPtr = &id
		}
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

	returns, total, err := prh.service.GetAll(page, size, outletIdPtr, fromPtr, toPtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, returns, total, totalPages, size, page)
}

// GetByID GET /api/purchase-returns/{id}
func (prh *PurchaseReturnHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid return ID")
		return
	}

	ret, err := prh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Purchase return retrieved", ret)
}

// Create POST /api/purchase-returns
func (prh *PurchaseReturnHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req["createdBy"] = user.Email

	ret, err := prh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Purchase return created", "id", ret.ID, "returnNumber", ret.ReturnNumber, "user", user.Email)
	util.SendSuccess(w, "Purchase return created", ret)
}
