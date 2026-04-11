package router

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/nilesh/pos-backend/internal/config"
	"github.com/nilesh/pos-backend/internal/handler"
	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/websocket"
	"gorm.io/gorm"
)

// Setup creates and configures the HTTP router with all routes and middleware
func Setup(db *gorm.DB, cfg *config.Config, wsHub *websocket.Hub) http.Handler {
	mux := http.NewServeMux()

	// Initialize services and handlers
	authService := service.NewAuthService(db)
	authHandler := handler.NewAuthHandler(authService)

	userService := service.NewUserService(db)
	usersHandler := handler.NewUsersHandler(userService)

	outletsHandler := handler.NewOutletsHandler(db)
	staffHandler := handler.NewStaffHandler(db)

	// ==================== CUSTOMER & PURCHASING SERVICES ====================
	customerService := service.NewCustomerService(db)
	customerHandler := handler.NewCustomerHandler(customerService)

	vendorService := service.NewVendorService(db)
	vendorHandler := handler.NewVendorHandler(vendorService)

	purchaseOrderService := service.NewPurchaseOrderService(db)
	purchaseOrderHandler := handler.NewPurchaseOrderHandler(purchaseOrderService)

	purchaseBillService := service.NewPurchaseBillService(db)
	purchaseBillHandler := handler.NewPurchaseBillHandler(purchaseBillService)

	purchaseReturnService := service.NewPurchaseReturnService(db)
	purchaseReturnHandler := handler.NewPurchaseReturnHandler(purchaseReturnService)

	bulkPurchaseService := service.NewBulkPurchaseService(db)
	bulkPurchaseHandler := handler.NewBulkPurchaseHandler(bulkPurchaseService)

	// ==================== INTEGRATION, SALES ORDERS & OTHER SERVICES ====================
	integrationService := service.NewIntegrationService(db)
	integrationHandler := handler.NewIntegrationHandler(integrationService)

	salesOrderService := service.NewSalesOrderService(db)
	salesOrderHandler := handler.NewSalesOrderHandler(salesOrderService)

	categoryService := service.NewCategoryService(db)
	categoryHandler := handler.NewCategoryHandler(categoryService)

	taxGroupService := service.NewTaxGroupService(db)
	taxGroupHandler := handler.NewTaxGroupHandler(taxGroupService)

	productService := service.NewProductService(db)
	productHandler := handler.NewProductHandler(productService, cfg.UploadDir, int64(cfg.MaxFileSize))

	reportService := service.NewReportService(db)
	reportHandler := handler.NewReportHandler(reportService)

	inventoryService := service.NewInventoryService(db)
	inventoryHandler := handler.NewInventoryHandler(inventoryService)

	incentiveService := service.NewIncentiveService(db)
	incentiveHandler := handler.NewIncentiveHandler(incentiveService)

	expenseService := service.NewExpenseService(db)
	expenseCategoryHandler := handler.NewExpenseCategoryHandler(expenseService)
	expenseHandler := handler.NewExpenseHandler(expenseService)

	invoiceService := service.NewInvoiceService(db)
	invoiceHandler := handler.NewInvoiceHandler(invoiceService)

	quotationService := service.NewQuotationService(db)
	quotationHandler := handler.NewQuotationHandler(quotationService)

	creditNoteService := service.NewCreditNoteService(db)
	creditNoteHandler := handler.NewCreditNoteHandler(creditNoteService)

	discountService := service.NewDiscountService(db)
	discountHandler := handler.NewDiscountHandler(discountService)

	shiftService := service.NewShiftService(db)
	shiftHandler := handler.NewShiftHandler(shiftService)

	orderService := service.NewOrderService(db)
	orderHandler := handler.NewOrderHandler(orderService)

	priceListService := service.NewPriceListService(db)
	priceListHandler := handler.NewPriceListHandler(priceListService)

	customRoleHandler := handler.NewCustomRoleHandler(db)
	activityLogHandler := handler.NewActivityLogHandler(db)

	// ==================== WEBSOCKET ====================
	mux.HandleFunc("GET /ws", wsHub.HandleWS)

	// ==================== HEALTH CHECKS ====================
	mux.HandleFunc("GET /health", handler.HealthCheck)
	mux.HandleFunc("GET /api/health", handler.HealthCheck)

	// ==================== AUTHENTICATION ====================
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/auth/register", middleware.Chain(
		authHandler.Register,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/auth/refresh", authHandler.RefreshToken)
	mux.HandleFunc("POST /api/auth/logout", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))

	// ==================== USERS / STAFF ====================
	mux.HandleFunc("GET /api/users", middleware.Chain(
		usersHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/users/me", middleware.Chain(
		usersHandler.GetProfile,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/users/me", middleware.Chain(
		usersHandler.UpdateProfile,
		middleware.Authenticate(db),
	))
	// /api/users/outlet/{outletId} — adapter: rewrites path param → query param for staffHandler.GetAll
	mux.HandleFunc("GET /api/users/outlet/{outletId}", middleware.Chain(
		func(w http.ResponseWriter, r *http.Request) {
			outletId := r.PathValue("outletId")
			q := r.URL.Query()
			q.Set("outletId", outletId)
			r.URL.RawQuery = q.Encode()
			staffHandler.GetAll(w, r)
		},
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/users/{id}", middleware.Chain(
		usersHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/users", middleware.Chain(
		usersHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/users/{id}", middleware.Chain(
		usersHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/users/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/users/{id}/change-password", middleware.Chain(
		usersHandler.ChangePassword,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/users/{id}/deactivate", middleware.Chain(
		usersHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/users/{id}/activate", middleware.Chain(
		usersHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// Staff endpoints (alias for users)
	mux.HandleFunc("GET /api/staff", middleware.Chain(
		staffHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/staff/export/csv", middleware.Chain(
		staffHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/staff", middleware.Chain(
		usersHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/staff/{id}", middleware.Chain(
		usersHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/staff/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== OUTLETS ====================
	mux.HandleFunc("GET /api/outlets", middleware.Chain(
		outletsHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/outlets/{id}", middleware.Chain(
		outletsHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/outlets", middleware.Chain(
		outletsHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))
	mux.HandleFunc("PUT /api/outlets/{id}", middleware.Chain(
		outletsHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PATCH /api/outlets/{id}", middleware.Chain(
		outletsHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PRODUCTS ====================
	mux.HandleFunc("GET /api/products", middleware.Chain(
		productHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/search", middleware.Chain(
		productHandler.Search,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/units", middleware.Chain(
		productHandler.GetUnits,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/low-stock", middleware.Chain(
		productHandler.GetLowStock,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/generate-barcode", middleware.Chain(
		productHandler.GenerateBarcode,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/import/template", middleware.Chain(
		productHandler.GetImportTemplate,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/export/csv", middleware.Chain(
		productHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/products/barcode/{barcode}", middleware.Chain(
		productHandler.GetByBarcode,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/category/{categoryId}", middleware.Chain(
		productHandler.GetByCategory,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/products/{id}", middleware.Chain(
		productHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/products", middleware.Chain(
		productHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/products/{id}", middleware.Chain(
		productHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PATCH /api/products/{id}/toggle-active", middleware.Chain(
		productHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}", middleware.Chain(
		productHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/products/bulk-import", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/products/{id}/images", middleware.Chain(
		productHandler.UploadImage,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}/images/{imageId}", middleware.Chain(
		productHandler.DeleteImage,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/products/{id}/variants", middleware.Chain(
		productHandler.CreateVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/products/{id}/variants/{variantId}", middleware.Chain(
		productHandler.UpdateVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/products/{id}/variants/{variantId}", middleware.Chain(
		productHandler.DeleteVariant,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))

	// ==================== CATEGORIES ====================
	mux.HandleFunc("GET /api/categories/roots", middleware.Chain(
		categoryHandler.GetRoots,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories/{id}/children", middleware.Chain(
		categoryHandler.GetChildren,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories", middleware.Chain(
		categoryHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/categories/{id}", middleware.Chain(
		categoryHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/categories", middleware.Chain(
		categoryHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/categories/{id}", middleware.Chain(
		categoryHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PATCH /api/categories/{id}/toggle-active", middleware.Chain(
		categoryHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/categories/{id}", middleware.Chain(
		categoryHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== TAX GROUPS ====================
	mux.HandleFunc("GET /api/tax-groups", middleware.Chain(
		taxGroupHandler.GetAll,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("GET /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.GetByID,
		middleware.OptionalAuth(db),
	))
	mux.HandleFunc("POST /api/tax-groups", middleware.Chain(
		taxGroupHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("PUT /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/tax-groups/{id}", middleware.Chain(
		taxGroupHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== INVENTORY ====================
	mux.HandleFunc("GET /api/inventory/low-stock", middleware.Chain(
		inventoryHandler.GetLowStock,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/adjustments", middleware.Chain(
		inventoryHandler.GetAdjustments,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/transfers", middleware.Chain(
		inventoryHandler.GetTransfers,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/transfers/{id}", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/approve", middleware.Chain(
		inventoryHandler.ApproveTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/ship", middleware.Chain(
		inventoryHandler.ShipTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/inventory/transfers/{id}/receive", middleware.Chain(
		inventoryHandler.ReceiveTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/inventory", middleware.Chain(
		inventoryHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/inventory/{id}", middleware.Chain(
		inventoryHandler.GetByProductAndOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/inventory/adjustments", middleware.Chain(
		inventoryHandler.AdjustStock,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/inventory/transfers", middleware.Chain(
		inventoryHandler.CreateTransfer,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/inventory/export", middleware.Chain(
		handleNotImplemented,
		middleware.Authenticate(db),
	))

	// ==================== CUSTOMERS ====================
	mux.HandleFunc("GET /api/customers", middleware.Chain(
		customerHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/with-dues", middleware.Chain(
		customerHandler.GetWithDues,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/search", middleware.Chain(
		customerHandler.Search,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/phone", middleware.Chain(
		customerHandler.GetByPhone,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/{id}", middleware.Chain(
		customerHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/{id}/loyalty-history", middleware.Chain(
		customerHandler.GetLoyaltyHistory,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/customers", middleware.Chain(
		customerHandler.Create,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PUT /api/customers/{id}", middleware.Chain(
		customerHandler.Update,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/customers/import", middleware.Chain(
		customerHandler.ImportCSV,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/customers/export/csv", middleware.Chain(
		customerHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/customers/export/excel", middleware.Chain(
		customerHandler.ExportExcel,
		middleware.Authenticate(db),
	))

	// ==================== ORDERS ====================
	mux.HandleFunc("GET /api/orders", middleware.Chain(
		orderHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/orders/customer/{customerId}", middleware.Chain(
		orderHandler.GetByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/orders/number/{orderNumber}", middleware.Chain(
		orderHandler.GetByOrderNumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/orders", middleware.Chain(
		orderHandler.Checkout,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("POST /api/orders/{id}/return", middleware.Chain(
		orderHandler.ProcessReturn,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("POST /api/orders/{id}/hold", middleware.Chain(
		orderHandler.HoldOrder,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))

	// ==================== INVOICES ====================
	mux.HandleFunc("GET /api/invoices", middleware.Chain(
		invoiceHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/invoices/{id}", middleware.Chain(
		invoiceHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/invoices", middleware.Chain(
		invoiceHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/invoices/{id}", middleware.Chain(
		invoiceHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("PATCH /api/invoices/{id}/status", middleware.Chain(
		invoiceHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/invoices/{id}/payment", middleware.Chain(
		invoiceHandler.RecordPayment,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/invoices/{id}/send", middleware.Chain(
		invoiceHandler.SendEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/invoices/{id}", middleware.Chain(
		invoiceHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== QUOTATIONS ====================
	mux.HandleFunc("GET /api/quotations", middleware.Chain(
		quotationHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/quotations/{id}", middleware.Chain(
		quotationHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/quotations", middleware.Chain(
		quotationHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/quotations/{id}", middleware.Chain(
		quotationHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/quotations/{id}/status", middleware.Chain(
		quotationHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/quotations/{id}", middleware.Chain(
		quotationHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== CREDIT NOTES ====================
	mux.HandleFunc("GET /api/credit-notes", middleware.Chain(
		creditNoteHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/credit-notes/customer/{customerId}", middleware.Chain(
		creditNoteHandler.GetByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/credit-notes/customer/{customerId}/active", middleware.Chain(
		creditNoteHandler.GetActiveByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/credit-notes", middleware.Chain(
		creditNoteHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/credit-notes/{id}/apply", middleware.Chain(
		creditNoteHandler.Apply,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("POST /api/credit-notes/{id}/cancel", middleware.Chain(
		creditNoteHandler.Cancel,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))

	// ==================== DISCOUNTS & COUPONS ====================
	mux.HandleFunc("GET /api/discounts", middleware.Chain(
		discountHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/discounts/coupons", middleware.Chain(
		discountHandler.GetCoupons,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/discounts", middleware.Chain(
		discountHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/discounts/{id}", middleware.Chain(
		discountHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/discounts/{id}", middleware.Chain(
		discountHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/discounts/coupons", middleware.Chain(
		discountHandler.CreateCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/discounts/coupons/{id}", middleware.Chain(
		discountHandler.UpdateCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/discounts/coupons/{id}", middleware.Chain(
		discountHandler.DeleteCoupon,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/discounts/coupons/{code}/validate", middleware.Chain(
		discountHandler.ValidateCoupon,
		middleware.OptionalAuth(db),
	))

	// ==================== SHIFTS ====================
	mux.HandleFunc("GET /api/shifts/outlet/{outletId}", middleware.Chain(
		shiftHandler.GetByOutlet,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/shifts/current/{cashierId}", middleware.Chain(
		shiftHandler.GetCurrent,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/shifts/open", middleware.Chain(
		shiftHandler.Open,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/shifts/{id}/close", middleware.Chain(
		shiftHandler.Close,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "CASHIER", "MANAGER"),
	))

	// ==================== PRICE LISTS ====================
	mux.HandleFunc("GET /api/price-lists", middleware.Chain(
		priceListHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/price-lists/{id}", middleware.Chain(
		priceListHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/price-lists", middleware.Chain(
		priceListHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/price-lists/{id}", middleware.Chain(
		priceListHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/price-lists/{id}/toggle-active", middleware.Chain(
		priceListHandler.ToggleActive,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/price-lists/{id}", middleware.Chain(
		priceListHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/price-lists/resolve", middleware.Chain(
		priceListHandler.ResolvePrice,
		middleware.OptionalAuth(db),
	))

	// ==================== VENDORS / SUPPLIERS ====================
	mux.HandleFunc("GET /api/vendors", middleware.Chain(
		vendorHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/vendors/{id}", middleware.Chain(
		vendorHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/vendors", middleware.Chain(
		vendorHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/vendors/{id}", middleware.Chain(
		vendorHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/vendors/{id}", middleware.Chain(
		vendorHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/vendors/import", middleware.Chain(
		vendorHandler.ImportCSV,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/vendors/import/template", middleware.Chain(
		vendorHandler.GetImportTemplate,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/vendors/export/csv", middleware.Chain(
		vendorHandler.ExportCSV,
		middleware.Authenticate(db),
	))

	// ==================== PURCHASE ORDERS ====================
	mux.HandleFunc("GET /api/purchase-orders", middleware.Chain(
		purchaseOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-orders/direct", middleware.Chain(
		purchaseOrderHandler.CreateDirect,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/purchase-orders/{poNumber}", middleware.Chain(
		purchaseOrderHandler.GetByPONumber,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-orders", middleware.Chain(
		purchaseOrderHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PUT /api/purchase-orders/{id}", middleware.Chain(
		purchaseOrderHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("PATCH /api/purchase-orders/{id}/status", middleware.Chain(
		purchaseOrderHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("DELETE /api/purchase-orders/{id}", middleware.Chain(
		purchaseOrderHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PURCHASE BILLS ====================
	mux.HandleFunc("GET /api/purchase-bills", middleware.Chain(
		purchaseBillHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-bills/summary", middleware.Chain(
		purchaseBillHandler.GetSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-bills/{id}", middleware.Chain(
		purchaseBillHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-bills", middleware.Chain(
		purchaseBillHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/purchase-bills/from-po", middleware.Chain(
		purchaseBillHandler.CreateFromPO,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/purchase-bills/{id}/payment", middleware.Chain(
		purchaseBillHandler.RecordPayment,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"),
	))
	mux.HandleFunc("DELETE /api/purchase-bills/{id}", middleware.Chain(
		purchaseBillHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== PURCHASE RETURNS ====================
	mux.HandleFunc("GET /api/purchase-returns", middleware.Chain(
		purchaseReturnHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/purchase-returns/{id}", middleware.Chain(
		purchaseReturnHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/purchase-returns", middleware.Chain(
		purchaseReturnHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))

	// ==================== BULK PURCHASES ====================
	mux.HandleFunc("POST /api/bulk-purchases", middleware.Chain(
		bulkPurchaseHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/bulk-purchases/stats", middleware.Chain(
		bulkPurchaseHandler.GetStats,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/bulk-purchases/product", middleware.Chain(
		bulkPurchaseHandler.GetByProduct,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/bulk-purchases", middleware.Chain(
		bulkPurchaseHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("PATCH /api/bulk-purchases/{id}/conversion-status", middleware.Chain(
		bulkPurchaseHandler.UpdateConversionStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("POST /api/bulk-purchases/{id}/convert", middleware.Chain(
		bulkPurchaseHandler.Convert,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "INVENTORY_MANAGER"),
	))
	mux.HandleFunc("GET /api/bulk-purchases/{id}/conversions", middleware.Chain(
		bulkPurchaseHandler.GetConversions,
		middleware.Authenticate(db),
	))

	// ==================== EXPENSES ====================
	mux.HandleFunc("GET /api/expenses/stats", middleware.Chain(
		expenseHandler.GetStats,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/expenses/export/csv", middleware.Chain(
		expenseHandler.ExportCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expenses/generate-recurring", middleware.Chain(
		expenseHandler.GenerateRecurring,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/expenses", middleware.Chain(
		expenseHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expenses", middleware.Chain(
		expenseHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/expenses/{id}", middleware.Chain(
		expenseHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PATCH /api/expenses/{id}/status", middleware.Chain(
		expenseHandler.UpdateStatus,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/expenses/{id}", middleware.Chain(
		expenseHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/expense-categories", middleware.Chain(
		expenseCategoryHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/expense-categories", middleware.Chain(
		expenseCategoryHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/expense-categories/{id}", middleware.Chain(
		expenseCategoryHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/expense-categories/{id}", middleware.Chain(
		expenseCategoryHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== INCENTIVES & LOYALTY ====================
	mux.HandleFunc("GET /api/incentives/rules", middleware.Chain(
		incentiveHandler.GetRules,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/incentives/payouts", middleware.Chain(
		incentiveHandler.GetPayouts,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/incentives/leaderboard", middleware.Chain(
		incentiveHandler.GetLeaderboard,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/incentives/recalculate", middleware.Chain(
		incentiveHandler.Recalculate,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/incentives", middleware.Chain(
		incentiveHandler.CreateRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/incentives/{id}", middleware.Chain(
		incentiveHandler.UpdateRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("DELETE /api/incentives/{id}", middleware.Chain(
		incentiveHandler.DeleteRule,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))

	// ==================== SALES ORDERS ====================
	mux.HandleFunc("GET /api/sales-orders", middleware.Chain(
		salesOrderHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/sales-orders/{id}", middleware.Chain(
		salesOrderHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/sales-orders", middleware.Chain(
		salesOrderHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("PUT /api/sales-orders/{id}", middleware.Chain(
		salesOrderHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))

	// ==================== ACTIVITY LOGS ====================
	mux.HandleFunc("GET /api/activity-logs", middleware.Chain(
		activityLogHandler.GetAll,
		middleware.Authenticate(db),
	))

	// ==================== ROLES (alias for custom-roles) ====================
	mux.HandleFunc("GET /api/roles", middleware.Chain(
		customRoleHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/roles/{id}", middleware.Chain(
		customRoleHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/roles", middleware.Chain(
		customRoleHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/roles/{id}", middleware.Chain(
		customRoleHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/roles/{id}", middleware.Chain(
		customRoleHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))

	// ==================== CUSTOM ROLES ====================
	mux.HandleFunc("GET /api/custom-roles", middleware.Chain(
		customRoleHandler.GetAll,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.GetByID,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("POST /api/custom-roles", middleware.Chain(
		customRoleHandler.Create,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.Update,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("DELETE /api/custom-roles/{id}", middleware.Chain(
		customRoleHandler.Delete,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN"),
	))

	// ==================== INTEGRATION CONFIG ====================
	mux.HandleFunc("GET /api/integrations/channels", middleware.Chain(
		integrationHandler.GetChannels,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/integrations/channels", middleware.Chain(
		integrationHandler.UpdateChannels,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("GET /api/integrations/templates", middleware.Chain(
		integrationHandler.GetTemplates,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("PUT /api/integrations/templates", middleware.Chain(
		integrationHandler.UpdateTemplates,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/integrations/test", middleware.Chain(
		integrationHandler.TestChannel,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN"),
	))
	mux.HandleFunc("POST /api/integrations/send/invoice-email", middleware.Chain(
		integrationHandler.SendInvoiceEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))
	mux.HandleFunc("POST /api/integrations/send/quotation-email", middleware.Chain(
		integrationHandler.SendQuotationEmail,
		middleware.Authenticate(db),
		middleware.RequireRole("SUPER_ADMIN", "ADMIN", "MANAGER"),
	))

	// ==================== REPORTS ====================
	mux.HandleFunc("GET /api/reports/sales-summary", middleware.Chain(
		reportHandler.SalesSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/top-products", middleware.Chain(
		reportHandler.TopProducts,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/payment-methods", middleware.Chain(
		reportHandler.PaymentMethods,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/daily-trend", middleware.Chain(
		reportHandler.DailyTrend,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-category", middleware.Chain(
		reportHandler.SalesByCategory,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-product", middleware.Chain(
		reportHandler.SalesByProduct,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sales-by-customer", middleware.Chain(
		reportHandler.SalesByCustomer,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/sales-csv", middleware.Chain(
		reportHandler.ExportSalesCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-summary", middleware.Chain(
		reportHandler.PurchaseSummary,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-by-supplier", middleware.Chain(
		reportHandler.PurchaseBySupplier,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/outstanding-pos", middleware.Chain(
		reportHandler.OutstandingPOs,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/sale-returns", middleware.Chain(
		reportHandler.SaleReturns,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/purchase-returns", middleware.Chain(
		reportHandler.PurchaseReturns,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/outstanding-receivable", middleware.Chain(
		reportHandler.OutstandingReceivable,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/purchase-csv", middleware.Chain(
		reportHandler.ExportPurchaseCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/payment-method-report", middleware.Chain(
		reportHandler.PaymentMethodReport,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/payment-csv", middleware.Chain(
		reportHandler.ExportPaymentCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/debtors-ledger", middleware.Chain(
		reportHandler.DebtorsLedger,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/creditors-ledger", middleware.Chain(
		reportHandler.CreditorsLedger,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/debtors-csv", middleware.Chain(
		reportHandler.ExportDebtorsCSV,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/export/creditors-csv", middleware.Chain(
		reportHandler.ExportCreditorsCSV,
		middleware.Authenticate(db),
	))
	// Legacy / alternate route names (kept for compatibility)
	mux.HandleFunc("GET /api/reports/sales-by-payment", middleware.Chain(
		reportHandler.PaymentMethods,
		middleware.Authenticate(db),
	))
	mux.HandleFunc("GET /api/reports/daily-sales", middleware.Chain(
		reportHandler.DailyTrend,
		middleware.Authenticate(db),
	))

	// ==================== FILE UPLOADS ====================
	if _, err := os.Stat(cfg.UploadDir); !os.IsNotExist(err) {
		mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))
	}

	// ==================== APPLY MIDDLEWARE ====================
	var handler http.Handler = mux

	// Apply middleware in reverse order (applied bottom-to-top)
	handler = middleware.ActivityLog(db)(handler)
	handler = middleware.Logging()(handler)
	handler = middleware.Security()(handler)
	handler = middleware.CORS(cfg.FrontendUrl)(handler)
	handler = middleware.Recovery()(handler)

	return handler
}

// handleNotImplemented returns a 501 Not Implemented response
func handleNotImplemented(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotImplemented)

	response := map[string]interface{}{
		"success": false,
		"message": "Endpoint not yet implemented",
		"path":    r.URL.Path,
		"method":  r.Method,
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("[Router] Failed to encode response", "error", err)
	}
}
