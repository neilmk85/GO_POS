import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';

async function getCompletedOrders(outletId: number, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { outletId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
    include: {
      items: { include: { product: { include: { category: true } } } },
      payments: true,
      customer: true,
    },
  });
}

async function getAllOrders(outletId: number, from: Date, to: Date) {
  return prisma.order.findMany({
    where: { outletId, createdAt: { gte: from, lte: to } },
    include: { items: true, payments: true },
  });
}

export async function getSalesSummary(outletId: number, from: Date, to: Date) {
  const all = await getAllOrders(outletId, from, to);
  const completed = all.filter((o) => o.status === 'COMPLETED');

  const totalRevenue = completed.reduce((s, o) => s.plus(o.totalAmount), new Decimal(0));
  const totalDiscount = completed.reduce((s, o) => s.plus(o.discountAmount), new Decimal(0));
  const totalTax = completed.reduce((s, o) => s.plus(o.taxAmount), new Decimal(0));
  const totalCost = completed.reduce((s, o) => {
    return s.plus(
      o.items.reduce((is, i) => {
        return is.plus(i.costPrice ? new Decimal(i.costPrice.toString()).mul(i.quantity) : new Decimal(0));
      }, new Decimal(0))
    );
  }, new Decimal(0));

  const grossProfit = totalRevenue.minus(totalCost);
  const totalOrders = completed.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue.div(totalOrders).toDecimalPlaces(2) : new Decimal(0);

  return {
    totalRevenue,
    totalDiscount,
    totalTax,
    grossProfit,
    totalOrders,
    avgOrderValue,
    cancelledOrders: all.filter((o) => o.status === 'CANCELLED').length,
    returnedOrders: all.filter((o) => o.status === 'REFUNDED').length,
  };
}

export async function getTopProducts(outletId: number, from: Date, to: Date, limit = 10) {
  const orders = await getCompletedOrders(outletId, from, to);
  const productStats: Record<string, { productId: number; productName: string; totalQuantity: Decimal; totalRevenue: Decimal }> = {};

  for (const order of orders) {
    for (const item of order.items) {
      const key = String(item.productId);
      if (!productStats[key]) {
        productStats[key] = {
          productId: item.productId,
          productName: item.productName,
          totalQuantity: new Decimal(0),
          totalRevenue: new Decimal(0),
        };
      }
      productStats[key].totalQuantity = productStats[key].totalQuantity.plus(item.quantity);
      productStats[key].totalRevenue = productStats[key].totalRevenue.plus(item.lineTotal);
    }
  }

  return Object.values(productStats)
    .sort((a, b) => b.totalRevenue.minus(a.totalRevenue).toNumber())
    .slice(0, limit);
}

export async function getSalesByPaymentMethod(outletId: number, from: Date, to: Date) {
  const orders = await getCompletedOrders(outletId, from, to);
  const breakdown: Record<string, Decimal> = {};

  for (const order of orders) {
    for (const payment of order.payments) {
      const method = payment.paymentMethod;
      breakdown[method] = (breakdown[method] ?? new Decimal(0)).plus(payment.amount);
    }
  }

  return Object.entries(breakdown).map(([method, amount]) => ({ method, amount }));
}

export async function getDailySalesTrend(outletId: number, from: Date, to: Date) {
  const orders = await getCompletedOrders(outletId, from, to);
  const dailySales: Record<string, Decimal> = {};

  for (const order of orders) {
    const date = order.createdAt.toISOString().split('T')[0];
    dailySales[date] = (dailySales[date] ?? new Decimal(0)).plus(order.totalAmount);
  }

  return Object.entries(dailySales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

export async function getSalesByCategory(outletId: number, from: Date, to: Date) {
  const orders = await getCompletedOrders(outletId, from, to);
  const catMap: Record<string, { category: string; totalQuantity: Decimal; totalRevenue: Decimal; totalDiscount: Decimal }> = {};

  for (const order of orders) {
    for (const item of order.items) {
      const catName = item.product?.category?.name ?? 'Uncategorised';
      if (!catMap[catName]) {
        catMap[catName] = { category: catName, totalQuantity: new Decimal(0), totalRevenue: new Decimal(0), totalDiscount: new Decimal(0) };
      }
      catMap[catName].totalQuantity = catMap[catName].totalQuantity.plus(item.quantity);
      catMap[catName].totalRevenue = catMap[catName].totalRevenue.plus(item.lineTotal);
      catMap[catName].totalDiscount = catMap[catName].totalDiscount.plus(item.discountAmount ?? 0);
    }
  }

  return Object.values(catMap).sort((a, b) => b.totalRevenue.minus(a.totalRevenue).toNumber());
}

export async function getSalesByProduct(outletId: number, from: Date, to: Date) {
  const orders = await getCompletedOrders(outletId, from, to);
  const prodMap: Record<string, {
    productId: number; productName: string; sku: string; category: string;
    totalQuantity: Decimal; totalRevenue: Decimal; totalDiscount: Decimal; totalCost: Decimal; totalTax: Decimal;
  }> = {};

  for (const order of orders) {
    for (const item of order.items) {
      const key = String(item.productId);
      if (!prodMap[key]) {
        prodMap[key] = {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku ?? '',
          category: item.product?.category?.name ?? 'Uncategorised',
          totalQuantity: new Decimal(0),
          totalRevenue: new Decimal(0),
          totalDiscount: new Decimal(0),
          totalCost: new Decimal(0),
          totalTax: new Decimal(0),
        };
      }
      prodMap[key].totalQuantity = prodMap[key].totalQuantity.plus(item.quantity);
      prodMap[key].totalRevenue = prodMap[key].totalRevenue.plus(item.lineTotal);
      prodMap[key].totalDiscount = prodMap[key].totalDiscount.plus(item.discountAmount ?? 0);
      prodMap[key].totalTax = prodMap[key].totalTax.plus(item.taxAmount ?? 0);
      if (item.costPrice) {
        prodMap[key].totalCost = prodMap[key].totalCost.plus(new Decimal(item.costPrice.toString()).mul(item.quantity));
      }
    }
  }

  return Object.values(prodMap).sort((a, b) => b.totalRevenue.minus(a.totalRevenue).toNumber());
}

export async function getSalesByCustomer(outletId: number, from: Date, to: Date) {
  const orders = await getCompletedOrders(outletId, from, to);
  const custMap: Record<string, {
    customerId: number; customerName: string; phone: string;
    orderCount: number; totalSpend: Decimal; totalDiscount: Decimal;
  }> = {};

  for (const order of orders) {
    if (!order.customerId || !order.customer) continue;
    const key = String(order.customerId);
    if (!custMap[key]) {
      custMap[key] = {
        customerId: order.customerId,
        customerName: order.customer.name,
        phone: (order.customer as any).phone ?? '',
        orderCount: 0,
        totalSpend: new Decimal(0),
        totalDiscount: new Decimal(0),
      };
    }
    custMap[key].orderCount++;
    custMap[key].totalSpend = custMap[key].totalSpend.plus(order.totalAmount);
    custMap[key].totalDiscount = custMap[key].totalDiscount.plus(order.discountAmount);
  }

  return Object.values(custMap)
    .map(r => ({
      ...r,
      totalSpend: r.totalSpend.toNumber(),
      totalDiscount: r.totalDiscount.toNumber(),
      avgOrderValue: r.orderCount > 0 ? r.totalSpend.div(r.orderCount).toDecimalPlaces(2).toNumber() : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function exportSalesCsv(outletId: number, from: Date, to: Date): Promise<Buffer> {
  const orders = await getCompletedOrders(outletId, from, to);
  const lines = ['Date,Order Number,Customer,Items,Subtotal,Discount,Tax,Total,Payment Method'];

  for (const order of orders) {
    const customer = order.customer?.name ?? '';
    const items = order.items.length;
    const method = order.payments.map((p) => p.paymentMethod).join('+');
    lines.push(
      `${order.createdAt.toISOString().split('T')[0]},${order.orderNumber},"${customer}",${items},${order.subtotal},${order.discountAmount},${order.taxAmount},${order.totalAmount},"${method}"`
    );
  }

  return Buffer.from(lines.join('\n'));
}

export async function getPurchaseSummary(outletId: number, from: Date, to: Date) {
  const pos = await prisma.purchaseOrder.findMany({
    where: { outletId, createdAt: { gte: from, lte: to } },
    include: { items: true, supplier: true },
  });

  const totalOrders = pos.length;
  const totalValue = pos.reduce((s, po) => s.plus(po.totalAmount), new Decimal(0)).toNumber();
  const received = pos.filter((po) => po.status === 'RECEIVED').length;
  const pending = pos.filter((po) => po.status === 'SENT' || po.status === 'DRAFT').length;
  const cancelled = pos.filter((po) => po.status === 'CANCELLED').length;
  const uniqueSuppliers = new Set(pos.map((po) => po.supplierId)).size;
  const avgPoValue = totalOrders > 0 ? totalValue / totalOrders : 0;
  const outstanding = pos
    .filter((po) => po.status !== 'RECEIVED' && po.status !== 'CANCELLED')
    .reduce((s, po) => s + Number(po.totalAmount), 0);

  return { totalOrders, totalValue, received, pending, cancelled, uniqueSuppliers, avgPoValue, outstanding };
}

export async function getPurchaseBySupplier(outletId: number, from: Date, to: Date) {
  const pos = await prisma.purchaseOrder.findMany({
    where: { outletId, createdAt: { gte: from, lte: to } },
    include: { supplier: true },
  });

  const supplierMap: Record<string, {
    supplierName: string; phone: string;
    orderCount: number; received: number; pending: number;
    totalValue: Decimal;
  }> = {};

  for (const po of pos) {
    const key = String(po.supplierId);
    if (!supplierMap[key]) {
      supplierMap[key] = {
        supplierName: po.supplier.name,
        phone: (po.supplier as any).phone ?? '',
        orderCount: 0, received: 0, pending: 0,
        totalValue: new Decimal(0),
      };
    }
    supplierMap[key].orderCount++;
    supplierMap[key].totalValue = supplierMap[key].totalValue.plus(po.totalAmount);
    if (po.status === 'RECEIVED') supplierMap[key].received++;
    else if (po.status !== 'CANCELLED') supplierMap[key].pending++;
  }

  return Object.values(supplierMap)
    .map(r => ({
      ...r,
      totalValue: r.totalValue.toNumber(),
      avgPoValue: r.orderCount > 0 ? r.totalValue.div(r.orderCount).toDecimalPlaces(2).toNumber() : 0,
      outstanding: 0, // bills-level outstanding not tracked at PO level
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

export async function getOutstandingPOs(outletId: number, from: Date, to: Date) {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      outletId,
      createdAt: { gte: from, lte: to },
      status: { in: ['DRAFT', 'SENT', 'PARTIAL'] },
    },
    include: { supplier: true, items: true },
    orderBy: { createdAt: 'desc' },
  });
  return pos.map(po => ({
    poNumber:      po.poNumber,
    supplierName:  po.supplier.name,
    supplierPhone: (po.supplier as any).phone ?? '',
    status:        po.status,
    itemCount:     po.items.length,
    orderDate:     po.createdAt.toISOString().split('T')[0],
    expectedDate:  po.expectedDate ? po.expectedDate.toISOString().split('T')[0] : null,
    totalAmount:   Number(po.totalAmount),
  }));
}

export async function getSaleReturns(outletId: number, from: Date, to: Date) {
  const orders = await prisma.order.findMany({
    where: { outletId, orderType: 'RETURN', createdAt: { gte: from, lte: to } },
    include: { items: { include: { product: true } }, customer: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });
  return orders.map(o => ({
    orderNumber:    o.orderNumber,
    date:           o.createdAt.toISOString().split('T')[0],
    customer:       o.customer?.name ?? '',
    customerPhone:  (o.customer as any)?.phone ?? '',
    status:         o.status,
    itemCount:      o.items.length,
    originalAmount: Number(o.subtotal),
    refundAmount:   Number(o.totalAmount),
    notes:          o.notes ?? '',
    refundMethod:   o.payments?.[0]?.paymentMethod ?? o.notes ?? '',
  }));
}

export async function getPurchaseReturns(outletId: number, from: Date, to: Date) {
  return prisma.purchaseReturn.findMany({
    where: { outletId, createdAt: { gte: from, lte: to } },
    include: { items: { include: { product: true } }, purchaseOrder: { include: { supplier: true } } },
  });
}

export async function getOutstandingReceivable(outletId: number) {
  return prisma.customer.findMany({
    where: {
      outstandingDue: { gt: 0 },
      orders: { some: { outletId } },
    },
    select: { id: true, name: true, phone: true, email: true, outstandingDue: true },
    orderBy: { outstandingDue: 'desc' },
  });
}

// ─── Payment Methods Report ───────────────────────────────────────────────────

export async function getPaymentMethodReport(outletId: number, from: Date, to: Date) {
  const payments = await prisma.payment.findMany({
    where: {
      status: 'COMPLETED',
      order: { outletId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
    },
    include: { order: { select: { id: true, orderNumber: true, createdAt: true, customer: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  // Summary per method
  const methodMap: Record<string, { method: string; totalAmount: Decimal; txCount: number }> = {};
  // Daily trend per method
  const dailyMap: Record<string, Record<string, Decimal>> = {};

  for (const p of payments) {
    const method = p.paymentMethod;
    if (!methodMap[method]) methodMap[method] = { method, totalAmount: new Decimal(0), txCount: 0 };
    methodMap[method].totalAmount = methodMap[method].totalAmount.plus(p.amount);
    methodMap[method].txCount++;

    const date = p.createdAt.toISOString().split('T')[0];
    if (!dailyMap[date]) dailyMap[date] = {};
    dailyMap[date][method] = (dailyMap[date][method] ?? new Decimal(0)).plus(p.amount);
  }

  const grandTotal = Object.values(methodMap).reduce((s, m) => s.plus(m.totalAmount), new Decimal(0));

  const summary = Object.values(methodMap)
    .map(m => ({
      method: m.method,
      totalAmount: m.totalAmount,
      txCount: m.txCount,
      avgAmount: m.txCount > 0 ? m.totalAmount.div(m.txCount).toDecimalPlaces(2) : new Decimal(0),
      share: grandTotal.gt(0) ? m.totalAmount.div(grandTotal).mul(100).toDecimalPlaces(1) : new Decimal(0),
    }))
    .sort((a, b) => b.totalAmount.minus(a.totalAmount).toNumber());

  const allMethods = Object.keys(methodMap);
  const dailyTrend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, methods]) => {
      const row: Record<string, any> = { date };
      for (const m of allMethods) row[m] = Number(methods[m] ?? 0);
      return row;
    });

  const transactions = payments.map(p => ({
    id: p.id,
    orderId: p.order.id,
    orderNumber: p.order.orderNumber,
    customerName: p.order.customer?.name ?? '',
    method: p.paymentMethod,
    amount: p.amount,
    reference: p.referenceNumber ?? '',
    date: p.createdAt.toISOString().split('T')[0],
    time: p.createdAt.toTimeString().slice(0, 5),
  })).reverse();

  return { summary, dailyTrend, allMethods, grandTotal, transactions };
}

export async function exportPaymentCsv(outletId: number, from: Date, to: Date): Promise<Buffer> {
  const { transactions } = await getPaymentMethodReport(outletId, from, to);
  const lines = ['Date,Time,Order #,Customer,Method,Amount,Reference'];
  for (const t of transactions) {
    lines.push(`${t.date},${t.time},${t.orderNumber},"${t.customerName}",${t.method},${t.amount},"${t.reference}"`);
  }
  return Buffer.from(lines.join('\n'));
}

// ─── Debtors Ledger (Sundry Debtors / Accounts Receivable) ───────────────────

function ageBuckets(dueDate: Date | null, outstanding: number, issueDate: Date) {
  const today = new Date();
  const ref = dueDate ?? new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const days = Math.floor((today.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  return {
    current:  days <= 0  ? outstanding : 0,
    days1_30: days > 0  && days <= 30  ? outstanding : 0,
    days31_60: days > 30 && days <= 60 ? outstanding : 0,
    days61_90: days > 60 && days <= 90 ? outstanding : 0,
    days90plus: days > 90              ? outstanding : 0,
  };
}

export async function getDebtorsLedger(outletId: number) {
  const invoices = await prisma.invoice.findMany({
    where: {
      outletId,
      status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
      customer: { isNot: null },
    },
    include: { customer: true },
    orderBy: { issueDate: 'asc' },
  });

  const partyMap: Record<number, {
    customerId: number; name: string; phone: string; gstin: string;
    totalInvoiced: number; totalPaid: number; outstanding: number;
    current: number; days1_30: number; days31_60: number; days61_90: number; days90plus: number;
    invoices: Array<{ invoiceNumber: string; issueDate: string; dueDate: string | null; totalAmount: number; paidAmount: number; outstanding: number; status: string; daysOverdue: number }>;
  }> = {};

  for (const inv of invoices) {
    if (!inv.customer) continue;
    const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
    if (outstanding <= 0) continue;

    const cid = inv.customerId!;
    if (!partyMap[cid]) {
      partyMap[cid] = {
        customerId: cid,
        name: inv.customer.name,
        phone: inv.customer.phone ?? '',
        gstin: inv.customer.gstin ?? '',
        totalInvoiced: 0, totalPaid: 0, outstanding: 0,
        current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0,
        invoices: [],
      };
    }

    const today = new Date();
    const ref = inv.dueDate ?? new Date(inv.issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.floor((today.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
    const buckets = ageBuckets(inv.dueDate, outstanding, inv.issueDate);

    const p = partyMap[cid];
    p.totalInvoiced += Number(inv.totalAmount);
    p.totalPaid     += Number(inv.paidAmount);
    p.outstanding   += outstanding;
    p.current       += buckets.current;
    p.days1_30      += buckets.days1_30;
    p.days31_60     += buckets.days31_60;
    p.days61_90     += buckets.days61_90;
    p.days90plus    += buckets.days90plus;
    p.invoices.push({
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate.toISOString().split('T')[0],
      dueDate: inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : null,
      totalAmount: Number(inv.totalAmount),
      paidAmount: Number(inv.paidAmount),
      outstanding,
      status: inv.status,
      daysOverdue: Math.max(0, daysOverdue),
    });
  }

  return Object.values(partyMap).sort((a, b) => b.outstanding - a.outstanding);
}

export async function exportDebtorsCsv(outletId: number): Promise<Buffer> {
  const rows = await getDebtorsLedger(outletId);
  const lines = [
    'Party Name,GSTIN,Phone,Total Invoiced,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days',
  ];
  for (const r of rows) {
    lines.push(
      `"${r.name}","${r.gstin}","${r.phone}",${r.totalInvoiced.toFixed(2)},${r.totalPaid.toFixed(2)},${r.outstanding.toFixed(2)},${r.current.toFixed(2)},${r.days1_30.toFixed(2)},${r.days31_60.toFixed(2)},${r.days61_90.toFixed(2)},${r.days90plus.toFixed(2)}`
    );
  }
  return Buffer.from(lines.join('\n'));
}

// ─── Creditors Ledger (Sundry Creditors / Accounts Payable) ──────────────────

export async function getCreditorsLedger(outletId: number) {
  const bills = await prisma.purchaseBill.findMany({
    where: {
      outletId,
      status: { in: ['UNPAID', 'PARTIAL'] },
    },
    include: { supplier: true },
    orderBy: { billDate: 'asc' },
  });

  const partyMap: Record<number, {
    supplierId: number; name: string; phone: string; gstin: string;
    totalBilled: number; totalPaid: number; outstanding: number;
    current: number; days1_30: number; days31_60: number; days61_90: number; days90plus: number;
    bills: Array<{ billNumber: string; billDate: string; dueDate: string | null; totalAmount: number; paidAmount: number; outstanding: number; status: string; daysOverdue: number }>;
  }> = {};

  for (const bill of bills) {
    const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
    if (outstanding <= 0) continue;

    const sid = bill.supplierId;
    if (!partyMap[sid]) {
      partyMap[sid] = {
        supplierId: sid,
        name: bill.supplier.name,
        phone: bill.supplier.phone ?? '',
        gstin: bill.supplier.gstin ?? '',
        totalBilled: 0, totalPaid: 0, outstanding: 0,
        current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0,
        bills: [],
      };
    }

    const today = new Date();
    const ref = bill.dueDate ?? new Date(bill.billDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.floor((today.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
    const buckets = ageBuckets(bill.dueDate, outstanding, bill.billDate);

    const p = partyMap[sid];
    p.totalBilled  += Number(bill.totalAmount);
    p.totalPaid    += Number(bill.paidAmount);
    p.outstanding  += outstanding;
    p.current      += buckets.current;
    p.days1_30     += buckets.days1_30;
    p.days31_60    += buckets.days31_60;
    p.days61_90    += buckets.days61_90;
    p.days90plus   += buckets.days90plus;
    p.bills.push({
      billNumber: bill.billNumber,
      billDate: bill.billDate.toISOString().split('T')[0],
      dueDate: bill.dueDate ? bill.dueDate.toISOString().split('T')[0] : null,
      totalAmount: Number(bill.totalAmount),
      paidAmount: Number(bill.paidAmount),
      outstanding,
      status: bill.status,
      daysOverdue: Math.max(0, daysOverdue),
    });
  }

  return Object.values(partyMap).sort((a, b) => b.outstanding - a.outstanding);
}

export async function exportCreditorsCsv(outletId: number): Promise<Buffer> {
  const rows = await getCreditorsLedger(outletId);
  const lines = [
    'Party Name,GSTIN,Phone,Total Billed,Total Paid,Outstanding,Current (0 days),1-30 Days,31-60 Days,61-90 Days,90+ Days',
  ];
  for (const r of rows) {
    lines.push(
      `"${r.name}","${r.gstin}","${r.phone}",${r.totalBilled.toFixed(2)},${r.totalPaid.toFixed(2)},${r.outstanding.toFixed(2)},${r.current.toFixed(2)},${r.days1_30.toFixed(2)},${r.days31_60.toFixed(2)},${r.days61_90.toFixed(2)},${r.days90plus.toFixed(2)}`
    );
  }
  return Buffer.from(lines.join('\n'));
}

export async function exportPurchaseCsv(outletId: number, from: Date, to: Date): Promise<Buffer> {
  const pos = await prisma.purchaseOrder.findMany({
    where: { outletId, createdAt: { gte: from, lte: to } },
    include: { supplier: true, items: { include: { product: true } } },
  });
  const lines = ['Date,PO Number,Supplier,Status,Total Amount'];
  for (const po of pos) {
    lines.push(
      `${po.createdAt.toISOString().split('T')[0]},${po.poNumber},"${po.supplier.name}",${po.status},${po.totalAmount}`
    );
  }
  return Buffer.from(lines.join('\n'));
}
