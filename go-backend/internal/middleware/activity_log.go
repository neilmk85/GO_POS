package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

// ActivityLogWriter wraps http.ResponseWriter to capture response body
type activityLogWriter struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
}

func (alw *activityLogWriter) WriteHeader(statusCode int) {
	alw.statusCode = statusCode
	alw.ResponseWriter.WriteHeader(statusCode)
}

func (alw *activityLogWriter) Write(b []byte) (int, error) {
	if alw.statusCode == 0 {
		alw.statusCode = http.StatusOK
	}
	alw.body.Write(b)
	return alw.ResponseWriter.Write(b)
}

// ActivityLog middleware logs user actions to activity_logs table
func ActivityLog(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only log mutating requests
			if !isMutatingMethod(r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			// Skip logging for activity-logs and uploads paths
			if shouldSkipActivityLogging(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Read request body
			var requestBody []byte
			if r.Body != nil {
				var err error
				requestBody, err = io.ReadAll(r.Body)
				if err != nil {
					slog.Error("[ActivityLog] Failed to read request body", "error", err)
					requestBody = []byte{}
				}
				// Restore request body for handler to read
				r.Body = io.NopCloser(bytes.NewBuffer(requestBody))
			}

			// Wrap response writer
			alw := &activityLogWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Store user for logging
			user := GetUser(r)

			// Call next handler
			next.ServeHTTP(alw, r)

			// Only log successful responses (2xx)
			if alw.statusCode < 200 || alw.statusCode >= 300 {
				return
			}

			// Skip logging if no user
			if user == nil {
				return
			}

			// Log activity asynchronously
			go func() {
				action, module, description := describeActivity(r.Method, r.URL.Path, requestBody)
				entityID := extractEntityID(r.URL.Path)

				userID := user.ID
				ip := getClientIP(r)
				log := models.ActivityLog{
					UserID:      &userID,
					Action:      action,
					Module:      module,
					Description: description,
					EntityID:    entityID,
					IPAddress:   &ip,
				}

				if err := db.Create(&log).Error; err != nil {
					slog.Error("[ActivityLog] Failed to save activity log", "error", err)
				}
			}()
		})
	}
}

// isMutatingMethod checks if the HTTP method mutates data
func isMutatingMethod(method string) bool {
	return method == http.MethodPost ||
		method == http.MethodPut ||
		method == http.MethodPatch ||
		method == http.MethodDelete
}

// shouldSkipActivityLogging checks if the path should skip activity logging
func shouldSkipActivityLogging(path string) bool {
	skip := []string{
		"/activity-logs",
		"/uploads",
	}

	for _, s := range skip {
		if strings.HasPrefix(path, s) {
			return true
		}
	}

	return false
}

// describeActivity determines action, module, and description based on route
func describeActivity(method, path string, body []byte) (string, string, string) {
	segments := strings.Split(strings.Trim(path, "/"), "/")

	// Default values
	action := "UPDATE"
	module := "GENERAL"
	description := ""

	if len(segments) < 3 {
		return action, module, description
	}

	resource := segments[2]

	// Set action based on method
	switch method {
	case http.MethodPost:
		action = "CREATE"
	case http.MethodPut:
		action = "UPDATE"
	case http.MethodPatch:
		action = "UPDATE"
	case http.MethodDelete:
		action = "DELETE"
	}

	// Map resources to modules and set descriptions
	switch resource {
	case "auth":
		module = "AUTHENTICATION"
		if len(segments) > 3 && segments[3] == "login" {
			description = "User login"
		} else if len(segments) > 3 && segments[3] == "register" {
			description = "User registration"
		}

	case "users", "staff":
		module = "USERS"
		if action == "CREATE" {
			description = "Created new user"
		} else if action == "UPDATE" {
			description = "Updated user"
		} else if action == "DELETE" {
			description = "Deleted user"
		}

	case "products":
		module = "PRODUCTS"
		if action == "CREATE" {
			description = "Created new product"
		} else if action == "UPDATE" {
			description = "Updated product"
		} else if action == "DELETE" {
			description = "Deleted product"
		}

	case "categories":
		module = "CATEGORIES"
		if action == "CREATE" {
			description = "Created new category"
		} else if action == "UPDATE" {
			description = "Updated category"
		} else if action == "DELETE" {
			description = "Deleted category"
		}

	case "orders":
		module = "ORDERS"
		if action == "CREATE" {
			description = "Created new order"
			if label := getOrderNumber(body); label != "" {
				description += " - " + label
			}
		} else if action == "UPDATE" {
			description = "Updated order"
		} else if action == "DELETE" {
			description = "Deleted order"
		}

	case "invoices":
		module = "INVOICES"
		if action == "CREATE" {
			description = "Created new invoice"
			if label := getInvoiceNumber(body); label != "" {
				description += " - " + label
			}
		} else if action == "UPDATE" {
			description = "Updated invoice"
		} else if action == "DELETE" {
			description = "Deleted invoice"
		}

	case "quotations":
		module = "QUOTATIONS"
		if action == "CREATE" {
			description = "Created new quotation"
			if label := getQuotationNumber(body); label != "" {
				description += " - " + label
			}
		} else if action == "UPDATE" {
			description = "Updated quotation"
		} else if action == "DELETE" {
			description = "Deleted quotation"
		}

	case "credit-notes":
		module = "CREDIT_NOTES"
		description = strings.ToTitle(action) + " credit note"

	case "inventory":
		module = "INVENTORY"
		description = strings.ToTitle(action) + " inventory item"

	case "stock-adjustments":
		module = "STOCK"
		description = "Stock adjustment"

	case "stock-transfers":
		module = "STOCK"
		description = "Stock transfer"

	case "purchase-orders":
		module = "PURCHASES"
		description = strings.ToTitle(action) + " purchase order"

	case "purchase-bills":
		module = "PURCHASES"
		description = strings.ToTitle(action) + " purchase bill"

	case "purchase-returns":
		module = "PURCHASES"
		description = strings.ToTitle(action) + " purchase return"

	case "expenses":
		module = "EXPENSES"
		description = strings.ToTitle(action) + " expense"

	case "discounts":
		module = "DISCOUNTS"
		description = strings.ToTitle(action) + " discount"

	case "coupons":
		module = "COUPONS"
		description = strings.ToTitle(action) + " coupon"

	case "price-lists":
		module = "PRICING"
		description = strings.ToTitle(action) + " price list"

	case "customers":
		module = "CUSTOMERS"
		if action == "CREATE" {
			description = "Created new customer"
		} else if action == "UPDATE" {
			description = "Updated customer"
		} else if action == "DELETE" {
			description = "Deleted customer"
		}

	case "tax-groups":
		module = "TAX"
		description = strings.ToTitle(action) + " tax group"

	case "custom-roles":
		module = "ROLES"
		description = strings.ToTitle(action) + " custom role"

	case "outlets":
		module = "OUTLETS"
		description = strings.ToTitle(action) + " outlet"

	case "incentives":
		module = "INCENTIVES"
		description = strings.ToTitle(action) + " incentive"

	case "sales-orders":
		module = "SALES_ORDERS"
		description = strings.ToTitle(action) + " sales order"

	case "expense-categories":
		module = "EXPENSES"
		description = strings.ToTitle(action) + " expense category"

	default:
		module = strings.ToUpper(resource)
		description = strings.ToTitle(action) + " " + strings.ToLower(resource)
	}

	return action, module, description
}

// extractEntityID extracts ID from URL path
func extractEntityID(path string) *int {
	segments := strings.Split(strings.Trim(path, "/"), "/")

	// If there's a numeric ID in the path (typically after resource name)
	if len(segments) > 3 {
		// Try to parse the last segment as ID
		var id int
		if err := json.Unmarshal([]byte(segments[len(segments)-1]), &id); err == nil {
			return &id
		}
	}

	return nil
}

// extractEntityLabel extracts a label from request body
func extractEntityLabel(body []byte) *string {
	if len(body) == 0 {
		return nil
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}

	// Try common field names for entity labels
	labelFields := []string{
		"invoiceNumber",
		"invoice_number",
		"quotationNumber",
		"quotation_number",
		"orderNumber",
		"order_number",
		"number",
		"code",
		"name",
	}

	for _, field := range labelFields {
		if val, ok := data[field]; ok {
			if strVal, ok := val.(string); ok {
				return &strVal
			}
		}
	}

	return nil
}

// Helper functions to extract specific fields
func getOrderNumber(body []byte) string {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return ""
	}

	if val, ok := data["orderNumber"]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}

	return ""
}

func getInvoiceNumber(body []byte) string {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return ""
	}

	if val, ok := data["invoiceNumber"]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}

	return ""
}

func getQuotationNumber(body []byte) string {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return ""
	}

	if val, ok := data["quotationNumber"]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}

	return ""
}
