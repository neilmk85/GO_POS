package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ExpenseCategoryHandler struct {
	service *service.ExpenseService
}

func NewExpenseCategoryHandler(es *service.ExpenseService) *ExpenseCategoryHandler {
	return &ExpenseCategoryHandler{service: es}
}

func (ech *ExpenseCategoryHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	result, err := ech.service.GetAllCategories(nil)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Categories retrieved", result)
}

func (ech *ExpenseCategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := ech.service.CreateCategory(data)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Category created", result)
}

func (ech *ExpenseCategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := ech.service.UpdateCategory(id, data)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Category updated", result)
}

func (ech *ExpenseCategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid category ID")
		return
	}

	if err := ech.service.DeleteCategory(id); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Category deleted", nil)
}
