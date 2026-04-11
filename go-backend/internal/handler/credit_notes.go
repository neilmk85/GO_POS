package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type CreditNoteHandler struct {
	service *service.CreditNoteService
}

func NewCreditNoteHandler(cns *service.CreditNoteService) *CreditNoteHandler {
	return &CreditNoteHandler{service: cns}
}

func (cnh *CreditNoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreditNoteCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	creditNote, err := cnh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Credit note created", creditNote)
}

func (cnh *CreditNoteHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	outletIdStr := r.URL.Query().Get("outletId")
	if outletIdStr == "" {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	outletId, err := strconv.Atoi(outletIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	page, size := util.ParsePagination(r)

	statusStr := r.URL.Query().Get("status")
	var status *string
	if statusStr != "" {
		status = &statusStr
	}

	creditNotes, total, err := cnh.service.GetAll(outletId, status, page, size)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, creditNotes, total, totalPages, size, page)
}

func (cnh *CreditNoteHandler) GetByCustomer(w http.ResponseWriter, r *http.Request) {
	customerId, err := strconv.Atoi(r.PathValue("customerId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	creditNotes, err := cnh.service.GetByCustomer(customerId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Credit notes retrieved", creditNotes)
}

func (cnh *CreditNoteHandler) GetActiveByCustomer(w http.ResponseWriter, r *http.Request) {
	customerId, err := strconv.Atoi(r.PathValue("customerId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid customer ID")
		return
	}

	creditNotes, err := cnh.service.GetActiveByCustomer(customerId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Active credit notes retrieved", creditNotes)
}

func (cnh *CreditNoteHandler) Apply(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid credit note ID")
		return
	}

	var body struct {
		Amount decimal.Decimal `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	creditNote, err := cnh.service.Apply(id, body.Amount)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Credit note applied", creditNote)
}

func (cnh *CreditNoteHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid credit note ID")
		return
	}

	reason := r.URL.Query().Get("reason")
	if reason == "" {
		reason = "Cancelled"
	}

	creditNote, err := cnh.service.Cancel(id, reason)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Credit note cancelled", creditNote)
}
