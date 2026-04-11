# POS Backend Migration Plan: Node.js/TypeScript to Go 1.26

## Overview

Migrate the existing Express.js + Prisma + PostgreSQL backend (~7,500 lines of TypeScript across 57 files, 100+ API endpoints) to a Go 1.26 server using GORM + MySQL. The web and Flutter mobile clients remain unchanged -- only the backend is replaced. The new Go server must be **API-compatible** so the existing frontend and mobile app continue to work without modification.

---

## Guiding Principles

1. **Minimal external dependencies** -- use Go's standard library (`net/http`, `encoding/json`, `crypto`, `log/slog`, `database/sql`, etc.) wherever possible
2. **GORM** as the only major ORM dependency (with the MySQL driver)
3. **MySQL 8** as the new database (fresh schema, no data migration)
4. **API contract preservation** -- every endpoint path, HTTP method, request body shape, and response body shape must remain identical so the web and mobile clients work unmodified
5. **Same environment variable names** where sensible (with DB_DSN replacing DATABASE_URL)

---

## Go 1.26 Features That Benefit This Migration

Go 1.26 (released February 2026) includes several features that directly benefit a POS backend:

1. **Green Tea Garbage Collector (default)** -- Previously experimental in 1.25, now enabled by default. Scans memory in contiguous 8 KiB spans instead of individual objects. POS systems allocate many short-lived objects (cart items, payment calculations, report rows) -- expect 10-40% reduction in GC overhead compared to the old collector.

2. **`encoding/json/v2` (graduated to stable)** -- The new JSON package was experimental in Go 1.25 and is now stable in 1.26. It is dramatically faster for unmarshaling (the dominant direction for a backend -- parsing request bodies) and fixes long-standing quirks around case sensitivity, null handling, and struct tag behavior. We use `encoding/json/v2` as the default for all request/response serialization.

3. **Enhanced `new()` with expressions** -- `new(expr)` lets you create a pointer to a value in one expression. Eliminates the common boilerplate of declaring a variable just to take its address for optional pointer fields (which we have many of in our DTOs -- nullable prices, dates, descriptions, etc.).

4. **Self-referential generics** -- Generic types can now reference themselves in their own type parameter list. Useful for building type-safe repository patterns and tree structures (our hierarchical `Category` model with `parent_id`).

5. **`log/slog` NewMultiHandler** -- Can now fan out logs to multiple handlers (e.g., JSON to stdout for production, text to file for debugging) without a third-party library.

6. **`net/http` automatic response compression** -- The stdlib HTTP server now supports automatic gzip/zstd compression for response bodies, reducing bandwidth without manual middleware. Especially valuable for our large report/export JSON payloads.

7. **`go fix` modernizers** -- The rewritten `go fix` command includes dozens of modernizers that automatically update code to use latest idioms and stdlib APIs. Run this as a final polish pass.

---

## Technology Mapping

| Current (Node.js)         | Go 1.26 Replacement                                    |
|---------------------------|--------------------------------------------------------|
| Express.js                | `net/http` + stdlib `http.ServeMux` (enhanced routing since Go 1.22, auto-compression in 1.26) |
| Prisma ORM                | GORM v2 (`gorm.io/gorm` + `gorm.io/driver/mysql`)    |
| PostgreSQL 16             | MySQL 8                                                |
| bcryptjs                  | `golang.org/x/crypto/bcrypt`                           |
| jsonwebtoken              | `golang-jwt/jwt/v5`                                   |
| express JSON parser       | `encoding/json/v2` (stable in Go 1.26, faster unmarshaling) |
| multer (file upload)      | `net/http` multipart parsing (stdlib)                  |
| dotenv                    | `os.Getenv` + `.env` loader (small helper or `godotenv`) |
| cors                      | Custom middleware (~20 lines)                          |
| helmet                    | Custom middleware (security headers, ~15 lines)        |
| morgan (logging)          | `log/slog` with `NewMultiHandler` (Go 1.26)           |
| winston                   | `log/slog`                                             |
| socket.io                 | `nhooyr.io/websocket` -- the one area that genuinely needs a dependency |
| node-cron                 | `time.Ticker` / custom cron scheduler (stdlib)         |
| nodemailer                | `net/smtp` (stdlib)                                    |
| csv-parse                 | `encoding/csv` (stdlib)                                |
| express-async-errors      | Not needed (Go doesn't have unhandled promise rejections) |
| Redis                     | Defer -- evaluate if needed; can use in-process cache initially |

### Final External Go Dependencies (target `go.mod`)

```
go 1.26

require (
    gorm.io/gorm              v1.26.x
    gorm.io/driver/mysql       v1.5.x
    golang.org/x/crypto        latest    // for bcrypt only
    github.com/golang-jwt/jwt/v5  v5.x.x
    nhooyr.io/websocket        v1.8.x    // for Socket.io replacement
)
```

That is **5 external modules** (including transitive GORM deps). Everything else comes from the Go standard library.

---

## Project Structure

```
go-backend/
├── cmd/
│   └── server/
│       └── main.go                 # Entry point, server startup, seed
├── internal/
│   ├── config/
│   │   └── config.go               # Env loading, app config struct
│   ├── database/
│   │   ├── mysql.go                 # GORM connection setup
│   │   ├── seed.go                  # DB seeder (roles, tax groups, admin user, etc.)
│   │   └── migrate.go              # AutoMigrate call
│   ├── models/                      # GORM model structs (one file per domain)
│   │   ├── user.go
│   │   ├── role.go
│   │   ├── outlet.go
│   │   ├── product.go
│   │   ├── product_variant.go
│   │   ├── product_image.go
│   │   ├── category.go
│   │   ├── tax_group.go
│   │   ├── inventory.go
│   │   ├── stock_adjustment.go
│   │   ├── stock_transfer.go
│   │   ├── order.go
│   │   ├── order_item.go
│   │   ├── payment.go
│   │   ├── invoice.go
│   │   ├── invoice_item.go
│   │   ├── customer.go
│   │   ├── loyalty_transaction.go
│   │   ├── discount.go
│   │   ├── coupon.go
│   │   ├── credit_note.go
│   │   ├── shift.go
│   │   ├── expense.go
│   │   ├── expense_category.go
│   │   ├── vendor.go
│   │   ├── purchase_order.go
│   │   ├── purchase_bill.go
│   │   ├── purchase_return.go
│   │   ├── quotation.go
│   │   ├── sales_order.go
│   │   ├── bulk_purchase.go
│   │   ├── incentive.go
│   │   ├── integration_config.go
│   │   ├── price_list.go
│   │   ├── activity_log.go
│   │   └── enums.go                # All enum type definitions
│   ├── middleware/
│   │   ├── auth.go                  # JWT verify, role check
│   │   ├── cors.go                  # CORS headers
│   │   ├── security.go              # Helmet-equivalent headers
│   │   ├── logging.go               # Request logging via slog
│   │   ├── recovery.go              # Panic recovery
│   │   └── activity_log.go          # Audit trail middleware
│   ├── handler/                     # HTTP handlers (one file per route group)
│   │   ├── auth.go
│   │   ├── users.go
│   │   ├── outlets.go
│   │   ├── products.go
│   │   ├── categories.go
│   │   ├── tax_groups.go
│   │   ├── inventory.go
│   │   ├── customers.go
│   │   ├── orders.go
│   │   ├── invoices.go
│   │   ├── quotations.go
│   │   ├── discounts.go
│   │   ├── expenses.go
│   │   ├── expense_categories.go
│   │   ├── vendors.go
│   │   ├── purchase_orders.go
│   │   ├── purchase_bills.go
│   │   ├── purchase_returns.go
│   │   ├── reports.go
│   │   ├── gst.go
│   │   ├── integrations.go
│   │   ├── shifts.go
│   │   ├── credit_notes.go
│   │   ├── incentives.go
│   │   ├── bulk_purchases.go
│   │   ├── price_lists.go
│   │   ├── sales_orders.go
│   │   ├── activity_logs.go
│   │   ├── staff.go
│   │   ├── custom_roles.go
│   │   └── health.go
│   ├── service/                     # Business logic layer (one file per domain)
│   │   ├── auth.go
│   │   ├── user.go
│   │   ├── product.go
│   │   ├── category.go
│   │   ├── inventory.go
│   │   ├── customer.go
│   │   ├── order.go
│   │   ├── invoice.go
│   │   ├── quotation.go
│   │   ├── discount.go
│   │   ├── expense.go
│   │   ├── vendor.go
│   │   ├── purchase_order.go
│   │   ├── purchase_bill.go
│   │   ├── purchase_return.go
│   │   ├── report.go
│   │   ├── gst.go
│   │   ├── integration.go
│   │   ├── shift.go
│   │   ├── credit_note.go
│   │   ├── incentive.go
│   │   ├── bulk_purchase.go
│   │   ├── price_list.go
│   │   ├── sales_order.go
│   │   └── scheduler.go            # Background cron jobs
│   ├── dto/                         # Request/response structs
│   │   ├── auth.go
│   │   ├── user.go
│   │   ├── product.go
│   │   ├── order.go
│   │   ├── invoice.go
│   │   ├── pagination.go           # Paginated response wrapper
│   │   └── ...                     # One per domain as needed
│   ├── router/
│   │   └── router.go               # Central route registration
│   ├── websocket/
│   │   └── hub.go                   # WebSocket hub (outlet rooms, broadcast)
│   └── util/
│       ├── jwt.go                   # Sign, verify, refresh tokens
│       ├── bcrypt.go                # Hash, compare passwords
│       ├── response.go              # Standard JSON response helpers
│       ├── number_generator.go      # Order/invoice number generation
│       ├── csv.go                   # CSV parse/export helpers
│       ├── email.go                 # SMTP email sender
│       └── validators.go           # Common validation functions
├── uploads/                         # Static file uploads directory
├── .env.example
├── go.mod
├── go.sum
├── Dockerfile
└── docker-compose.yml
```

---

## Phase-by-Phase Execution Plan

### Phase 0: Project Bootstrap (Day 1)

**Goal:** Scaffolded Go project that compiles and connects to MySQL.

| Step | Task | Details |
|------|------|---------|
| 0.1 | `go mod init github.com/nilesh/pos-backend` | Initialize Go module |
| 0.2 | Create directory structure | All directories from the tree above |
| 0.3 | `internal/config/config.go` | Load env vars: `DB_DSN`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `UPLOAD_DIR`, `MAX_FILE_SIZE` |
| 0.4 | `internal/database/mysql.go` | GORM connection with `gorm.io/driver/mysql`, connection pool settings, `slog` logger |
| 0.5 | `cmd/server/main.go` | Minimal server startup: load config, connect DB, register health check, `http.ListenAndServe` |
| 0.6 | Docker Compose | MySQL 8 container + Go app container |
| 0.7 | Verify | `GET /health` returns `{"status":"UP","timestamp":"..."}` |

---

### Phase 1: Models & Database Schema (Days 2-4)

**Goal:** All GORM models defined, `AutoMigrate` creates the full MySQL schema.

Port the entire Prisma schema (1,398 lines) into Go structs with GORM tags. Key considerations:

**PostgreSQL to MySQL type mapping:**

| Prisma/PostgreSQL         | Go / GORM MySQL                     |
|---------------------------|--------------------------------------|
| `String`                  | `string` (`varchar(255)`)            |
| `String @db.Text`         | `string` with `gorm:"type:text"`     |
| `Int`                     | `int64`                              |
| `Float` / `Decimal(10,2)` | `float64` with `gorm:"type:decimal(10,2)"` |
| `Boolean`                 | `bool`                               |
| `DateTime`                | `time.Time`                          |
| `DateTime?`               | `*time.Time`                         |
| `Json`                    | `datatypes.JSON` (GORM) or `string` with `gorm:"type:json"` |
| `Enum`                    | `string` with validation constants   |
| `@id @default(autoincrement())` | `gorm:"primaryKey;autoIncrement"` |
| `@unique`                 | `gorm:"uniqueIndex"`                |
| `@relation`               | GORM `belongs_to` / `has_many` tags  |

**Enum strategy:** Define Go `string` constants (not `iota` -- keeps MySQL values human-readable and matches the existing API contract):

```go
// internal/models/enums.go
type OrderStatus string
const (
    OrderStatusPending           OrderStatus = "PENDING"
    OrderStatusConfirmed         OrderStatus = "CONFIRMED"
    OrderStatusCompleted         OrderStatus = "COMPLETED"
    OrderStatusCancelled         OrderStatus = "CANCELLED"
    OrderStatusRefunded          OrderStatus = "REFUNDED"
    OrderStatusPartiallyRefunded OrderStatus = "PARTIALLY_REFUNDED"
    OrderStatusHeld              OrderStatus = "HELD"
)

type PaymentMethod string
const (
    PaymentCash        PaymentMethod = "CASH"
    PaymentCard        PaymentMethod = "CARD"
    PaymentUPI         PaymentMethod = "UPI"
    // ... etc
)
```

**Model example (showing the pattern):**

```go
// internal/models/product.go
type Product struct {
    ID              uint            `gorm:"primaryKey;autoIncrement" json:"id"`
    Name            string          `gorm:"size:255;not null" json:"name"`
    SKU             string          `gorm:"size:100;uniqueIndex" json:"sku"`
    Barcode         *string         `gorm:"size:100;uniqueIndex" json:"barcode"`
    Description     *string         `gorm:"type:text" json:"description"`
    Price           float64         `gorm:"type:decimal(10,2);not null;default:0" json:"price"`
    CostPrice       float64         `gorm:"type:decimal(10,2);not null;default:0" json:"costPrice"`
    MRP             *float64        `gorm:"type:decimal(10,2)" json:"mrp"`
    HSNCode         *string         `gorm:"size:20" json:"hsnCode"`
    UnitOfMeasure   string          `gorm:"size:20;default:'PCS'" json:"unitOfMeasure"`
    ProductType     string          `gorm:"size:20;default:'PHYSICAL'" json:"productType"`
    Active          bool            `gorm:"default:true" json:"active"`
    TaxGroupID      *uint           `json:"taxGroupId"`
    OutletID        uint            `gorm:"not null" json:"outletId"`
    CreatedAt       time.Time       `json:"createdAt"`
    UpdatedAt       time.Time       `json:"updatedAt"`

    // Relations
    TaxGroup        *TaxGroup       `gorm:"foreignKey:TaxGroupID" json:"taxGroup,omitempty"`
    Outlet          Outlet          `gorm:"foreignKey:OutletID" json:"-"`
    Variants        []ProductVariant `gorm:"foreignKey:ProductID" json:"variants,omitempty"`
    Images          []ProductImage  `gorm:"foreignKey:ProductID" json:"images,omitempty"`
    Inventory       []Inventory     `gorm:"foreignKey:ProductID" json:"inventory,omitempty"`
}
```

**Full model list (34 models to port):** roles, users, user_roles, outlets, products, product_variants, product_images, categories, tax_groups, inventory, stock_adjustments, stock_transfers, stock_transfer_items, orders, order_items, payments, invoices, invoice_items, customers, loyalty_transactions, discounts, discount_products, discount_categories, coupons, credit_notes, shifts, expenses, expense_categories, vendors, purchase_orders, purchase_order_items, purchase_bills, purchase_bill_items, purchase_returns, quotations, quotation_items, sales_orders, sales_order_items, bulk_purchases, bulk_purchase_conversions, incentive_rules, incentive_payouts, integration_configs, price_lists, price_list_items, activity_logs

**Indexes to create explicitly** (matching the Prisma schema's `@@index` directives):
- `orders(outlet_id, created_at)`
- `orders(customer_id)`
- `order_items(order_id)`
- `payments(order_id)`
- `inventory(product_id, outlet_id)` -- unique composite
- `activity_logs(module, outlet_id, created_at)`
- `customers(phone)`, `customers(email)`
- `products(sku)`, `products(barcode)`

**Seeder (`internal/database/seed.go`):** Port the `seedDatabase()` function from `index.ts` -- create default roles, tax groups, default outlet, super admin user, and expense categories.

---

### Phase 2: Core Infrastructure (Days 5-7)

**Goal:** Middleware stack, JWT auth, routing framework, standard response format.

#### 2.1 Middleware Stack

**CORS middleware** (replaces `cors` npm package):
```go
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
            w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
            w.Header().Set("Access-Control-Allow-Credentials", "true")
            if r.Method == http.MethodOptions {
                w.WriteHeader(http.StatusNoContent)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

**Security headers** (replaces `helmet`): Set `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Cross-Origin-Resource-Policy`, etc.

**Request logging** (replaces `morgan`): Use `slog` to log method, path, status, duration for every request.

**Panic recovery**: Catch panics, log stack trace, return 500.

**Auth middleware**:
- `Authenticate`: Extract `Authorization: Bearer <token>`, verify JWT, inject user claims into `context.Context`
- `RequireRole(roles ...string)`: Check user roles from context against allowed roles
- `OptionalAuth`: Like Authenticate but doesn't reject unauthenticated requests

**Activity log middleware**: For POST/PUT/PATCH/DELETE, log to the `activity_logs` table (port `activityLogMiddleware` from `activityLog.ts`).

#### 2.2 Response Helpers

Port the standard response format so clients see identical JSON:

```go
// internal/util/response.go
type APIResponse struct {
    Success bool        `json:"success"`
    Message string      `json:"message,omitempty"`
    Data    interface{} `json:"data,omitempty"`
    Errors  interface{} `json:"errors,omitempty"`
}

type PaginatedResponse struct {
    Content       interface{} `json:"content"`
    TotalElements int64       `json:"totalElements"`
    TotalPages    int         `json:"totalPages"`
    Size          int         `json:"size"`
    Number        int         `json:"number"`
}
```

#### 2.3 Utilities

- **JWT** (`internal/util/jwt.go`): Sign access + refresh tokens using `golang-jwt/jwt/v5`. Claims: `userId`, `name`, `email`, `roles[]`, `outletId`
- **Bcrypt** (`internal/util/bcrypt.go`): `HashPassword`, `ComparePassword` using `golang.org/x/crypto/bcrypt`
- **Number generator** (`internal/util/number_generator.go`): Order numbers (`ORD-YYYYMMDD-XXXX`), invoice numbers, PO numbers, etc.

#### 2.4 Router Setup

Use Go 1.22+ enhanced `http.ServeMux` which supports method-based routing:

```go
// internal/router/router.go
func Setup(db *gorm.DB, cfg *config.Config) http.Handler {
    mux := http.NewServeMux()

    // Dependency injection
    authSvc := service.NewAuthService(db)
    authHandler := handler.NewAuthHandler(authSvc)

    // Auth routes
    mux.HandleFunc("POST /api/auth/login", authHandler.Login)
    mux.HandleFunc("POST /api/auth/register", auth(requireRole("SUPER_ADMIN","ADMIN"), authHandler.Register))
    mux.HandleFunc("POST /api/auth/refresh", authHandler.Refresh)

    // ... all other routes follow this pattern
    
    // Static files
    mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))

    // Health
    mux.HandleFunc("GET /health", handler.Health)
    mux.HandleFunc("GET /api/health", handler.Health)

    // Wrap with middleware chain
    var h http.Handler = mux
    h = middleware.ActivityLog(db)(h)
    h = middleware.Logging()(h)
    h = middleware.Security()(h)
    h = middleware.CORS(cfg.FrontendURL)(h)
    h = middleware.Recovery()(h)
    return h
}
```

---

### Phase 3: Auth & User Management (Days 8-9)

**Goal:** Login, register, token refresh, user CRUD, profile endpoints.

| Endpoint | Handler |
|----------|---------|
| `POST /api/auth/login` | Validate email+password, return access+refresh tokens + user object |
| `POST /api/auth/register` | Admin-only user creation with role assignment |
| `POST /api/auth/refresh` | Validate refresh token, issue new pair |
| `GET /api/users` | List users (admin) |
| `GET /api/users/:id` | Get user by ID |
| `GET /api/users/outlet/:outletId` | Users by outlet |
| `POST /api/users` | Create user |
| `PUT /api/users/:id` | Update user |
| `PUT /api/users/:id/toggle-active` | Enable/disable |
| `PUT /api/users/:id/reset-password` | Reset password |
| `GET /api/users/me` | Current user profile |
| `PUT /api/users/me` | Update own profile |

**Key:** The response shapes must exactly match what the React/Flutter apps expect (field names, nesting, types).

---

### Phase 4: Catalog & Inventory (Days 10-14)

**Goal:** Products, categories, tax groups, variants, images, inventory, transfers.

#### 4.1 Products (~20 endpoints)
- CRUD with pagination, search, barcode lookup
- CSV import/export using `encoding/csv` (stdlib)
- Excel export using a lightweight approach (CSV with `.xlsx` extension, or a small library if needed)
- Barcode generation (port `numberGenerator.ts` logic)
- File upload for product images using `r.ParseMultipartForm()` (stdlib)

#### 4.2 Product Variants (4 endpoints)
- CRUD nested under products

#### 4.3 Product Images (4 endpoints)
- Upload (multipart), delete, set primary
- Store files in `uploads/` directory, serve via static file handler

#### 4.4 Categories (7 endpoints)
- Hierarchical categories with `parent_id`
- Root categories, children, toggle active

#### 4.5 Tax Groups (5 endpoints)
- GST rate configuration CRUD

#### 4.6 Inventory (12 endpoints)
- Stock levels by product/outlet
- Stock adjustments (damage, theft, expiry, audit, correction)
- Inter-outlet transfers with approval workflow (REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED)
- Low stock alerts

---

### Phase 5: Sales & POS (Days 15-19)

**Goal:** Orders, payments, invoices, quotations, credit notes, shifts, discounts, price lists, coupons.

#### 5.1 Orders (6 endpoints)
- **Checkout** (the most complex endpoint): Cart validation, discount application, tax calculation, payment processing, inventory deduction, loyalty points, invoice generation -- all in a single DB transaction
- Returns/exchanges with inventory restoration
- Order hold functionality
- Order listing with filtering

#### 5.2 Payments
- Multi-method payment splitting (Cash + Card + UPI etc.)
- Credit sale tracking
- Advance payment recording

#### 5.3 Invoices (8 endpoints)
- Invoice generation from orders
- Status management (DRAFT -> SENT -> PAID/PARTIAL/OVERDUE)
- Payment recording against invoices
- Email sending via `net/smtp`
- Public invoice view (no auth required)

#### 5.4 Quotations (4 endpoints)
- CRUD with status management
- Conversion to sales order

#### 5.5 Credit Notes (5 endpoints)
- Creation from returns
- Usage tracking, expiry management
- Active credit notes by customer

#### 5.6 Shifts (4 endpoints)
- Open/close with cash counting
- Cash variance calculation
- Shift history by outlet/cashier

#### 5.7 Discounts & Coupons (11 endpoints)
- Discount rules (manual, automatic, promotional, festival, loyalty)
- Product-level and category-level discounts
- Coupon validation with usage limits and date ranges
- Discount preview on items

#### 5.8 Price Lists (7 endpoints)
- Custom pricing by customer segment
- Price resolution logic (customer-specific -> segment -> default)

---

### Phase 6: Customers (Days 20-21)

**Goal:** Customer management, loyalty, segmentation.

- CRUD with phone/email search
- Segmentation (REGULAR/SILVER/GOLD/VIP/WHOLESALE)
- Loyalty points history
- Outstanding dues tracking
- CSV import/export
- Customer search with autocomplete

---

### Phase 7: Purchasing (Days 22-25)

**Goal:** Vendors, purchase orders, bills, returns, bulk purchases.

#### 7.1 Vendors (8 endpoints)
- Vendor master CRUD
- CSV import/export

#### 7.2 Purchase Orders (7 endpoints)
- PO creation with line items
- Status workflow (DRAFT -> SENT -> PARTIAL -> RECEIVED -> CANCELLED)
- Direct purchase shortcut

#### 7.3 Purchase Bills (7 endpoints)
- Bill from PO conversion
- Payment recording with payment terms
- Bill summary/aging

#### 7.4 Purchase Returns (2 endpoints)
- Return to vendor processing
- Inventory and credit adjustment

#### 7.5 Bulk Purchases (7 endpoints)
- Bulk stock purchases
- Conversion to sellable units
- Conversion tracking

---

### Phase 8: Financials & Reports (Days 26-30)

**Goal:** Expenses, reports, GST compliance, incentives.

#### 8.1 Expenses (8 endpoints + 5 category endpoints)
- Expense tracking with approval workflow
- Recurring expense generation (via scheduler)
- Category management
- CSV export

#### 8.2 Reports (20+ endpoints)
- Sales: summary, top products, payment methods, daily trend, by category/product/customer
- Purchases: summary, by supplier, outstanding POs
- Returns: sale returns, purchase returns
- Receivables/payables: outstanding receivable, debtors ledger, creditors ledger
- CSV export for all report types

**Implementation note:** These are read-heavy endpoints with complex SQL aggregations. Use GORM's raw SQL capability (`db.Raw(...)`) for the aggregate queries rather than trying to express them through GORM's query builder -- this is more maintainable and performant.

#### 8.3 GST Reports (9 endpoints)
- GSTR-1 (outward supplies)
- GSTR-3B (monthly return)
- HSN summary (sales + purchases)
- Tally export format
- CSV export for all

#### 8.4 Incentives (7 endpoints)
- Incentive rule CRUD (commission, target bonus, per-transaction, tiered)
- Monthly payout calculation
- Leaderboard generation
- Recalculation trigger

---

### Phase 9: Integrations & Communication (Days 31-32)

**Goal:** Email, SMS, WhatsApp config and sending.

#### 9.1 Integration Config (7 endpoints)
- Channel configuration (SMTP, MSG91, WhatsApp)
- Template management
- Connectivity testing

#### 9.2 Email Sending
- Invoice email via `net/smtp` (stdlib)
- Quotation email
- Template rendering using `text/template` or `html/template` (stdlib)

#### 9.3 SMS / WhatsApp
- HTTP calls to MSG91 / WhatsApp Business API using `net/http` client (stdlib)

---

### Phase 10: WebSocket & Real-time (Days 33-34)

**Goal:** Replace Socket.io with native Go WebSocket.

Architecture:
```
internal/websocket/hub.go
├── Hub struct        -- manages connections + outlet rooms
├── Client struct     -- single WS connection
├── Register/Unregister channels
├── BroadcastToOutlet(outletId, event, data)
└── JWT auth on connection upgrade
```

**Event compatibility:** The Flutter and React clients use Socket.io client libraries. Two options:

- **Option A (recommended):** Switch clients to use a simple WebSocket client instead of Socket.io. This is a small client-side change (Socket.io's `socket.emit`/`socket.on` replaced with `ws.send`/`ws.onmessage` with a JSON envelope).
- **Option B:** Use a Go Socket.io server library (e.g., `googollee/go-socket.io`) -- but this adds a dependency.

**Recommendation:** Go with Option A. The WebSocket usage in this app is minimal (outlet room join + broadcast notifications). A JSON message envelope `{"event":"inventory-update","data":{...}}` works fine.

---

### Phase 11: Background Jobs (Day 35)

**Goal:** Replace `node-cron` scheduler with Go goroutine-based scheduler.

```go
// internal/service/scheduler.go
func StartScheduler(db *gorm.DB) {
    // Recurring expense generation -- daily at midnight
    go runEvery(24*time.Hour, func() { generateRecurringExpenses(db) })

    // Loyalty point expiry check -- daily
    go runEvery(24*time.Hour, func() { checkLoyaltyExpiry(db) })

    // Overdue invoice marking -- hourly
    go runEvery(1*time.Hour, func() { markOverdueInvoices(db) })
}

func runEvery(d time.Duration, fn func()) {
    ticker := time.NewTicker(d)
    for range ticker.C {
        fn()
    }
}
```

For cron-like scheduling (specific times), implement a small time-of-day check or use `time.AfterFunc` with daily resets. No external dependency needed.

---

### Phase 12: Remaining Endpoints (Days 36-37)

- **Staff** routes (alias for users with outlet filtering)
- **Custom Roles** CRUD
- **Sales Orders** (4 endpoints)
- **Activity Logs** (1 endpoint with filtering)
- **Outlet** management (3 endpoints)

---

### Phase 13: Testing & Validation (Days 38-42)

#### 13.1 API Compatibility Testing
- Run the existing React web app against the new Go backend
- Run the Flutter mobile app against the new Go backend
- Compare every response shape field-by-field
- Test all CRUD flows end-to-end

#### 13.2 Specific Areas to Validate

| Area | What to Test |
|------|-------------|
| Auth | Login, token refresh, role-based access denial |
| POS Checkout | Full checkout with discounts, coupons, multiple payments, loyalty |
| Returns | Return flow with credit note generation, inventory restoration |
| Inventory | Adjustments, transfers (full workflow), low stock |
| Reports | All aggregate queries return correct numbers |
| GST | GSTR-1, GSTR-3B calculations match |
| File upload | Product images, CSV imports |
| WebSocket | Real-time updates reach connected clients |
| Pagination | Page/size params, response format consistency |
| Error responses | 400/401/403/404/500 shapes match Node.js versions |

#### 13.3 Load Testing
- Compare throughput: Node.js vs Go for key endpoints (checkout, product listing, reports)
- Go should significantly outperform on CPU-bound report generation

---

### Phase 14: Deployment & Cutover (Days 43-45)

1. Update `docker-compose.yml`: Replace Node.js service with Go binary, replace PostgreSQL with MySQL 8
2. Update environment variables (`DB_DSN` format for MySQL)
3. Run Go server with `AutoMigrate` to create fresh MySQL schema
4. Run seeder to populate defaults
5. Verify health check
6. Point web/mobile to new backend (same port 8080, same `/api` prefix -- should be seamless)
7. Monitor logs for any 500s or unexpected behavior

---

## Critical Implementation Details

### 1. Decimal Handling
MySQL `DECIMAL(10,2)` maps to Go `float64`. For financial calculations in the checkout and report services, use careful rounding:
```go
func round2(f float64) float64 {
    return math.Round(f*100) / 100
}
```
Alternatively, consider using `shopspring/decimal` if precision is critical (adds one dependency).

### 2. Transaction Management
Port all Prisma `$transaction()` calls to GORM transactions:
```go
err := db.Transaction(func(tx *gorm.DB) error {
    // all DB operations use tx instead of db
    return nil
})
```
Checkout, returns, and stock transfers **must** use transactions.

### 3. JSON Field Names
The existing API uses **camelCase** JSON (`createdAt`, `outletId`, `taxGroupId`). GORM defaults to snake_case for DB columns. Use explicit `json:"camelCase"` tags on every struct field and `gorm:"column:snake_case"` where the DB column name differs.

### 4. Nullable Fields
Prisma `String?` becomes Go `*string`. Nullable relations use pointer types. GORM handles this correctly with MySQL `NULL`.

### 5. Soft Deletes
If the Prisma schema uses `active` boolean fields (which it does for products, categories, users, etc.), continue this pattern rather than GORM's built-in `DeletedAt` soft delete. Keep the API behavior identical.

### 6. Date Filtering
Many endpoints accept `from` and `to` query parameters for date ranges. Parse these consistently:
```go
func parseDate(s string) (time.Time, error) {
    return time.Parse("2006-01-02", s)
}
```

### 7. CSV Import/Export
Use `encoding/csv` (stdlib) for all CSV operations. The existing import endpoints accept multipart file uploads with CSV data.

### 8. Error Handling Pattern
Port the custom exception classes to Go error types:
```go
type AppError struct {
    Code    int
    Message string
    Errors  map[string]string // validation errors
}
func (e *AppError) Error() string { return e.Message }

var (
    ErrNotFound       = &AppError{Code: 404, Message: "Resource not found"}
    ErrUnauthorized   = &AppError{Code: 401, Message: "Authentication required"}
    ErrForbidden      = &AppError{Code: 403, Message: "Insufficient permissions"}
)
```

---

## Estimated Timeline

| Phase | Days | Cumulative |
|-------|------|------------|
| 0 - Bootstrap | 1 | 1 |
| 1 - Models & Schema | 3 | 4 |
| 2 - Infrastructure | 3 | 7 |
| 3 - Auth & Users | 2 | 9 |
| 4 - Catalog & Inventory | 5 | 14 |
| 5 - Sales & POS | 5 | 19 |
| 6 - Customers | 2 | 21 |
| 7 - Purchasing | 4 | 25 |
| 8 - Financials & Reports | 5 | 30 |
| 9 - Integrations | 2 | 32 |
| 10 - WebSocket | 2 | 34 |
| 11 - Background Jobs | 1 | 35 |
| 12 - Remaining Endpoints | 2 | 37 |
| 13 - Testing | 5 | 42 |
| 14 - Deployment | 3 | 45 |
| **Total** | **~45 working days** | |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| API response shape mismatch breaks clients | High | Write integration tests comparing Go responses against Node.js responses for each endpoint before cutover |
| Complex checkout logic has edge cases | High | Port the order service line-by-line; test with the same scenarios used in production |
| Report SQL doesn't translate 1:1 from PostgreSQL to MySQL | Medium | Some PostgreSQL functions (e.g., `DATE_TRUNC`, `INTERVAL`) need MySQL equivalents (`DATE_FORMAT`, `DATE_ADD`). Audit every raw query. |
| WebSocket client compatibility | Medium | If using native WS instead of Socket.io, need small client-side changes (minimal) |
| Decimal precision drift in financial calculations | Medium | Use `DECIMAL(10,2)` in MySQL and round consistently in Go; consider `shopspring/decimal` |
| GORM N+1 queries in list endpoints | Low | Use `Preload()` and `Joins()` explicitly; monitor query logs during testing |
| File upload path differences | Low | Keep same `uploads/` directory structure and URL pattern |

---

## Files That Do NOT Need Migration

- `web/` -- React frontend stays as-is (only consumes the API)
- `mobile/` -- Flutter app stays as-is (only consumes the API)
- `backend/prisma/` -- Prisma schema is reference material only; GORM replaces it
- Any PostgreSQL-specific migration files
