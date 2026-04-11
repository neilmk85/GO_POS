import { PrismaClient, ExpensePaymentMode, ExpenseStatus } from '@prisma/client'

const prisma = new PrismaClient()
const OUTLET_ID = 1

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

type ExpDef = {
  categoryName: string
  amount: number
  gstRate: number
  vendor: string
  vendorGstin?: string
  paymentMode: ExpensePaymentMode
  status: ExpenseStatus
  date: Date
  ref?: string
  notes?: string
  itcEligible?: boolean
}

async function main() {
  console.log('🌱 Seeding expenses across all categories...\n')

  const categories = await prisma.expenseCategory.findMany()
  if (categories.length === 0) throw new Error('No expense categories found.')

  const catMap: Record<string, number> = {}
  for (const c of categories) catMap[c.name] = c.id

  const expenses: ExpDef[] = [
    // ── Rent ──────────────────────────────────────────────────────────────────
    { categoryName: 'Rent', amount: 45000, gstRate: 18, vendor: 'Shree Properties LLP',     vendorGstin: '27AABCS1234A1Z5', paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(2),   ref: 'NEFT-RENT-APR26',   notes: 'April 2026 shop rent',        itcEligible: true },
    { categoryName: 'Rent', amount: 45000, gstRate: 18, vendor: 'Shree Properties LLP',     vendorGstin: '27AABCS1234A1Z5', paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(32),  ref: 'NEFT-RENT-MAR26',   notes: 'March 2026 shop rent',        itcEligible: true },
    { categoryName: 'Rent', amount: 45000, gstRate: 18, vendor: 'Shree Properties LLP',     vendorGstin: '27AABCS1234A1Z5', paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(60),  ref: 'NEFT-RENT-FEB26',   notes: 'February 2026 shop rent',     itcEligible: true },
    { categoryName: 'Rent', amount: 5000,  gstRate: 0,  vendor: 'Metro Parking Authority',                                  paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(10),                            notes: 'Monthly parking slot' },

    // ── Utilities ─────────────────────────────────────────────────────────────
    { categoryName: 'Utilities', amount: 8200,  gstRate: 0,  vendor: 'MSEDCL',                                              paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(5),   ref: 'MSEDCL-APR-2026',   notes: 'Electricity bill April 2026' },
    { categoryName: 'Utilities', amount: 7800,  gstRate: 0,  vendor: 'MSEDCL',                                              paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(35),  ref: 'MSEDCL-MAR-2026',   notes: 'Electricity bill March 2026' },
    { categoryName: 'Utilities', amount: 1200,  gstRate: 18, vendor: 'Jio Fiber',            vendorGstin: '27AABCJ9012E1Z7', paymentMode: 'UPI',           status: 'APPROVED', date: daysAgo(3),   ref: 'JIO-APR-2026',       notes: 'Internet broadband April 2026', itcEligible: true },
    { categoryName: 'Utilities', amount: 850,   gstRate: 18, vendor: 'Jio Fiber',            vendorGstin: '27AABCJ9012E1Z7', paymentMode: 'UPI',           status: 'APPROVED', date: daysAgo(33),  ref: 'JIO-MAR-2026',       notes: 'Internet broadband March 2026', itcEligible: true },
    { categoryName: 'Utilities', amount: 320,   gstRate: 0,  vendor: 'Municipal Corporation',                               paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(15),                            notes: 'Water charges Q1 2026' },
    { categoryName: 'Utilities', amount: 2500,  gstRate: 18, vendor: 'Airtel Business',      vendorGstin: '24AABCA7890F1Z3', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(7),   ref: 'AIRTEL-APR-2026',   notes: 'Business phone plan', itcEligible: true },

    // ── Salaries ──────────────────────────────────────────────────────────────
    { categoryName: 'Salaries', amount: 18000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(3),   ref: 'SALARY-APR-2026-1', notes: 'Anita Salve — Sales associate April' },
    { categoryName: 'Salaries', amount: 22000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(3),   ref: 'SALARY-APR-2026-2', notes: 'Ravi Kulkarni — Cashier April' },
    { categoryName: 'Salaries', amount: 15000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(3),   ref: 'SALARY-APR-2026-3', notes: 'Priya Singh — Helper April' },
    { categoryName: 'Salaries', amount: 18000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(33),  ref: 'SALARY-MAR-2026-1', notes: 'Anita Salve — Sales associate March' },
    { categoryName: 'Salaries', amount: 22000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(33),  ref: 'SALARY-MAR-2026-2', notes: 'Ravi Kulkarni — Cashier March' },
    { categoryName: 'Salaries', amount: 15000, gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(33),  ref: 'SALARY-MAR-2026-3', notes: 'Priya Singh — Helper March' },
    { categoryName: 'Salaries', amount: 5000,  gstRate: 0, vendor: 'Staff Payroll',                                         paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(10),  ref: 'BONUS-MAR-2026',    notes: 'Performance bonus — Ravi Kulkarni' },

    // ── Marketing ─────────────────────────────────────────────────────────────
    { categoryName: 'Marketing', amount: 12000, gstRate: 18, vendor: 'Meta Ads',             vendorGstin: '09AABCM3456G1Z1', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(6),   ref: 'META-APR-2026',     notes: 'Facebook/Instagram ads April', itcEligible: true },
    { categoryName: 'Marketing', amount: 8500,  gstRate: 18, vendor: 'Meta Ads',             vendorGstin: '09AABCM3456G1Z1', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(36),  ref: 'META-MAR-2026',     notes: 'Facebook/Instagram ads March', itcEligible: true },
    { categoryName: 'Marketing', amount: 3500,  gstRate: 0,  vendor: 'PrintZone',                                           paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(20),                            notes: 'Flyers and pamphlets printing' },
    { categoryName: 'Marketing', amount: 6000,  gstRate: 18, vendor: 'Google Ads',           vendorGstin: '07AABCG7890H1Z9', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(6),   ref: 'GADS-APR-2026',     notes: 'Google search ads April', itcEligible: true },
    { categoryName: 'Marketing', amount: 2200,  gstRate: 0,  vendor: 'Local Newspaper',                                     paymentMode: 'CHEQUE',        status: 'APPROVED', date: daysAgo(25),  ref: 'CHQ-0034',          notes: 'Weekend edition classified ad' },
    { categoryName: 'Marketing', amount: 15000, gstRate: 18, vendor: 'EventCraft Agency',    vendorGstin: '29AABCE2345I1Z7', paymentMode: 'BANK_TRANSFER', status: 'PENDING',  date: daysAgo(1),   ref: 'NEFT-EVT-APR26',    notes: 'Store launch anniversary event — pending approval', itcEligible: true },

    // ── Supplies ──────────────────────────────────────────────────────────────
    { categoryName: 'Supplies', amount: 1800,  gstRate: 18, vendor: 'StatMart',              vendorGstin: '27AABCS5678J1Z5', paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(8),                            notes: 'Office stationery — pens, files, registers', itcEligible: true },
    { categoryName: 'Supplies', amount: 4200,  gstRate: 18, vendor: 'PackRight Solutions',   vendorGstin: '27AABCP9012K1Z3', paymentMode: 'UPI',           status: 'APPROVED', date: daysAgo(12),  ref: 'UPI-PACK-0403',     notes: 'Shopping bags, tissue paper, gift wrap', itcEligible: true },
    { categoryName: 'Supplies', amount: 950,   gstRate: 12, vendor: 'CleanCo',                                               paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(4),                            notes: 'Cleaning supplies — floor cleaner, sanitizer' },
    { categoryName: 'Supplies', amount: 2600,  gstRate: 18, vendor: 'PackRight Solutions',   vendorGstin: '27AABCP9012K1Z3', paymentMode: 'UPI',           status: 'APPROVED', date: daysAgo(42),  ref: 'UPI-PACK-0322',     notes: 'Shopping bags March restock', itcEligible: true },
    { categoryName: 'Supplies', amount: 750,   gstRate: 0,  vendor: 'Local Kirana',                                         paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(9),                            notes: 'Pantry items — tea, coffee, sugar' },
    { categoryName: 'Supplies', amount: 3100,  gstRate: 18, vendor: 'TechSmart',             vendorGstin: '27AABCT3456L1Z1', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(18),  ref: 'TXN-CARD-TS01',     notes: 'Printer ink cartridges x4 + A4 reams', itcEligible: true },

    // ── Maintenance ───────────────────────────────────────────────────────────
    { categoryName: 'Maintenance', amount: 5500,  gstRate: 18, vendor: 'CoolAir Services',   vendorGstin: '27AABCC7890M1Z9', paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(14),                            notes: 'AC servicing — 3 units', itcEligible: true },
    { categoryName: 'Maintenance', amount: 1200,  gstRate: 0,  vendor: 'Ramesh Electricals',                                paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(22),                            notes: 'Light fixture replacement — 6 bulbs + fitting' },
    { categoryName: 'Maintenance', amount: 8000,  gstRate: 18, vendor: 'TechSupport Pro',    vendorGstin: '29AABCT2345N1Z7', paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(17),  ref: 'NEFT-TECH-0317',    notes: 'POS system annual maintenance contract', itcEligible: true },
    { categoryName: 'Maintenance', amount: 2800,  gstRate: 0,  vendor: 'FixIt Plumbing',                                    paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(28),                            notes: 'Washroom repair — tap & pipe leakage' },
    { categoryName: 'Maintenance', amount: 650,   gstRate: 0,  vendor: 'Local Carpenter',                                   paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(50),                            notes: 'Display shelf repair' },
    { categoryName: 'Maintenance', amount: 12000, gstRate: 18, vendor: 'SecureGuard Systems', vendorGstin: '27AABCS6789O1Z5', paymentMode: 'CHEQUE',       status: 'APPROVED', date: daysAgo(60),  ref: 'CHQ-0029',          notes: 'CCTV camera upgrade — 4 cameras + DVR', itcEligible: true },

    // ── Other ─────────────────────────────────────────────────────────────────
    { categoryName: 'Other', amount: 2000,  gstRate: 0,  vendor: 'Chartered Accountant',                                    paymentMode: 'BANK_TRANSFER', status: 'APPROVED', date: daysAgo(15),  ref: 'NEFT-CA-FEE',       notes: 'Monthly accounting fees — Sharma & Co' },
    { categoryName: 'Other', amount: 3500,  gstRate: 18, vendor: 'Courier Express',          vendorGstin: '29AABCC1234P1Z3', paymentMode: 'UPI',           status: 'APPROVED', date: daysAgo(7),   ref: 'UPI-COURIER-04',    notes: 'Delivery charges — customer shipments March', itcEligible: true },
    { categoryName: 'Other', amount: 500,   gstRate: 0,  vendor: 'RTO Office',                                              paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(45),                            notes: 'Vehicle registration renewal — delivery bike' },
    { categoryName: 'Other', amount: 1500,  gstRate: 0,  vendor: 'Insurance Corp of India',                                 paymentMode: 'CHEQUE',        status: 'APPROVED', date: daysAgo(90),  ref: 'CHQ-0021',          notes: 'Shop insurance annual premium' },
    { categoryName: 'Other', amount: 750,   gstRate: 0,  vendor: 'Municipal Corporation',                                   paymentMode: 'CASH',          status: 'APPROVED', date: daysAgo(20),                            notes: 'Trade licence renewal fee' },
    { categoryName: 'Other', amount: 4200,  gstRate: 18, vendor: 'Tally Solutions',          vendorGstin: '29AABCT5678Q1Z1', paymentMode: 'CARD',          status: 'APPROVED', date: daysAgo(55),  ref: 'TXN-TALLY-2026',    notes: 'Tally ERP annual subscription renewal', itcEligible: true },
    { categoryName: 'Other', amount: 2500,  gstRate: 0,  vendor: 'Misc Expenses',                                           paymentMode: 'CASH',          status: 'PENDING',  date: daysAgo(0),                             notes: 'Petty cash reimbursements — staff travel & misc' },
  ]

  let created = 0
  for (const def of expenses) {
    const categoryId = catMap[def.categoryName]
    if (!categoryId) { console.warn(`  ⚠ Category not found: ${def.categoryName}`); continue }

    const gstAmount = Math.round(def.amount * (def.gstRate / 100) * 100) / 100
    const halfGst   = Math.round(gstAmount / 2 * 100) / 100
    const totalAmount = Math.round((def.amount + gstAmount) * 100) / 100

    await prisma.expense.create({
      data: {
        outletId:          OUTLET_ID,
        expenseCategoryId: categoryId,
        amount:            def.amount,
        gstRate:           def.gstRate || null,
        gstAmount,
        cgstAmount:        def.gstRate && def.itcEligible ? halfGst : 0,
        sgstAmount:        def.gstRate && def.itcEligible ? halfGst : 0,
        igstAmount:        0,
        totalAmount,
        supplyType:        'INTRA_STATE',
        vendor:            def.vendor,
        vendorGstin:       def.vendorGstin ?? null,
        itcEligible:       def.itcEligible ?? false,
        expenseDate:       def.date,
        paymentMode:       def.paymentMode,
        referenceNumber:   def.ref ?? null,
        notes:             def.notes ?? null,
        status:            def.status,
        submittedBy:       'seed',
        createdBy:         'seed',
      },
    })
    created++
    console.log(`  ✓ [${def.categoryName.padEnd(11)}] ${def.vendor.padEnd(30)} ₹${totalAmount.toFixed(0).padStart(7)} [${def.paymentMode}]`)
  }

  console.log(`\n✅ Created ${created} expenses across ${categories.length} categories.`)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) byCategory[e.categoryName] = (byCategory[e.categoryName] || 0) + 1
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`   ${cat.padEnd(12)} ${count} entries`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
