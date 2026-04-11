# Customer & Purchasing API Endpoints

## File Locations

### Service Files
```
internal/service/customer.go         (CustomerService)
internal/service/vendor.go           (VendorService)
internal/service/purchase_order.go   (PurchaseOrderService)
internal/service/purchase_bill.go    (PurchaseBillService)
internal/service/purchase_return.go  (PurchaseReturnService)
internal/service/bulk_purchase.go    (BulkPurchaseService)
```

### Handler Files
```
internal/handler/customers.go        (CustomerHandler)
internal/handler/vendors.go          (VendorHandler)
internal/handler/purchase_orders.go  (PurchaseOrderHandler)
internal/handler/purchase_bills.go   (PurchaseBillHandler)
internal/handler/purchase_returns.go (PurchaseReturnHandler)
internal/handler/bulk_purchases.go   (BulkPurchaseHandler)
```

### Router Integration
```
internal/router/router.go            (Updated with all routes and middleware)
```

## API Endpoints

### Customers

```
GET    /api/customers                        List customers (paginated)
GET    /api/customers/with-dues              Get customers with outstanding dues
GET    /api/customers/search?q=query         Search customers
GET    /api/customers/phone/{phone}          Get customer by phone
GET    /api/customers/{id}                   Get customer by ID
GET    /api/customers/{id}/loyalty-history   Get loyalty transactions (paginated)
POST   /api/customers                        Create customer
PUT    /api/customers/{id}                   Update customer
POST   /api/customers/import                 Import from CSV (multipart/form-data)
GET    /api/customers/export/csv             Export customers as CSV
GET    /api/customers/export/excel           Export customers as Excel (CSV format)
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `search` - search in name/phone/email
- `segment` - filter by customer segment (REGULAR, SILVER, GOLD, VIP, WHOLESALE)
- `active` - filter by active status (true/false)

### Vendors/Suppliers

```
GET    /api/vendors                          List vendors (paginated)
GET    /api/vendors/{id}                     Get vendor by ID
POST   /api/vendors                          Create vendor
PUT    /api/vendors/{id}                     Update vendor
DELETE /api/vendors/{id}                     Delete vendor (soft delete)
POST   /api/vendors/import                   Import from CSV
GET    /api/vendors/import/template          Download import template
GET    /api/vendors/export/csv               Export vendors as CSV
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `search` - search in name/contactPerson/phone/email
- `active` - filter by active status (default: true)

### Purchase Orders

```
GET    /api/purchase-orders                  List POs (paginated, filtered)
POST   /api/purchase-orders/direct           Create direct purchase (immediate receipt)
GET    /api/purchase-orders/{poNumber}       Get PO by number or ID
POST   /api/purchase-orders                  Create PO (draft)
PUT    /api/purchase-orders/{id}             Update PO
PATCH  /api/purchase-orders/{id}/status     Update PO status
DELETE /api/purchase-orders/{id}             Delete PO (draft only)
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `outletId` - filter by outlet
- `supplierId` - filter by supplier
- `status` - filter by status (DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED)
- `from` - date range start (YYYY-MM-DD)
- `to` - date range end (YYYY-MM-DD)

Request Body (Create):
```json
{
  "supplierId": 1,
  "outletId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 10,
      "unitCost": 100,
      "taxRate": 18
    }
  ],
  "expectedDate": "2026-04-20",
  "notes": "Rush order"
}
```

### Purchase Bills

```
GET    /api/purchase-bills                   List bills (paginated, filtered)
GET    /api/purchase-bills/summary           Get outstanding dues summary
GET    /api/purchase-bills/{id}              Get bill details
POST   /api/purchase-bills                   Create bill
POST   /api/purchase-bills/from-po/{poId}   Create bill from PO
POST   /api/purchase-bills/{id}/payment      Record payment
DELETE /api/purchase-bills/{id}              Delete bill (draft/unpaid only)
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `outletId` - filter by outlet (required for summary)
- `supplierId` - filter by supplier
- `status` - filter by status (DRAFT, UNPAID, PARTIAL, PAID)
- `from` - date range start (YYYY-MM-DD)
- `to` - date range end (YYYY-MM-DD)

Request Body (Create):
```json
{
  "supplierId": 1,
  "outletId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 10,
      "unitCost": 100,
      "taxRate": 18
    }
  ],
  "billDate": "2026-04-15",
  "vendorBillNumber": "VND-001",
  "supplyType": "INTRA_STATE",
  "notes": "Payment terms: Net 30"
}
```

Request Body (Payment):
```json
{
  "amount": 5000,
  "method": "BANK_TRANSFER",
  "reference": "TXN123456"
}
```

### Purchase Returns

```
GET    /api/purchase-returns                 List returns (paginated)
GET    /api/purchase-returns/{id}            Get return details
POST   /api/purchase-returns                 Create return
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `outletId` - filter by outlet (required)
- `from` - date range start (YYYY-MM-DD)
- `to` - date range end (YYYY-MM-DD)

Request Body (Create):
```json
{
  "purchaseOrderId": 1,
  "outletId": 1,
  "items": [
    {
      "productId": 1,
      "returnedQuantity": 5,
      "unitCost": 100
    }
  ],
  "reason": "Damaged goods",
  "creditMethod": "BANK_TRANSFER"
}
```

### Bulk Purchases

```
POST   /api/bulk-purchases                   Record bulk purchase
GET    /api/bulk-purchases/stats             Get statistics
GET    /api/bulk-purchases/product/{productId} Get product purchase history
GET    /api/bulk-purchases                   List bulk purchases (paginated)
PATCH  /api/bulk-purchases/{id}/conversion-status Update conversion status
POST   /api/bulk-purchases/{id}/convert      Convert to sellable items
GET    /api/bulk-purchases/{id}/conversions  Get conversion history
```

Query Parameters:
- `page` (default: 0)
- `size` (default: 20)
- `outletId` - filter by outlet (required)
- `from` - date range start (YYYY-MM-DD)
- `to` - date range end (YYYY-MM-DD)
- `status` - conversion status (NOT_CONVERTED, PARTIALLY_CONVERTED, CONVERTED)

Request Body (Record):
```json
{
  "productId": 1,
  "outletId": 1,
  "purchaseQty": 100,
  "costPerUnit": 50,
  "supplier": "Supplier Name",
  "invoiceNumber": "INV123",
  "purchaseDate": "2026-04-15"
}
```

Request Body (Convert):
```json
{
  "targetProductId": 2,
  "fromBaseQty": 50,
  "saleQty": 500,
  "saleUom": "pcs"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Resource created",
  "data": { ... },
  "timestamp": "2026-04-11T10:30:00Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "content": [...],
    "totalElements": 100,
    "totalPages": 5,
    "size": 20,
    "number": 0
  },
  "timestamp": "2026-04-11T10:30:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2026-04-11T10:30:00Z"
}
```

## Authentication & Authorization

All endpoints require authentication middleware:
- `middleware.Authenticate(db)` - Must be authenticated
- `middleware.OptionalAuth(db)` - Optional authentication

Some endpoints require specific roles:
- `SUPER_ADMIN` - Full access
- `ADMIN` - Administrative access
- `INVENTORY_MANAGER` - Inventory operations
- `ACCOUNTANT` - Financial operations
- `CASHIER` - POS operations

## Status Values

### Customer Segment
- REGULAR
- SILVER
- GOLD
- VIP
- WHOLESALE

### Purchase Order Status
- DRAFT
- SENT
- PARTIAL
- RECEIVED
- CANCELLED

### Purchase Bill Status
- DRAFT
- UNPAID
- PARTIAL
- PAID

### Purchase Return Status
- COMPLETED
- CANCELLED

### Conversion Status
- NOT_CONVERTED
- PARTIALLY_CONVERTED
- CONVERTED

### Supply Type
- INTRA_STATE
- INTER_STATE

## Decimal Precision

All monetary values use decimal arithmetic for precision:
- Cost prices, selling prices
- Tax amounts, GST/CGST/SGST/IGST
- Loyalty points
- Outstanding dues

## Transaction Handling

Operations that modify multiple tables use GORM transactions:
- Direct purchases (PO creation + inventory update)
- Bulk purchase conversions (conversion record + inventory update)
- Purchase returns (return record + inventory deduction)
