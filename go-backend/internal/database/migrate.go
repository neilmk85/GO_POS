package database

import (
	"log/slog"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

// Migrate performs database migrations for all models in proper order
// respecting foreign key dependencies
func Migrate(db *gorm.DB) error {
	slog.Info("[Database] Starting migrations")

	// Phase 1: Base entities with no dependencies
	if err := db.AutoMigrate(&models.Role{}); err != nil {
		slog.Error("[Database] Failed to migrate Role", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Outlet{}); err != nil {
		slog.Error("[Database] Failed to migrate Outlet", "error", err)
		return err
	}

	// Phase 2: User-related and catalog entities
	if err := db.AutoMigrate(&models.User{}); err != nil {
		slog.Error("[Database] Failed to migrate User", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.UserRole{}); err != nil {
		slog.Error("[Database] Failed to migrate UserRole", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Category{}); err != nil {
		slog.Error("[Database] Failed to migrate Category", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.TaxGroup{}); err != nil {
		slog.Error("[Database] Failed to migrate TaxGroup", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ExpenseCategory{}); err != nil {
		slog.Error("[Database] Failed to migrate ExpenseCategory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.CustomRole{}); err != nil {
		slog.Error("[Database] Failed to migrate CustomRole", "error", err)
		return err
	}

	// Phase 3: Product and customer entities
	if err := db.AutoMigrate(&models.Product{}); err != nil {
		slog.Error("[Database] Failed to migrate Product", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductVariant{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductVariant", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.ProductImage{}); err != nil {
		slog.Error("[Database] Failed to migrate ProductImage", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Customer{}); err != nil {
		slog.Error("[Database] Failed to migrate Customer", "error", err)
		return err
	}

	// Phase 4: Inventory and supplier
	if err := db.AutoMigrate(&models.Inventory{}); err != nil {
		slog.Error("[Database] Failed to migrate Inventory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Supplier{}); err != nil {
		slog.Error("[Database] Failed to migrate Supplier", "error", err)
		return err
	}

	// Phase 5: Sales entities (Shift, Order, Payment)
	if err := db.AutoMigrate(&models.Shift{}); err != nil {
		slog.Error("[Database] Failed to migrate Shift", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Order{}); err != nil {
		slog.Error("[Database] Failed to migrate Order", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.OrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate OrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Payment{}); err != nil {
		slog.Error("[Database] Failed to migrate Payment", "error", err)
		return err
	}

	// Phase 6: Invoice and quotation entities
	if err := db.AutoMigrate(&models.Invoice{}); err != nil {
		slog.Error("[Database] Failed to migrate Invoice", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.InvoiceItem{}); err != nil {
		slog.Error("[Database] Failed to migrate InvoiceItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Quotation{}); err != nil {
		slog.Error("[Database] Failed to migrate Quotation", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.QuotationItem{}); err != nil {
		slog.Error("[Database] Failed to migrate QuotationItem", "error", err)
		return err
	}

	// Phase 7: Credit notes, discounts, coupons
	if err := db.AutoMigrate(&models.CreditNote{}); err != nil {
		slog.Error("[Database] Failed to migrate CreditNote", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Discount{}); err != nil {
		slog.Error("[Database] Failed to migrate Discount", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DiscountProduct{}); err != nil {
		slog.Error("[Database] Failed to migrate DiscountProduct", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.DiscountCategory{}); err != nil {
		slog.Error("[Database] Failed to migrate DiscountCategory", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.Coupon{}); err != nil {
		slog.Error("[Database] Failed to migrate Coupon", "error", err)
		return err
	}

	// Phase 8: Stock management
	if err := db.AutoMigrate(&models.StockAdjustment{}); err != nil {
		slog.Error("[Database] Failed to migrate StockAdjustment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.StockTransfer{}); err != nil {
		slog.Error("[Database] Failed to migrate StockTransfer", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.StockTransferItem{}); err != nil {
		slog.Error("[Database] Failed to migrate StockTransferItem", "error", err)
		return err
	}

	// Phase 9: Purchase management
	if err := db.AutoMigrate(&models.PurchaseOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseOrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseOrderItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseBill{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseBill", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseBillItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseBillItem", "error", err)
		return err
	}

	// Phase 10: Purchase returns
	if err := db.AutoMigrate(&models.PurchaseReturn{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseReturn", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PurchaseReturnItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PurchaseReturnItem", "error", err)
		return err
	}

	// Phase 11: Expenses and bulk purchases
	if err := db.AutoMigrate(&models.Expense{}); err != nil {
		slog.Error("[Database] Failed to migrate Expense", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BulkPurchase{}); err != nil {
		slog.Error("[Database] Failed to migrate BulkPurchase", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.BulkPurchaseConversion{}); err != nil {
		slog.Error("[Database] Failed to migrate BulkPurchaseConversion", "error", err)
		return err
	}

	// Phase 12: Incentives and loyalty
	if err := db.AutoMigrate(&models.IncentiveRule{}); err != nil {
		slog.Error("[Database] Failed to migrate IncentiveRule", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.IncentivePayout{}); err != nil {
		slog.Error("[Database] Failed to migrate IncentivePayout", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.LoyaltyTransaction{}); err != nil {
		slog.Error("[Database] Failed to migrate LoyaltyTransaction", "error", err)
		return err
	}

	// Phase 13: Logging and integration
	if err := db.AutoMigrate(&models.ActivityLog{}); err != nil {
		slog.Error("[Database] Failed to migrate ActivityLog", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.IntegrationConfig{}); err != nil {
		slog.Error("[Database] Failed to migrate IntegrationConfig", "error", err)
		return err
	}

	// Phase 14: Pricing
	if err := db.AutoMigrate(&models.PriceList{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceList", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListItem{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListItem", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListSegment{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListSegment", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.PriceListCustomer{}); err != nil {
		slog.Error("[Database] Failed to migrate PriceListCustomer", "error", err)
		return err
	}

	// Phase 15: Sales orders
	if err := db.AutoMigrate(&models.SalesOrder{}); err != nil {
		slog.Error("[Database] Failed to migrate SalesOrder", "error", err)
		return err
	}
	if err := db.AutoMigrate(&models.SalesOrderItem{}); err != nil {
		slog.Error("[Database] Failed to migrate SalesOrderItem", "error", err)
		return err
	}

	slog.Info("[Database] Migrations completed successfully")
	return nil
}
