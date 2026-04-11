package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type IntegrationHandler struct {
	service *service.IntegrationService
}

func NewIntegrationHandler(is *service.IntegrationService) *IntegrationHandler {
	return &IntegrationHandler{service: is}
}

// GetChannels retrieves the channel configuration for an outlet
func (ih *IntegrationHandler) GetChannels(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	if outletIDStr == "" {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	outletID, err := strconv.Atoi(outletIDStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	config, err := ih.service.GetChannels(outletID)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Channel configuration retrieved", config)
}

// UpdateChannels updates the channel configuration for an outlet
func (ih *IntegrationHandler) UpdateChannels(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutletID int                       `json:"outletId"`
		Email    *service.EmailConfig      `json:"email,omitempty"`
		SMS      *service.SMSConfig        `json:"sms,omitempty"`
		WhatsApp *service.WhatsAppConfig   `json:"whatsapp,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	config := &service.ChannelConfig{
		Email:    req.Email,
		SMS:      req.SMS,
		WhatsApp: req.WhatsApp,
	}

	result, err := ih.service.UpdateChannels(req.OutletID, config)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Channel settings updated", result)
}

// GetTemplates retrieves the message templates for an outlet
func (ih *IntegrationHandler) GetTemplates(w http.ResponseWriter, r *http.Request) {
	outletIDStr := r.URL.Query().Get("outletId")
	if outletIDStr == "" {
		util.SendError(w, http.StatusBadRequest, "outletId is required")
		return
	}

	outletID, err := strconv.Atoi(outletIDStr)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid outlet ID")
		return
	}

	templates, err := ih.service.GetTemplates(outletID)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Templates retrieved", templates)
}

// UpdateTemplates updates the message templates for an outlet
func (ih *IntegrationHandler) UpdateTemplates(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutletID  int               `json:"outletId"`
		Templates map[string]string `json:"templates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := ih.service.UpdateTemplates(req.OutletID, req.Templates)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Templates updated", result)
}

// TestChannel tests the connectivity of a specific channel
func (ih *IntegrationHandler) TestChannel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutletID  int    `json:"outletId"`
		Channel   string `json:"channel"`
		TestEmail string `json:"testEmail,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.TestEmail == "" {
		req.TestEmail = "test@example.com"
	}

	if err := ih.service.TestChannel(req.OutletID, req.Channel, req.TestEmail); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Test "+req.Channel+" sent", nil)
}

// SendInvoiceEmail sends an invoice via email
func (ih *IntegrationHandler) SendInvoiceEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InvoiceID int    `json:"invoiceId"`
		Email     string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := ih.service.SendInvoiceEmail(req.InvoiceID, req.Email); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Invoice email sent", nil)
}

// SendQuotationEmail sends a quotation via email
func (ih *IntegrationHandler) SendQuotationEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QuotationID int    `json:"quotationId"`
		Email       string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := ih.service.SendQuotationEmail(req.QuotationID, req.Email); err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Quotation email sent", nil)
}
