package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type ExpenseHandler struct {
	service *service.ExpenseService
}

func NewExpenseHandler(es *service.ExpenseService) *ExpenseHandler {
	return &ExpenseHandler{service: es}
}

func (eh *ExpenseHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)

	categoryId := (*int)(nil)
	if catStr := r.URL.Query().Get("categoryId"); catStr != "" {
		if catId, err := strconv.Atoi(catStr); err == nil {
			categoryId = &catId
		}
	}

	status := (*string)(nil)
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	from := (*time.Time)(nil)
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = &t
		}
	}

	to := (*time.Time)(nil)
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			endOfDay := t.Add(time.Hour*23 + time.Minute*59 + time.Second*59)
			to = &endOfDay
		}
	}

	result, err := eh.service.GetAll(outletId, categoryId, status, from, to, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Expenses retrieved", result)
}

func (eh *ExpenseHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	from := (*time.Time)(nil)
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = &t
		}
	}

	to := (*time.Time)(nil)
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			endOfDay := t.Add(time.Hour*23 + time.Minute*59 + time.Second*59)
			to = &endOfDay
		}
	}

	result, err := eh.service.GetStats(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Expense stats retrieved", result)
}

func (eh *ExpenseHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.ExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := eh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Expense recorded", result)
}

func (eh *ExpenseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid expense ID")
		return
	}

	var req service.ExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := eh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Expense updated", result)
}

func (eh *ExpenseHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid expense ID")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		util.SendError(w, http.StatusBadRequest, "Status parameter required")
		return
	}

	result, err := eh.service.UpdateStatus(id, status)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Status updated", result)
}

func (eh *ExpenseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid expense ID")
		return
	}

	if err := eh.service.Delete(id); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Expense deleted", nil)
}

func (eh *ExpenseHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	from := (*time.Time)(nil)
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = &t
		}
	}

	to := (*time.Time)(nil)
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			endOfDay := t.Add(time.Hour*23 + time.Minute*59 + time.Second*59)
			to = &endOfDay
		}
	}

	csv, err := eh.service.ExportCSV(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	date := time.Now().Format("2006-01-02")
	w.Header().Set("Content-Disposition", "attachment; filename=\"expenses-"+date+".csv\"")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write([]byte(csv))
}

func (eh *ExpenseHandler) GenerateRecurring(w http.ResponseWriter, r *http.Request) {
	count, err := eh.service.GenerateRecurringExpenses()
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Generated recurring expenses", map[string]int{"generated": count})
}
