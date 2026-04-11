package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type PriceListHandler struct {
	service *service.PriceListService
}

func NewPriceListHandler(pls *service.PriceListService) *PriceListHandler {
	return &PriceListHandler{service: pls}
}

func (plh *PriceListHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	priceLists, err := plh.service.GetAll()
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price lists retrieved", priceLists)
}

func (plh *PriceListHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid price list ID")
		return
	}

	priceList, err := plh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price list retrieved", priceList)
}

func (plh *PriceListHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.PriceListCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	priceList, err := plh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price list created", priceList)
}

func (plh *PriceListHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid price list ID")
		return
	}

	var req service.PriceListCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	priceList, err := plh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price list updated", priceList)
}

func (plh *PriceListHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid price list ID")
		return
	}

	priceList, err := plh.service.ToggleActive(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price list toggled", priceList)
}

func (plh *PriceListHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid price list ID")
		return
	}

	err = plh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price list deleted", nil)
}

func (plh *PriceListHandler) ResolvePrice(w http.ResponseWriter, r *http.Request) {
	productIdStr := r.URL.Query().Get("productId")
	if productIdStr == "" {
		util.SendError(w, http.StatusBadRequest, "productId parameter is required")
		return
	}

	productId, err := strconv.Atoi(productIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var variantId *int
	variantIdStr := r.URL.Query().Get("variantId")
	if variantIdStr != "" {
		vid, err := strconv.Atoi(variantIdStr)
		if err == nil {
			variantId = &vid
		}
	}

	var customerId *int
	customerIdStr := r.URL.Query().Get("customerId")
	if customerIdStr != "" {
		cid, err := strconv.Atoi(customerIdStr)
		if err == nil {
			customerId = &cid
		}
	}

	resolved, err := plh.service.ResolvePrice(productId, variantId, customerId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Price resolved", resolved)
}
