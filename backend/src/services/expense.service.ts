import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { ResourceNotFoundException } from '../utils/response';

export interface ExpenseRequest {
  outletId: number;
  categoryId: number;
  amount: number;
  gstRate?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  supplyType?: string;
  vendorGstin?: string;
  itcEligible?: boolean;
  expenseDate: Date;
  vendor?: string;
  paymentMode?: string;
  referenceNumber?: string;
  notes?: string;
  submittedBy?: string;
  recurring?: boolean;
  recurrenceInterval?: string;
  recurrenceDay?: number;
}

function computeNextRecurrence(interval: string, day?: number): Date {
  const now = new Date();
  if (interval === 'WEEKLY') {
    const d = new Date(now);
    const dayOfWeek = day ?? 1; // 1=Mon
    const currentDay = d.getDay() === 0 ? 7 : d.getDay();
    const diff = (dayOfWeek - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  } else if (interval === 'MONTHLY') {
    const d = new Date(now);
    const targetDay = day ?? 1;
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(targetDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
  }
  return now;
}

export async function create(req: ExpenseRequest) {
  const amount = new Decimal(req.amount);
  const gstAmount = new Decimal(req.gstAmount ?? 0);
  const cgstAmount = new Decimal(req.cgstAmount ?? 0);
  const sgstAmount = new Decimal(req.sgstAmount ?? 0);
  const igstAmount = new Decimal(req.igstAmount ?? 0);
  const totalAmount = amount.plus(gstAmount);

  const nextDate = req.recurring && req.recurrenceInterval
    ? computeNextRecurrence(req.recurrenceInterval, req.recurrenceDay)
    : null;

  return prisma.expense.create({
    data: {
      outletId: req.outletId,
      expenseCategoryId: req.categoryId,
      amount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstRate: req.gstRate ? new Decimal(req.gstRate) : null,
      totalAmount,
      supplyType: (req.supplyType as never) ?? 'INTRA_STATE',
      vendorGstin: req.vendorGstin,
      itcEligible: req.itcEligible ?? false,
      expenseDate: req.expenseDate,
      vendor: req.vendor,
      paymentMode: (req.paymentMode as never) ?? 'CASH',
      referenceNumber: req.referenceNumber,
      notes: req.notes,
      submittedBy: req.submittedBy,
      status: 'PENDING',
      recurring: req.recurring ?? false,
      recurrenceInterval: req.recurrenceInterval as never ?? null,
      recurrenceDay: req.recurrenceDay,
      nextRecurrenceDate: nextDate,
    },
    include: { expenseCategory: true, outlet: true },
  });
}

export async function update(id: number, req: ExpenseRequest) {
  const amount = new Decimal(req.amount);
  const gstAmount = new Decimal(req.gstAmount ?? 0);
  const cgstAmount = new Decimal(req.cgstAmount ?? 0);
  const sgstAmount = new Decimal(req.sgstAmount ?? 0);
  const igstAmount = new Decimal(req.igstAmount ?? 0);
  const totalAmount = amount.plus(gstAmount);

  return prisma.expense.update({
    where: { id },
    data: {
      outletId: req.outletId,
      expenseCategoryId: req.categoryId,
      amount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      gstRate: req.gstRate ? new Decimal(req.gstRate) : null,
      totalAmount,
      supplyType: req.supplyType as never ?? 'INTRA_STATE',
      vendorGstin: req.vendorGstin,
      itcEligible: req.itcEligible ?? false,
      expenseDate: req.expenseDate,
      vendor: req.vendor,
      paymentMode: req.paymentMode as never ?? 'CASH',
      referenceNumber: req.referenceNumber,
      notes: req.notes,
      submittedBy: req.submittedBy,
      recurring: req.recurring ?? false,
      recurrenceInterval: req.recurrenceInterval as never ?? null,
      recurrenceDay: req.recurrenceDay,
    },
    include: { expenseCategory: true, outlet: true },
  });
}

export async function search(
  outletId: number,
  from?: Date,
  to?: Date,
  categoryId?: number,
  paymentMode?: string,
  status?: string,
  itcEligible?: boolean,
  page = 0,
  size = 20
) {
  const where: Record<string, unknown> = { outletId };
  if (from || to) where['expenseDate'] = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (categoryId) where['expenseCategoryId'] = categoryId;
  if (paymentMode) where['paymentMode'] = paymentMode;
  if (status) where['status'] = status;
  if (itcEligible !== undefined) where['itcEligible'] = itcEligible;

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where: where as never,
      include: { expenseCategory: true, outlet: true },
      orderBy: { expenseDate: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.expense.count({ where: where as never }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getAllForExport(
  outletId: number,
  from?: Date,
  to?: Date,
  categoryId?: number,
  paymentMode?: string,
  status?: string
) {
  const where: Record<string, unknown> = { outletId };
  if (from || to) where['expenseDate'] = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (categoryId) where['expenseCategoryId'] = categoryId;
  if (paymentMode) where['paymentMode'] = paymentMode;
  if (status) where['status'] = status;

  return prisma.expense.findMany({
    where: where as never,
    include: { expenseCategory: true },
    orderBy: { expenseDate: 'desc' },
  });
}

export async function getStats(outletId: number, from?: Date, to?: Date) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd     = new Date(todayStart.getTime() + 86_400_000 - 1);

  // If a date range is provided, use it for the main breakdown; otherwise show all-time
  const rangeFilter = from || to
    ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
    : undefined;

  const [rangedExpenses, monthExpenses, todayExpenses, categories] = await Promise.all([
    prisma.expense.findMany({ where: { outletId, ...(rangeFilter ? { expenseDate: rangeFilter } : {}) }, include: { expenseCategory: true } }),
    prisma.expense.findMany({ where: { outletId, expenseDate: { gte: startOfMonth, lte: endOfMonth } }, include: { expenseCategory: true } }),
    prisma.expense.findMany({ where: { outletId, expenseDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.expenseCategory.findMany({ where: { active: true } }),
  ]);
  const allExpenses = rangedExpenses;

  const sum = (arr: any[], key = 'totalAmount') => arr.reduce((s, e) => s.plus(new Decimal(e[key] ?? 0)), new Decimal(0));

  const itcExpenses = allExpenses.filter((e) => e.itcEligible);
  const itcTotal  = sum(itcExpenses, 'gstAmount');
  const itcCgst   = sum(itcExpenses, 'cgstAmount');
  const itcSgst   = sum(itcExpenses, 'sgstAmount');
  const itcIgst   = sum(itcExpenses, 'igstAmount');

  // Category breakdown
  const catMap: Record<number, { categoryId: number; name: string; color: string; icon: string; total: number; count: number }> = {};
  for (const e of allExpenses) {
    const cat = e.expenseCategory;
    if (!cat) continue;
    if (!catMap[cat.id]) catMap[cat.id] = { categoryId: cat.id, name: cat.name, color: cat.color, icon: cat.icon, total: 0, count: 0 };
    catMap[cat.id].total += Number(e.totalAmount);
    catMap[cat.id].count += 1;
  }
  const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total);

  // Payment mode breakdown
  const modeMap: Record<string, { mode: string; total: number; count: number }> = {};
  for (const e of allExpenses) {
    const m = e.paymentMode;
    if (!modeMap[m]) modeMap[m] = { mode: m, total: 0, count: 0 };
    modeMap[m].total += Number(e.totalAmount);
    modeMap[m].count += 1;
  }
  const byPaymentMode = Object.values(modeMap).sort((a, b) => b.total - a.total);

  // Budget usage per category (month)
  const monthCatSpend: Record<number, number> = {};
  for (const e of monthExpenses) {
    if (e.expenseCategoryId) monthCatSpend[e.expenseCategoryId] = (monthCatSpend[e.expenseCategoryId] ?? 0) + Number(e.totalAmount);
  }
  const budgetUsage = categories
    .filter((c) => c.monthlyBudget && Number(c.monthlyBudget) > 0)
    .map((c) => ({ categoryId: c.id, categoryName: c.name, budget: Number(c.monthlyBudget), spent: monthCatSpend[c.id] ?? 0 }));

  return {
    todayTotal:   sum(todayExpenses),
    todayCount:   todayExpenses.length,
    monthTotal:   sum(monthExpenses),
    monthCount:   monthExpenses.length,
    allTimeTotal: sum(allExpenses),
    allTimeCount: allExpenses.length,
    itcTotal, itcCgst, itcSgst, itcIgst,
    byCategory,
    byPaymentMode,
    budgetUsage,
    categoryCount: categories.length,
  };
}

export async function updateStatus(id: number, status: string) {
  return prisma.expense.update({
    where: { id },
    data: { status: status as never },
    include: { expenseCategory: true, outlet: true },
  });
}

export async function deleteExpense(id: number) {
  await prisma.expense.delete({ where: { id } });
}

export async function generateDueRecurringExpenses(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recurring = await prisma.expense.findMany({
    where: {
      recurring: true,
      status: { not: 'REJECTED' },
      nextRecurrenceDate: { lte: today },
    },
    include: { expenseCategory: true },
  });

  let count = 0;
  for (const tmpl of recurring) {
    await prisma.expense.create({
      data: {
        outletId: tmpl.outletId,
        expenseCategoryId: tmpl.expenseCategoryId,
        amount: tmpl.amount,
        gstAmount: tmpl.gstAmount,
        cgstAmount: tmpl.cgstAmount,
        sgstAmount: tmpl.sgstAmount,
        igstAmount: tmpl.igstAmount,
        gstRate: tmpl.gstRate,
        totalAmount: tmpl.totalAmount,
        supplyType: tmpl.supplyType,
        vendorGstin: tmpl.vendorGstin,
        itcEligible: tmpl.itcEligible,
        expenseDate: today,
        vendor: tmpl.vendor,
        paymentMode: tmpl.paymentMode,
        referenceNumber: tmpl.referenceNumber,
        notes: tmpl.notes,
        submittedBy: tmpl.submittedBy,
        status: 'PENDING',
        recurring: false,
        parentExpenseId: tmpl.id,
      },
    });

    // Compute next recurrence
    const nextDate = tmpl.recurrenceInterval
      ? computeNextRecurrence(tmpl.recurrenceInterval, tmpl.recurrenceDay ?? undefined)
      : null;

    await prisma.expense.update({
      where: { id: tmpl.id },
      data: { nextRecurrenceDate: nextDate },
    });

    count++;
  }

  return count;
}

// Expense Categories
export async function getAllCategories() {
  return prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
}

export async function createCategory(data: Record<string, unknown>) {
  return prisma.expenseCategory.create({ data: data as never });
}

export async function updateCategory(id: number, data: Record<string, unknown>) {
  return prisma.expenseCategory.update({ where: { id }, data: data as never });
}

export async function deleteCategory(id: number) {
  await prisma.expenseCategory.delete({ where: { id } });
}
