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

type CategoryHandler struct {
	service *service.CategoryService
}

func NewCategoryHandler(cs *service.CategoryService) *CategoryHandler {
	return &CategoryHandler{service: cs}
}

func (ch *CategoryHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	categories, err := ch.service.GetAll()
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Categories retrieved", categories)
}

func (ch *CategoryHandler) GetRoots(w http.ResponseWriter, r *http.Request) {
	categories, err := ch.service.GetRoots()
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Root categories retrieved", categories)
}

func (ch *CategoryHandler) GetChildren(w http.ResponseWriter, r *http.Request) {
	parentId, err := strconv.Atoi(r.PathValue("parentId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parent ID")
		return
	}

	categories, err := ch.service.GetChildren(parentId)
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Child categories retrieved", categories)
}

func (ch *CategoryHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	category, err := ch.service.GetByID(id)
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Category retrieved", category)
}

func (ch *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var dto service.CreateCategoryDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	category, err := ch.service.Create(dto)
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Category created", category)
}

func (ch *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r)
	if user == nil {
		util.SendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var dto service.CreateCategoryDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dto.CreatedBy = &user.Email

	category, err := ch.service.Update(id, dto)
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Category updated", category)
}

func (ch *CategoryHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	category, err := ch.service.ToggleActive(id)
	if err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Category status toggled", category)
}

func (ch *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	if err := ch.service.Delete(id); err != nil {
		handleCategoryError(w, err)
		return
	}

	util.SendSuccess(w, "Category deleted", nil)
}

func handleCategoryError(w http.ResponseWriter, err error) {
	if be, ok := err.(*util.BusinessException); ok {
		util.SendError(w, be.Status, be.Message)
		return
	}

	if rn, ok := err.(*util.ResourceNotFoundException); ok {
		util.SendError(w, http.StatusNotFound, rn.Message)
		return
	}

	slog.Error("Category handler error", "error", err)
	util.SendError(w, http.StatusInternalServerError, "Internal server error")
}
