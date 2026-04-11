package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/smtp"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

type IntegrationService struct {
	db *gorm.DB
}

func NewIntegrationService(db *gorm.DB) *IntegrationService {
	return &IntegrationService{db: db}
}

type ChannelConfig struct {
	Email   *EmailConfig   `json:"email,omitempty"`
	SMS     *SMSConfig     `json:"sms,omitempty"`
	WhatsApp *WhatsAppConfig `json:"whatsapp,omitempty"`
}

type EmailConfig struct {
	Enabled  bool   `json:"enabled"`
	FromEmail string `json:"fromEmail,omitempty"`
	FromName string `json:"fromName,omitempty"`
	SMTPHost string `json:"smtpHost,omitempty"`
	SMTPPort int    `json:"smtpPort,omitempty"`
	SMTPUser string `json:"smtpUser,omitempty"`
	SMTPPass string `json:"smtpPass,omitempty"`
}

type SMSConfig struct {
	Enabled  bool   `json:"enabled"`
	APIKey   string `json:"apiKey,omitempty"`
	SenderID string `json:"senderId,omitempty"`
}

type WhatsAppConfig struct {
	Enabled       bool   `json:"enabled"`
	APIURL        string `json:"apiUrl,omitempty"`
	Token         string `json:"token,omitempty"`
	PhoneNumberID string `json:"phoneNumberId,omitempty"`
}

// GetChannels retrieves the integration configuration (channels) for an outlet
func (is *IntegrationService) GetChannels(outletID int) (*ChannelConfig, error) {
	config := &models.IntegrationConfig{}
	if err := is.db.Where("outlet_id = ?", outletID).First(config).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &ChannelConfig{}, nil
		}
		return nil, err
	}

	var channelConfig ChannelConfig
	if config.ChannelConfig != nil {
		if err := json.Unmarshal([]byte(*config.ChannelConfig), &channelConfig); err != nil {
			slog.Error("failed to unmarshal channel config", "error", err)
			return &ChannelConfig{}, nil
		}
	}

	return &channelConfig, nil
}

// UpdateChannels updates the channel configuration for an outlet
func (is *IntegrationService) UpdateChannels(outletID int, config *ChannelConfig) (*models.IntegrationConfig, error) {
	data, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}

	configStr := string(data)
	result := &models.IntegrationConfig{}

	if err := is.db.Where("outlet_id = ?", outletID).First(result).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create new
			result = &models.IntegrationConfig{
				OutletID:      outletID,
				ChannelConfig: &configStr,
			}
			return result, is.db.Create(result).Error
		}
		return nil, err
	}

	// Update existing
	result.ChannelConfig = &configStr
	return result, is.db.Model(result).Update("channel_config", configStr).Error
}

// GetTemplates retrieves the message templates for an outlet
func (is *IntegrationService) GetTemplates(outletID int) (map[string]string, error) {
	config := &models.IntegrationConfig{}
	if err := is.db.Where("outlet_id = ?", outletID).First(config).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return make(map[string]string), nil
		}
		return nil, err
	}

	templates := make(map[string]string)
	if config.Templates != nil {
		if err := json.Unmarshal([]byte(*config.Templates), &templates); err != nil {
			slog.Error("failed to unmarshal templates", "error", err)
			return make(map[string]string), nil
		}
	}

	return templates, nil
}

// UpdateTemplates updates the message templates for an outlet
func (is *IntegrationService) UpdateTemplates(outletID int, templates map[string]string) (*models.IntegrationConfig, error) {
	data, err := json.Marshal(templates)
	if err != nil {
		return nil, err
	}

	templatesStr := string(data)
	result := &models.IntegrationConfig{}

	if err := is.db.Where("outlet_id = ?", outletID).First(result).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create new
			result = &models.IntegrationConfig{
				OutletID:  outletID,
				Templates: &templatesStr,
			}
			return result, is.db.Create(result).Error
		}
		return nil, err
	}

	// Update existing
	result.Templates = &templatesStr
	return result, is.db.Model(result).Update("templates", templatesStr).Error
}

// TestChannel tests the connectivity of a specific channel
func (is *IntegrationService) TestChannel(outletID int, channel string, testEmail string) error {
	if channel == "email" {
		return is.testEmail(outletID, testEmail)
	}
	if channel == "sms" {
		return fmt.Errorf("SMS testing not yet implemented")
	}
	if channel == "whatsapp" {
		return fmt.Errorf("WhatsApp testing not yet implemented")
	}
	return fmt.Errorf("unknown channel: %s", channel)
}

// testEmail sends a test email to verify configuration
func (is *IntegrationService) testEmail(outletID int, testEmail string) error {
	channelConfig, err := is.GetChannels(outletID)
	if err != nil {
		return err
	}

	if channelConfig.Email == nil || !channelConfig.Email.Enabled {
		return fmt.Errorf("email channel not configured")
	}

	// Use configured values or fallback to defaults
	host := channelConfig.Email.SMTPHost
	if host == "" {
		host = "smtp.gmail.com"
	}
	port := channelConfig.Email.SMTPPort
	if port == 0 {
		port = 587
	}
	user := channelConfig.Email.SMTPUser
	pass := channelConfig.Email.SMTPPass
	fromEmail := channelConfig.Email.FromEmail
	if fromEmail == "" {
		fromEmail = "receipts@posapp.com"
	}
	fromName := channelConfig.Email.FromName
	if fromName == "" {
		fromName = "POS System"
	}

	// Simple email sending
	msg := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: POS System - Test Email\r\n\r\nYour email integration is working correctly.",
		fromName, fromEmail, testEmail)

	addr := fmt.Sprintf("%s:%d", host, port)
	auth := smtp.PlainAuth("", user, pass, host)

	return smtp.SendMail(addr, auth, fromEmail, []string{testEmail}, []byte(msg))
}

// SendInvoiceEmail sends an invoice via email
func (is *IntegrationService) SendInvoiceEmail(invoiceID int, toEmail string) error {
	invoice := &models.Invoice{}
	if err := is.db.Preload("Customer").Preload("Outlet").Preload("Items").
		First(invoice, invoiceID).Error; err != nil {
		return fmt.Errorf("invoice not found: %w", err)
	}

	channelConfig, err := is.GetChannels(invoice.OutletID)
	if err != nil {
		return err
	}

	if channelConfig.Email == nil || !channelConfig.Email.Enabled {
		return fmt.Errorf("email channel not configured for outlet")
	}

	templates, err := is.GetTemplates(invoice.OutletID)
	if err != nil {
		return err
	}

	// Generate email content
	html := generateInvoiceHTML(invoice, templates)

	// Send email
	if err := is.sendEmailMessage(
		invoice.OutletID,
		toEmail,
		fmt.Sprintf("Invoice %s from %s", invoice.InvoiceNumber, invoice.Outlet.Name),
		html,
	); err != nil {
		return err
	}

	// Update invoice status
	return is.db.Model(invoice).Update("status", "SENT").Error
}

// SendQuotationEmail sends a quotation via email
func (is *IntegrationService) SendQuotationEmail(quotationID int, toEmail string) error {
	quotation := &models.Quotation{}
	if err := is.db.Preload("Customer").Preload("Outlet").Preload("Items").
		First(quotation, quotationID).Error; err != nil {
		return fmt.Errorf("quotation not found: %w", err)
	}

	channelConfig, err := is.GetChannels(quotation.OutletID)
	if err != nil {
		return err
	}

	if channelConfig.Email == nil || !channelConfig.Email.Enabled {
		return fmt.Errorf("email channel not configured for outlet")
	}

	// Generate email content
	html := generateQuotationHTML(quotation)

	// Send email
	if err := is.sendEmailMessage(
		quotation.OutletID,
		toEmail,
		fmt.Sprintf("Quotation %s from %s", quotation.QuotationNumber, quotation.Outlet.Name),
		html,
	); err != nil {
		return err
	}

	// Update quotation status
	return is.db.Model(quotation).Update("status", "SENT").Error
}

// sendEmailMessage is a helper to send email with configured SMTP
func (is *IntegrationService) sendEmailMessage(outletID int, to, subject, htmlBody string) error {
	channelConfig, err := is.GetChannels(outletID)
	if err != nil {
		return err
	}

	if channelConfig.Email == nil {
		return fmt.Errorf("email config not found")
	}

	host := channelConfig.Email.SMTPHost
	if host == "" {
		host = "smtp.gmail.com"
	}
	port := channelConfig.Email.SMTPPort
	if port == 0 {
		port = 587
	}
	user := channelConfig.Email.SMTPUser
	pass := channelConfig.Email.SMTPPass
	fromEmail := channelConfig.Email.FromEmail
	if fromEmail == "" {
		fromEmail = "receipts@posapp.com"
	}
	fromName := channelConfig.Email.FromName
	if fromName == "" {
		fromName = "POS System"
	}

	// Build MIME message
	message := buildMIMEMessage(
		fmt.Sprintf("%s <%s>", fromName, fromEmail),
		to,
		subject,
		htmlBody,
	)

	addr := fmt.Sprintf("%s:%d", host, port)
	auth := smtp.PlainAuth("", user, pass, host)

	return smtp.SendMail(addr, auth, fromEmail, []string{to}, []byte(message))
}

// Helper functions for HTML generation and MIME message building

func buildMIMEMessage(from, to, subject, htmlBody string) string {
	var buf bytes.Buffer
	buf.WriteString("From: " + from + "\r\n")
	buf.WriteString("To: " + to + "\r\n")
	buf.WriteString("Subject: " + subject + "\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(htmlBody)
	return buf.String()
}

func generateInvoiceHTML(invoice *models.Invoice, templates map[string]string) string {
	if tmpl, exists := templates["invoice"]; exists && tmpl != "" {
		return interpolateTemplate(tmpl, map[string]string{
			"invoiceName":  invoice.InvoiceNumber,
			"customerName": invoice.Customer.Name,
			"amount":       invoice.TotalAmount.String(),
			"dueDate":      invoice.DueDate.Format("2006-01-02"),
			"outletName":   invoice.Outlet.Name,
		})
	}

	// Default template
	var html bytes.Buffer
	html.WriteString("<h2>Invoice " + invoice.InvoiceNumber + "</h2>")
	html.WriteString("<p>Dear " + invoice.Customer.Name + ",</p>")
	html.WriteString("<p>Please find details of your invoice below:</p>")
	html.WriteString("<p><strong>Amount:</strong> " + invoice.TotalAmount.String() + "</p>")
	if invoice.DueDate != nil {
		html.WriteString("<p><strong>Due Date:</strong> " + invoice.DueDate.Format("2006-01-02") + "</p>")
	}
	html.WriteString("<p>Thank you for your business.</p>")
	html.WriteString("<p>" + invoice.Outlet.Name + "</p>")

	return html.String()
}

func generateQuotationHTML(quotation *models.Quotation) string {
	var html bytes.Buffer
	html.WriteString("<h2>Quotation " + quotation.QuotationNumber + "</h2>")
	html.WriteString("<p>Dear " + quotation.Customer.Name + ",</p>")
	html.WriteString("<p>Please find our quotation details below:</p>")
	html.WriteString("<p><strong>Amount:</strong> " + quotation.TotalAmount.String() + "</p>")
	if quotation.ValidUntil != nil {
		html.WriteString("<p><strong>Valid Until:</strong> " + quotation.ValidUntil.Format("2006-01-02") + "</p>")
	}
	html.WriteString("<p>Please contact us if you have any questions.</p>")
	html.WriteString("<p>" + quotation.Outlet.Name + "</p>")

	return html.String()
}

func interpolateTemplate(template string, vars map[string]string) string {
	result := template
	for key, value := range vars {
		placeholder := "{{" + key + "}}"
		result = strings.ReplaceAll(result, placeholder, value)
	}
	return string(result)
}
