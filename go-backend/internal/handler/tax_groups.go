package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type TaxGroupHandler struct {
	service *service.TaxGroupService
}

func NewTaxGroupHandler(tgs *service.TaxGroupService) *TaxGroupHandler {
	return &TaxGroupHandler{service: tgs}
}

func (th *TaxGroupHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	taxGroups, err := th.service.GetAll()
	if err != nil {
		handleTaxGroupError(w, err)
		return
	}

	util.SendSuccess(w, "Tax groups retrieved", taxGroups)
}

func (th *TaxGroupHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid tax group ID")
		return
	}

	taxGroup, err := th.service.GetByID(id)
	if err != nil {
		handleTaxGroupError(w, err)
		return
	}

	util.SendSuccess(w, "Tax group retrieved", taxGroup)
}

func (th *TaxGroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var dto service.CreateTaxGroupDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	taxGroup, err := th.service.Create(dto)
	if err != nil {
		handleTaxGroupError(w, err)
		return
	}

	util.SendSuccess(w, "Tax group created", taxGroup)
}

func (th *TaxGroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid tax group ID")
		return
	}

	var dto service.CreateTaxGroupDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	taxGroup, err := th.service.Update(id, dto)
	if err != nil {
		handleTaxGroupError(w, err)
		return
	}

	util.SendSuccess(w, "Tax group updated", taxGroup)
}

func (th *TaxGroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid tax group ID")
		return
	}

	if err := th.service.Delete(id); err != nil {
		handleTaxGroupError(w, err)
		return
	}

	util.SendSuccess(w, "Tax group deleted", nil)
}

func handleTaxGroupError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		util.SendError(w, be.Status, be.Message)
		return
	}

	if rn, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, rn.Message)
		return
	}

	slog.Error("Tax group handler error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}
