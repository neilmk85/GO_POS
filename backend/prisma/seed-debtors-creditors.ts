import { PrismaClient, InvoiceStatus, BillStatus } from '@prisma/client'

const prisma = new PrismaClient()
const OUTLET_ID = 1

// Days offset from today
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d }

async function main() {
  console.log('🌱 Seeding Debtors (Invoices) and Creditors (Purchase Bills)...\n')

  const customers = await prisma.customer.findMany({ take: 10 })
  const suppliers = await prisma.supplier.findMany({ take: 8 })
  const products  = await prisma.product.findMany({ take: 6 })

  if (customers.length === 0) throw new Error('No customers found. Run seed-homedecor first.')
  if (suppliers.length === 0) throw new Error('No suppliers found. Run seed-homedecor first.')
  if (products.length === 0)  throw new Error('No products found. Run seed-homedecor first.')

  // ─── DEBTORS: Invoices with outstanding amounts ───────────────────────────
  console.log('Creating invoices (debtors)...')

  type InvDef = {
    customerIdx: number
    invNum: string
    issueDate: Date
    dueDate: Date
    status: InvoiceStatus
    items: { pidx: number; qty: number; price: number }[]
    paidPct: number   // 0 = fully unpaid, 0.5 = half paid, 1 = fully paid
    notes?: string
  }

  const invoiceDefs: InvDef[] = [
    // Current (due in future)
    { customerIdx: 0, invNum: 'INV-2026-001', issueDate: daysAgo(5),  dueDate: daysFromNow(25), status: 'SENT',    items: [{ pidx: 0, qty: 2, price: 1499 }, { pidx: 1, qty: 1, price: 799 }],  paidPct: 0,   notes: 'King bedsheet + double bedsheet' },
    { customerIdx: 1, invNum: 'INV-2026-002', issueDate: daysAgo(10), dueDate: daysFromNow(20), status: 'PARTIAL', items: [{ pidx: 2, qty: 3, price: 449 }],                                     paidPct: 0.5, notes: 'Single bedsheets, partial payment received' },
    { customerIdx: 2, invNum: 'INV-2026-003', issueDate: daysAgo(3),  dueDate: daysFromNow(27), status: 'SENT',    items: [{ pidx: 3, qty: 5, price: 199 }, { pidx: 4, qty: 2, price: 699 }],  paidPct: 0 },
    // 1–30 days overdue
    { customerIdx: 3, invNum: 'INV-2026-004', issueDate: daysAgo(40), dueDate: daysAgo(10),     status: 'OVERDUE', items: [{ pidx: 5, qty: 2, price: 999 }],                                     paidPct: 0,   notes: 'Follow up pending' },
    { customerIdx: 4, invNum: 'INV-2026-005', issueDate: daysAgo(45), dueDate: daysAgo(15),     status: 'OVERDUE', items: [{ pidx: 0, qty: 1, price: 1499 }, { pidx: 2, qty: 2, price: 449 }], paidPct: 0.3, notes: 'Partial advance received' },
    { customerIdx: 5, invNum: 'INV-2026-006', issueDate: daysAgo(50), dueDate: daysAgo(20),     status: 'OVERDUE', items: [{ pidx: 1, qty: 4, price: 799 }],                                     paidPct: 0 },
    // 31–60 days overdue
    { customerIdx: 6, invNum: 'INV-2026-007', issueDate: daysAgo(75), dueDate: daysAgo(45),     status: 'OVERDUE', items: [{ pidx: 3, qty: 10, price: 199 }, { pidx: 4, qty: 3, price: 699 }], paidPct: 0,   notes: 'Wholesale customer — bulk order' },
    { customerIdx: 7, invNum: 'INV-2026-008', issueDate: daysAgo(80), dueDate: daysAgo(50),     status: 'OVERDUE', items: [{ pidx: 5, qty: 3, price: 999 }],                                     paidPct: 0.25 },
    // 61–90 days overdue
    { customerIdx: 8, invNum: 'INV-2026-009', issueDate: daysAgo(105),dueDate: daysAgo(75),     status: 'OVERDUE', items: [{ pidx: 0, qty: 3, price: 1499 }],                                   paidPct: 0,   notes: 'Legal notice sent' },
    { customerIdx: 9, invNum: 'INV-2026-010', issueDate: daysAgo(110),dueDate: daysAgo(80),     status: 'OVERDUE', items: [{ pidx: 2, qty: 6, price: 449 }, { pidx: 1, qty: 2, price: 799 }],  paidPct: 0.1 },
    // 90+ days overdue
    { customerIdx: 0, invNum: 'INV-2026-011', issueDate: daysAgo(140),dueDate: daysAgo(110),    status: 'OVERDUE', items: [{ pidx: 4, qty: 5, price: 699 }],                                     paidPct: 0,   notes: 'Very overdue — escalated to collections' },
    { customerIdx: 1, invNum: 'INV-2026-012', issueDate: daysAgo(160),dueDate: daysAgo(130),    status: 'OVERDUE', items: [{ pidx: 5, qty: 4, price: 999 }],                                     paidPct: 0 },
    { customerIdx: 3, invNum: 'INV-2026-013', issueDate: daysAgo(180),dueDate: daysAgo(150),    status: 'OVERDUE', items: [{ pidx: 0, qty: 2, price: 1499 }, { pidx: 3, qty: 8, price: 199 }],  paidPct: 0.2 },
  ]

  let invCreated = 0
  for (const def of invoiceDefs) {
    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: def.invNum } })
    if (existing) continue

    const customer = customers[def.customerIdx % customers.length]
    let subtotal = 0
    const itemsData = def.items.map(it => {
      const product = products[it.pidx % products.length]
      const taxRate = 5
      const lineTotal = it.qty * it.price * (1 + taxRate / 100)
      subtotal += it.qty * it.price
      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku ?? '',
        quantity: it.qty,
        unitPrice: it.price,
        discountPercent: 0,
        taxRate,
        lineTotal: Math.round(lineTotal * 100) / 100,
      }
    })

    const taxAmount    = Math.round(subtotal * 0.05 * 100) / 100
    const totalAmount  = Math.round((subtotal + taxAmount) * 100) / 100
    const paidAmount   = Math.round(totalAmount * def.paidPct * 100) / 100

    await prisma.invoice.create({
      data: {
        invoiceNumber: def.invNum,
        customerId:    customer.id,
        outletId:      OUTLET_ID,
        issueDate:     def.issueDate,
        dueDate:       def.dueDate,
        status:        def.status,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        notes:         def.notes ?? null,
        paymentTerms:  'Net 30',
        createdBy:     'seed',
        items: { create: itemsData },
      },
    })
    invCreated++
    console.log(`  ✓ ${def.invNum} — ${customer.name} — ₹${totalAmount.toFixed(0)} [${def.status}]`)
  }
  console.log(`  → ${invCreated} invoices created\n`)

  // ─── CREDITORS: Purchase Bills with outstanding amounts ───────────────────
  console.log('Creating purchase bills (creditors)...')

  type BillDef = {
    supplierIdx: number
    billNum: string
    billDate: Date
    dueDate: Date
    status: BillStatus
    items: { pidx: number; qty: number; cost: number }[]
    paidPct: number
    notes?: string
  }

  const billDefs: BillDef[] = [
    // Current
    { supplierIdx: 0, billNum: 'BILL-2026-001', billDate: daysAgo(5),  dueDate: daysFromNow(25), status: 'UNPAID',  items: [{ pidx: 0, qty: 50, cost: 850  }, { pidx: 1, qty: 30, cost: 420  }], paidPct: 0,   notes: 'Welspun large order' },
    { supplierIdx: 1, billNum: 'BILL-2026-002', billDate: daysAgo(8),  dueDate: daysFromNow(7),  status: 'PARTIAL', items: [{ pidx: 2, qty: 20, cost: 230  }],                                       paidPct: 0.4, notes: 'D\'Decor curtains' },
    { supplierIdx: 2, billNum: 'BILL-2026-003', billDate: daysAgo(12), dueDate: daysFromNow(18), status: 'UNPAID',  items: [{ pidx: 3, qty: 40, cost: 100  }, { pidx: 4, qty: 15, cost: 380 }],  paidPct: 0 },
    // 1–30 days overdue
    { supplierIdx: 3, billNum: 'BILL-2026-004', billDate: daysAgo(45), dueDate: daysAgo(15),     status: 'UNPAID',  items: [{ pidx: 5, qty: 25, cost: 550  }],                                       paidPct: 0,   notes: 'Raymond Home — curtains' },
    { supplierIdx: 4, billNum: 'BILL-2026-005', billDate: daysAgo(50), dueDate: daysAgo(20),     status: 'PARTIAL', items: [{ pidx: 0, qty: 30, cost: 850  }],                                       paidPct: 0.5 },
    { supplierIdx: 5, billNum: 'BILL-2026-006', billDate: daysAgo(55), dueDate: daysAgo(25),     status: 'UNPAID',  items: [{ pidx: 1, qty: 60, cost: 420  }, { pidx: 2, qty: 20, cost: 230  }],  paidPct: 0 },
    // 31–60 days overdue
    { supplierIdx: 6, billNum: 'BILL-2026-007', billDate: daysAgo(80), dueDate: daysAgo(50),     status: 'UNPAID',  items: [{ pidx: 3, qty: 100, cost: 100 }],                                       paidPct: 0,   notes: 'Story@Home large batch' },
    { supplierIdx: 7, billNum: 'BILL-2026-008', billDate: daysAgo(85), dueDate: daysAgo(55),     status: 'PARTIAL', items: [{ pidx: 4, qty: 20, cost: 380  }, { pidx: 5, qty: 10, cost: 550  }],  paidPct: 0.3 },
    // 61–90 days overdue
    { supplierIdx: 0, billNum: 'BILL-2026-009', billDate: daysAgo(110),dueDate: daysAgo(80),     status: 'UNPAID',  items: [{ pidx: 0, qty: 80, cost: 850  }],                                       paidPct: 0,   notes: 'Old pending — escalated' },
    { supplierIdx: 2, billNum: 'BILL-2026-010', billDate: daysAgo(115),dueDate: daysAgo(85),     status: 'PARTIAL', items: [{ pidx: 1, qty: 40, cost: 420  }],                                       paidPct: 0.2 },
    // 90+ days overdue
    { supplierIdx: 1, billNum: 'BILL-2026-011', billDate: daysAgo(145),dueDate: daysAgo(115),    status: 'UNPAID',  items: [{ pidx: 2, qty: 50, cost: 230  }, { pidx: 3, qty: 30, cost: 100  }],  paidPct: 0,   notes: 'Disputed quantity — under review' },
    { supplierIdx: 3, billNum: 'BILL-2026-012', billDate: daysAgo(165),dueDate: daysAgo(135),    status: 'UNPAID',  items: [{ pidx: 5, qty: 20, cost: 550  }],                                       paidPct: 0 },
  ]

  let billCreated = 0
  for (const def of billDefs) {
    const existing = await prisma.purchaseBill.findFirst({ where: { billNumber: def.billNum } })
    if (existing) continue

    const supplier = suppliers[def.supplierIdx % suppliers.length]
    let subtotal = 0
    const itemsData = def.items.map(it => {
      const product = products[it.pidx % products.length]
      const taxRate = 5
      const lineTotal = it.qty * it.cost * (1 + taxRate / 100)
      subtotal += it.qty * it.cost
      return {
        productId: product.id,
        quantity:  it.qty,
        unitCost:  it.cost,
        taxRate,
        lineTotal: Math.round(lineTotal * 100) / 100,
      }
    })

    const taxAmount   = Math.round(subtotal * 0.05 * 100) / 100
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100
    const paidAmount  = Math.round(totalAmount * def.paidPct * 100) / 100

    await prisma.purchaseBill.create({
      data: {
        billNumber:  def.billNum,
        supplierId:  supplier.id,
        outletId:    OUTLET_ID,
        billDate:    def.billDate,
        dueDate:     def.dueDate,
        status:      def.status,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        notes:       def.notes ?? null,
        createdBy:   'seed',
        items: { create: itemsData },
      },
    })
    billCreated++
    console.log(`  ✓ ${def.billNum} — ${supplier.name} — ₹${totalAmount.toFixed(0)} [${def.status}]`)
  }
  console.log(`  → ${billCreated} purchase bills created\n`)

  console.log('✅ Done! Go to Reports → Debtors / Creditors to see the data.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
