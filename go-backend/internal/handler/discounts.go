package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
)

type DiscountHandler struct {
	service *service.DiscountService
}

func NewDiscountHandler(ds *service.DiscountService) *DiscountHandler {
	return &DiscountHandler{service: ds}
}

func (dh *DiscountHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	activeStr := r.URL.Query().Get("active")
	var active *bool
	if activeStr != "" {
		a := activeStr == "true"
		active = &a
	}

	discounts, err := dh.service.GetAll(active)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Discounts retrieved", discounts)
}

func (dh *DiscountHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.DiscountCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	discount, err := dh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Discount created", discount)
}

func (dh *DiscountHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	var req service.DiscountCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	discount, err := dh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Discount updated", discount)
}

func (dh *DiscountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid discount ID")
		return
	}

	err = dh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Discount deleted", nil)
}

func (dh *DiscountHandler) GetActiveForProduct(w http.ResponseWriter, r *http.Request) {
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

	discounts, err := dh.service.GetActiveForProduct(productId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Active discounts retrieved", discounts)
}

func (dh *DiscountHandler) PreviewDiscount(w http.ResponseWriter, r *http.Request) {
	productIdStr := r.URL.Query().Get("productId")
	quantityStr := r.URL.Query().Get("quantity")
	priceStr := r.URL.Query().Get("unitPrice")

	if productIdStr == "" || quantityStr == "" || priceStr == "" {
		util.SendError(w, http.StatusBadRequest, "productId, quantity, and unitPrice parameters are required")
		return
	}

	productId, err := strconv.Atoi(productIdStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	quantity, err := decimal.NewFromString(quantityStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid quantity")
		return
	}

	price, err := decimal.NewFromString(priceStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid unit price")
		return
	}

	discount, err := dh.service.PreviewDiscount(productId, quantity, price)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Discount preview", map[string]interface{}{
		"discountAmount": discount,
	})
}

// Coupon endpoints
func (dh *DiscountHandler) GetCoupons(w http.ResponseWriter, r *http.Request) {
	activeStr := r.URL.Query().Get("active")
	var active *bool
	if activeStr != "" {
		a := activeStr == "true"
		active = &a
	}

	coupons, err := dh.service.GetAllCoupons(active)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Coupons retrieved", coupons)
}

func (dh *DiscountHandler) ValidateCoupon(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	amountStr := r.URL.Query().Get("amount")
	customerIdStr := r.URL.Query().Get("customerId")

	if code == "" || amountStr == "" {
		util.SendError(w, http.StatusBadRequest, "code and amount parameters are required")
		return
	}

	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid amount")
		return
	}

	var customerId *int
	if customerIdStr != "" {
		id, err := strconv.Atoi(customerIdStr)
		if err == nil {
			customerId = &id
		}
	}

	coupon, err := dh.service.ValidateCoupon(code, amount, customerId)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Coupon is valid", coupon)
}

func (dh *DiscountHandler) CreateCoupon(w http.ResponseWriter, r *http.Request) {
	var req service.CouponCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	coupon, err := dh.service.CreateCoupon(req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Coupon created", coupon)
}

func (dh *DiscountHandler) UpdateCoupon(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid coupon ID")
		return
	}

	var req service.CouponCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	coupon, err := dh.service.UpdateCoupon(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Coupon updated", coupon)
}

func (dh *DiscountHandler) DeleteCoupon(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid coupon ID")
		return
	}

	err = dh.service.DeleteCoupon(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Coupon deleted", nil)
}
