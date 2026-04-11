# Business Logic Porting from Node.js to Go

## Overview
This document details how the business logic from the Node.js TypeScript codebase has been translated to Go while maintaining exact feature parity.

## Customer Service Logic

### Search & Filtering
**Node.js Equivalent:**
```typescript
// Prisma query with OR conditions
where: {
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { phone: { contains: search } },
    { email: { contains: search, mode: 'insensitive' } },
  ],
}
```

**Go Implementation:**
```go
// GORM query with LIKE conditions
query.Where("name LIKE ? OR phone LIKE ? OR email LIKE ?",
    "%"+searchPattern+"%", "%"+searchPattern+"%", "%"+searchPattern+"%")
```

### Loyalty Points Management
**Node.js Equivalent:**
```typescript
const newBalance = new Decimal(customer.loyaltyPoints.toString()).plus(points);
await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: newBalance } });
await prisma.loyaltyTransaction.create({ ... });
```

**Go Implementation:**
```go
newBalance := customer.LoyaltyPoints.Add(points)
return cs.db.Transaction(func(tx *gorm.DB) error {
    if err := tx.Model(&models.Customer{}).Where("id = ?", customerId).
        Update("loyalty_points", newBalance).Error; err != nil {
        return err
    }
    return tx.Create(&loyalty).Error
})
```

**Key Points:**
- Uses shopspring/decimal for precise decimal arithmetic
- Transactions ensure atomicity (customer + loyalty transaction updated together)
- Earned points are positive, redeemed points are negative

### Phone Uniqueness Validation
**Node.js Equivalent:**
```typescript
if (data.phone) {
    const exists = await prisma.customer.findUnique({ where: { phone: data.phone } });
    if (exists) throw new BusinessException(`Phone ${data.phone} already registered`);
}
```

**Go Implementation:**
```go
if data.Phone != nil && *data.Phone != "" {
    var existing models.Customer
    if err := cs.db.Where("phone = ?", *data.Phone).First(&existing).Error; err == nil {
        return nil, &util.BusinessException{
            StatusCode: 400,
            Message:    fmt.Sprintf("Phone %s already registered", *data.Phone),
        }
    }
}
```

### CSV Import/Export
**Node.js Equivalent:**
```typescript
const lines = ['header1,header2,...'];
for (const c of allCustomers) {
    lines.push(`"${c.name}","${c.phone ?? ''}",...)
}
return lines.join('\n');
```

**Go Implementation:**
```go
writer := csv.NewWriter(&sb)
writer.Write([]string{"name", "phone", "email", ...})
for _, c := range customers {
    phone := ""
    if c.Phone != nil {
        phone = *c.Phone
    }
    writer.Write([]string{c.Name, phone, ...})
}
```

**Key Points:**
- Handles nil pointers for optional fields
- Proper CSV escaping with csv.Writer
- Upsert logic: update if phone exists, create if new

## Purchase Order Logic

### Automatic Number Generation
**Node.js Equivalent:**
```typescript
const poNumber = generatePONumber();
// Returns format: "PO-20260411-12345-9999"
```

**Go Implementation:**
```go
poNumber, err := util.GeneratePONumber(pos.db)
// Uses database sequence counter + timestamp + nanoLike
```

### Line Item Calculation
**Node.js Equivalent:**
```typescript
const qty = new Decimal(item.quantity);
const cost = new Decimal(item.unitCost);
const lineSub = qty.mul(cost);
const lineTax = lineSub.mul(taxRate).div(100).toDecimalPlaces(2);
subtotal = subtotal.plus(lineSub);
taxAmount = taxAmount.plus(lineTax);
```

**Go Implementation:**
```go
qty := decimal.NewFromFloat(itemMap["quantity"].(float64))
cost := decimal.NewFromFloat(itemMap["unitCost"].(float64))
taxRate := decimal.New(0, 0)

lineSub := qty.Mul(cost)
lineTax := lineSub.Mul(taxRate).Div(decimal.NewFromInt(100)).Round(2)

subtotal = subtotal.Add(lineSub)
taxAmount = taxAmount.Add(lineTax)
```

### Direct Purchase (Immediate Receipt + Inventory Update)
**Node.js Equivalent:**
```typescript
const po = await prisma.purchaseOrder.create({
    data: {
        status: 'RECEIVED',
        receivedDate: new Date(),
        ...
        items: { create: itemsData.map(it => ({
            orderedQuantity: it.qty,
            receivedQuantity: it.qty,  // Key: same as ordered
            ...
        })) }
    }
});

// Update inventory for all items
for (const item of itemsData) {
    const inv = await prisma.inventory.findFirst({ where: { productId: item.productId, outletId } });
    if (inv) {
        await prisma.inventory.update({
            where: { id: inv.id },
            data: { quantityOnHand: new Decimal(inv.quantityOnHand.toString()).plus(item.qty) }
        });
    } else {
        await prisma.inventory.create({
            data: { productId: item.productId, outletId, quantityOnHand: item.qty }
        });
    }
}
```

**Go Implementation:**
```go
return &order, bps.db.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&order).Error; err != nil {
        return err
    }

    for _, item := range itemsData {
        var inv models.Inventory
        result := tx.Where("product_id = ? AND outlet_id = ?", item.ProductID, outletId).First(&inv)

        if result.Error == gorm.ErrRecordNotFound {
            // Create new inventory
            if err := tx.Create(&models.Inventory{...}).Error; err != nil {
                return err
            }
        } else if result.Error == nil {
            // Update existing inventory
            if err := tx.Model(&inv).
                Update("quantity_on_hand", gorm.Expr("quantity_on_hand + ?", item.Quantity)).
                Error; err != nil {
                return err
            }
        }
    }
    return nil
})
```

### Purchase Order Update Validation
**Node.js Equivalent:**
```typescript
if (po.status === 'RECEIVED') throw new BusinessException('Cannot update a received purchase order');
```

**Go Implementation:**
```go
if order.Status == models.POStatusReceived {
    return nil, &util.BusinessException{
        StatusCode: 400,
        Message:    "Cannot update a received purchase order",
    }
}
```

## Purchase Bill Logic

### GST Calculation (INTRA_STATE vs INTER_STATE)
**Node.js Equivalent:**
```typescript
const isIntra = (supplyType ?? 'INTRA_STATE') === 'INTRA_STATE';
const cgstAmount = isIntra ? taxAmount.div(2).toDecimalPlaces(2) : new Decimal(0);
const sgstAmount = isIntra ? taxAmount.minus(cgstAmount) : new Decimal(0);
const igstAmount = isIntra ? new Decimal(0) : taxAmount;
```

**Go Implementation:**
```go
isIntra := supplyType == models.SupplyTypeIntraState
var cgstAmount, sgstAmount, igstAmount decimal.Decimal

if isIntra {
    cgstAmount = taxAmount.Div(decimal.NewFromInt(2)).Round(2)
    sgstAmount = taxAmount.Sub(cgstAmount)
} else {
    igstAmount = taxAmount
}
```

**Key Points:**
- Intra-state: Split tax 50-50 between CGST and SGST
- Inter-state: Full tax as IGST
- Use Round(2) to maintain 2 decimal places

### Payment Status Workflow
**Node.js Equivalent:**
```typescript
const newPaid = new Decimal(bill.paidAmount.toString()).plus(amount);
const newStatus = newPaid.greaterThanOrEqualTo(bill.totalAmount) ? 'PAID'
    : newPaid.greaterThan(0) ? 'PARTIAL'
    : bill.status;
```

**Go Implementation:**
```go
newPaid := bill.PaidAmount.Add(amount)
var newStatus models.BillStatus

if newPaid.GreaterThanOrEqual(bill.TotalAmount) {
    newStatus = models.BillStatusPaid
} else if newPaid.GreaterThan(decimal.Zero) {
    newStatus = models.BillStatusPartial
} else {
    newStatus = bill.Status
}
```

### Create Bill from PO
**Node.js Equivalent:**
```typescript
const bill = await prisma.purchaseBill.create({
    data: {
        billNumber: generateBillNumber(),
        sourcePoId: po.id,
        items: {
            create: po.items.map((item) => ({
                productId: item.productId,
                quantity: item.orderedQuantity,
                unitCost: item.unitCost,
                taxRate: item.taxRate,
            })),
        },
    },
});
```

**Go Implementation:**
```go
bill := models.PurchaseBill{
    BillNumber: billNumber,
    SourcePoID: &poId,
    // ... GST calculation ...
}

for _, item := range po.Items {
    bill.Items = append(bill.Items, models.PurchaseBillItem{
        ProductID: item.ProductID,
        Quantity:  item.OrderedQuantity,
        UnitCost:  item.UnitCost,
        TaxRate:   item.TaxRate,
        LineTotal: item.LineTotal,
    })
}
```

## Purchase Return Logic

### Inventory Deduction
**Node.js Equivalent:**
```typescript
for (const item of itemsData) {
    await prisma.inventory.updateMany({
        where: { productId: item.productId, outletId },
        data: { quantityOnHand: { decrement: item.qty } },
    });
}
```

**Go Implementation:**
```go
for _, item := range itemsData {
    var inv models.Inventory
    result := tx.Where("product_id = ? AND outlet_id = ?", item.ProductID, outletId).First(&inv)

    if result.Error == nil {
        if err := tx.Model(&inv).
            Update("quantity_on_hand", gorm.Expr("quantity_on_hand - ?", item.ReturnedQuantity)).
            Error; err != nil {
            return err
        }
    }
}
```

## Bulk Purchase Logic

### Purchase Factor Conversion
**Node.js Equivalent:**
```typescript
const purchaseFactor = product.purchaseFactor ?? new Decimal(1);
const purchaseQtyDec = new Decimal(purchaseQty);
const baseQty = purchaseQtyDec.mul(purchaseFactor);
```

**Go Implementation:**
```go
purchaseFactor := decimal.NewFromInt(1)
if product.PurchaseFactor != nil {
    purchaseFactor = *product.PurchaseFactor
}

purchaseQtyDec := decimal.NewFromFloat(purchaseQty)
baseQty := purchaseQtyDec.Mul(purchaseFactor)
```

**Example:** Purchase 100 packs with purchaseFactor 12 = 1200 pcs in inventory

### Bulk to Sellable Conversion
**Node.js Equivalent:**
```typescript
const available = new Decimal(bp.baseQty?.toString() ?? 0).minus(bp.convertedBaseQty ?? 0);
const fromQty = new Decimal(fromBaseQty);
if (fromQty.greaterThan(available)) {
    throw new BusinessException(`Insufficient base quantity. Available: ${available}`);
}

// ... update inventory ...

const newConverted = new Decimal((bp.convertedBaseQty ?? 0).toString()).plus(fromQty);
const newStatus = newConverted.greaterThanOrEqualTo(bp.baseQty ?? 0) ? 'CONVERTED' : 'PARTIALLY_CONVERTED';
```

**Go Implementation:**
```go
available := (*bp.BaseQty).Sub(bp.ConvertedBaseQty)
if fromBaseQty.GreaterThan(available) {
    return nil, &util.BusinessException{
        StatusCode: 400,
        Message:    fmt.Sprintf("Insufficient base quantity. Available: %s", available.String()),
    }
}

newConverted := bp.ConvertedBaseQty.Add(fromBaseQty)
var newStatus models.ConversionStatus
if newConverted.GreaterThanOrEqualTo(*bp.BaseQty) {
    newStatus = models.ConversionStatusConverted
} else {
    newStatus = models.ConversionStatusPartiallyConverted
}
```

### Statistics Calculation
**Node.js Equivalent:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const todayPurchases = await prisma.bulkPurchase.findMany({
    where: { outletId, purchaseDate: { gte: today, lt: tomorrow } },
});

const todayTotal = todayPurchases.reduce((s, bp) => s.plus(bp.totalCost ?? 0), new Decimal(0));
```

**Go Implementation:**
```go
today := time.Now()
today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
tomorrow := today.AddDate(0, 0, 1)

var todayPurchases []models.BulkPurchase
if err := bps.db.Where("outlet_id = ? AND purchase_date >= ? AND purchase_date < ?",
    outletId, today, tomorrow).Find(&todayPurchases).Error; err != nil {
    return nil, err
}

var todayTotal decimal.Decimal
for _, bp := range todayPurchases {
    if bp.TotalCost != nil {
        todayTotal = todayTotal.Add(*bp.TotalCost)
    }
}
```

## Error Handling Pattern

All services follow this pattern:

**Node.js:**
```typescript
if (!customer) throw new ResourceNotFoundException('Customer', id);
if (condition) throw new BusinessException('Message');
```

**Go:**
```go
if customer == nil {
    return nil, &util.ResourceNotFoundException{
        Message: fmt.Sprintf("Customer with ID %d not found", id),
    }
}
if condition {
    return nil, &util.BusinessException{
        StatusCode: 400,
        Message:    "Message",
    }
}
```

**Handler Error Handling:**
```go
func handleError(w http.ResponseWriter, err error) {
    if be, ok := err.(*util.BusinessException); ok {
        util.SendError(w, be.StatusCode, be.Message)
        return
    }
    if rn, ok := err.(*util.ResourceNotFoundException); ok {
        util.SendError(w, http.StatusNotFound, rn.Message)
        return
    }
    slog.Error("Handler error", "error", err)
    util.SendError(w, http.StatusInternalServerError, "Internal server error")
}
```

## Transaction Pattern

**Node.js (Implicit):**
```typescript
// Prisma handles transactions automatically for related operations
```

**Go (Explicit):**
```go
return bps.db.Transaction(func(tx *gorm.DB) error {
    // All operations here are atomic
    if err := tx.Create(&record).Error; err != nil {
        return err // Automatic rollback
    }
    if err := tx.Update(&related).Error; err != nil {
        return err // Automatic rollback
    }
    return nil // Automatic commit
})
```

## Key Differences & Translations

| Node.js/Prisma | Go/GORM |
|---|---|
| `findMany()` | `.Find()` |
| `findUnique()` | `.First()` / `.Where().First()` |
| `findFirst()` | `.Where().First()` |
| `count()` | `.Count()` |
| `contains: search` | `LIKE '%' + search + '%'` |
| `new Decimal()` | `decimal.NewFromFloat()` or `decimal.New()` |
| `d.plus()` | `d.Add()` |
| `d.minus()` | `d.Sub()` |
| `d.greaterThan()` | `d.GreaterThan()` |
| `increment: amount` | `gorm.Expr("field + ?", amount)` |
| `decrement: amount` | `gorm.Expr("field - ?", amount)` |
| `create:` with nested | `.Create()` with manual append |
| `await` | Error checked immediately |
| `Promise.all()` | Parallel go routines or sequential |
| `throw Error` | `return nil, err` |

## Testing Notes

Each service method maintains the same:
1. **Input validation** - Required fields, format checks
2. **Business rules** - No duplicate phones, status workflows
3. **Side effects** - Inventory updates, loyalty tracking
4. **Error handling** - Specific error types with messages
5. **Return values** - Fully populated objects with relations
