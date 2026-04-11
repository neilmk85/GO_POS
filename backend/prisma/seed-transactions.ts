import { PrismaClient, PaymentMethod, OrderStatus, OrderType, PaymentStatus } from '@prisma/client'

const prisma = new PrismaClient()

const OUTLET_ID = 1

async function main() {
  console.log('🌱 Seeding transactions with all payment modes...\n')

  // Fetch prerequisites
  const cashier = await prisma.user.findFirst({ where: { outletId: OUTLET_ID } })
  if (!cashier) throw new Error('No user found for outlet 1. Run seed-homedecor first.')

  const customers = await prisma.customer.findMany({ take: 10 })
  const products  = await prisma.product.findMany({ take: 10 })
  if (products.length === 0) throw new Error('No products found. Run seed-homedecor first.')

  const pick = <T>(arr: T[], i: number): T => arr[i % arr.length]

  type TxDef = {
    method: PaymentMethod
    label: string
    customerIdx: number
    productIdx: number
    qty: number
    ref?: string
    notes?: string
  }

  const txDefs: TxDef[] = [
    { method: PaymentMethod.CASH,          label: 'Cash sale',           customerIdx: 0, productIdx: 0, qty: 2 },
    { method: PaymentMethod.CARD,          label: 'Debit/Credit card',   customerIdx: 1, productIdx: 1, qty: 1, ref: 'TXN-CARD-4521', notes: 'Visa ending 4521' },
    { method: PaymentMethod.UPI,           label: 'UPI payment',         customerIdx: 2, productIdx: 2, qty: 3, ref: 'UPI-9876543210@ybl', notes: 'GPay transfer' },
    { method: PaymentMethod.NET_BANKING,   label: 'Net banking',         customerIdx: 3, productIdx: 3, qty: 1, ref: 'NEFT-HDFC-20240403', notes: 'HDFC NEFT' },
    { method: PaymentMethod.CREDIT_NOTE,   label: 'Credit note',         customerIdx: 4, productIdx: 4, qty: 2, ref: 'CN-2024-001', notes: 'Adjusted against previous return' },
    { method: PaymentMethod.LOYALTY_POINTS,label: 'Loyalty points',      customerIdx: 5, productIdx: 5, qty: 1, notes: 'Points redeemed by VIP customer' },
    { method: PaymentMethod.CREDIT_SALE,   label: 'Credit sale',         customerIdx: 6, productIdx: 6, qty: 4, notes: 'Billed, payment due in 30 days' },
    { method: PaymentMethod.ADVANCE,       label: 'Advance payment',     customerIdx: 7, productIdx: 7, qty: 2, ref: 'ADV-2024-0403', notes: 'Advance collected for custom order' },
    // A few more to make the report data richer
    { method: PaymentMethod.CASH,          label: 'Cash sale #2',        customerIdx: 8, productIdx: 8, qty: 1 },
    { method: PaymentMethod.UPI,           label: 'UPI #2',              customerIdx: 9, productIdx: 9, qty: 2, ref: 'UPI-7654321098@paytm', notes: 'Paytm' },
    { method: PaymentMethod.CARD,          label: 'Card #2',             customerIdx: 0, productIdx: 2, qty: 1, ref: 'TXN-CARD-8899', notes: 'Mastercard tap' },
    { method: PaymentMethod.CASH,          label: 'Cash sale #3',        customerIdx: 1, productIdx: 5, qty: 3 },
    { method: PaymentMethod.NET_BANKING,   label: 'Net banking #2',      customerIdx: 2, productIdx: 0, qty: 1, ref: 'RTGS-SBI-20240403' },
    { method: PaymentMethod.CREDIT_SALE,   label: 'Credit sale #2',      customerIdx: 3, productIdx: 3, qty: 2 },
  ]

  let created = 0
  const base   = new Date('2026-04-01T10:00:00')

  for (let i = 0; i < txDefs.length; i++) {
    const def     = txDefs[i]
    const product = pick(products, def.productIdx)
    const customer = customers.length > 0 ? pick(customers, def.customerIdx) : null

    const unitPrice     = Number(product.sellingPrice)
    const qty           = def.qty
    const subtotal      = unitPrice * qty
    const taxRate       = 5   // default 5%
    const taxAmount     = Math.round(subtotal * taxRate / 100 * 100) / 100
    const totalAmount   = subtotal + taxAmount

    const orderDate = new Date(base.getTime() + i * 3600_000)  // 1 hr apart

    const orderNumber = `ORD-SEED-${Date.now()}-${i}`

    const order = await prisma.order.create({
      data: {
        orderNumber,
        outletId:    OUTLET_ID,
        cashierId:   cashier.id,
        customerId:  customer?.id ?? null,
        status:      OrderStatus.COMPLETED,
        orderType:   def.method === PaymentMethod.CREDIT_SALE ? OrderType.CREDIT_SALE : OrderType.SALE,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount:  totalAmount,
        notes:       def.notes ?? null,
        createdAt:   orderDate,
        updatedAt:   orderDate,
        createdBy:   'seed',
        items: {
          create: [{
            productId:      product.id,
            productName:    product.name,
            sku:            product.sku ?? '',
            quantity:       qty,
            unitPrice,
            taxRate,
            taxAmount,
            lineTotal:      totalAmount,
            discountPercent: 0,
            discountAmount:  0,
          }],
        },
        payments: {
          create: [{
            paymentMethod:   def.method,
            amount:          totalAmount,
            referenceNumber: def.ref ?? null,
            status:          PaymentStatus.COMPLETED,
            notes:           def.notes ?? null,
            createdAt:       orderDate,
            updatedAt:       orderDate,
          }],
        },
      },
    })

    created++
    console.log(`  ✓ [${def.method.padEnd(15)}] ${orderNumber} — ₹${totalAmount.toFixed(2)}`)
  }

  console.log(`\n✅ Created ${created} transactions covering all 8 payment modes.`)
  console.log('   Go to Reports → Payments to see the breakdown.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
