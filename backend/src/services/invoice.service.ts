import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateInvoiceNumber } from '../utils/numberGenerator';

export async function createFromOrder(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, customer: true, outlet: true },
  });
  if (!order) throw new ResourceNotFoundException('Order', orderId);

  return prisma.invoice.create({
    data: {
      invoiceNumber: await generateInvoiceNumber(),
      orderId,
      customerId: order.customerId,
      outletId: order.outletId,
      issueDate: new Date(),
      status: 'PAID',
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      items: {
        create: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: { items: true, customer: true, outlet: true },
  });
}

export async function create(data: {
  outletId: number;
  customerId?: number;
  orderId?: number;
  issueDate: Date;
  dueDate?: Date;
  paymentTerms?: string;
  poNumber?: string;
  shippingAmount?: number;
  notes?: string;
  termsConditions?: string;
  billDiscountPct?: number;
  items: {
    productId?: number;
    productName: string;
    productSku?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    taxRate?: number;
  }[];
}) {
  if (!data.items || data.items.length === 0) throw new BusinessException('At least one item required');

  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);

  const items = data.items.map((item) => {
    const qty = new Decimal(item.quantity);
    const price = new Decimal(item.unitPrice);
    const discPct = new Decimal(item.discountPercent ?? 0);
    const taxRate = new Decimal(item.taxRate ?? 0);

    const lineSubtotal = qty.mul(price);
    const disc = lineSubtotal.mul(discPct).div(100).toDecimalPlaces(2);
    const lineAfterDisc = lineSubtotal.minus(disc);
    const tax = lineAfterDisc.mul(taxRate).div(100).toDecimalPlaces(2);
    const lineTotal = lineAfterDisc.plus(tax);

    subtotal = subtotal.plus(lineSubtotal);
    discountAmount = discountAmount.plus(disc);
    taxAmount = taxAmount.plus(tax);

    return { ...item, lineTotal };
  });

  // Apply bill-level discount
  const billDiscPct = new Decimal(data.billDiscountPct ?? 0);
  const billDiscAmt = subtotal.minus(discountAmount).mul(billDiscPct).div(100).toDecimalPlaces(2);
  discountAmount = discountAmount.plus(billDiscAmt);
  const shippingAmount = new Decimal(data.shippingAmount ?? 0);
  const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingAmount);

  return prisma.invoice.create({
    data: {
      invoiceNumber: await generateInvoiceNumber(),
      outletId: data.outletId,
      customerId: data.customerId,
      orderId: data.orderId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      paymentTerms: data.paymentTerms,
      poNumber: data.poNumber,
      shippingAmount,
      notes: data.notes,
      termsConditions: data.termsConditions,
      billDiscountPct: billDiscPct,
      billDiscountAmt: billDiscAmt,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      status: 'DRAFT',
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          productSku: it.productSku,
          quantity: new Decimal(it.quantity),
          unitPrice: new Decimal(it.unitPrice),
          discountPercent: new Decimal(it.discountPercent ?? 0),
          taxRate: new Decimal(it.taxRate ?? 0),
          lineTotal: it.lineTotal,
        })),
      },
    },
    include: { items: { include: { product: true } }, customer: true, outlet: true },
  });
}

export async function getById(id: number) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, outlet: true, order: true },
  });
  if (!inv) throw new ResourceNotFoundException('Invoice', id);
  return inv;
}

export async function getByInvoiceNumber(invoiceNumber: string) {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: { items: { include: { product: true } }, customer: true, outlet: true },
  });
  if (!inv) throw new ResourceNotFoundException(`Invoice not found: ${invoiceNumber}`);
  return inv;
}

export async function getByOutlet(
  outletId: number,
  status?: string,
  fromDate?: Date,
  toDate?: Date,
  page = 0,
  size = 20
) {
  const where: Record<string, unknown> = { outletId };
  if (status) where['status'] = status;
  if (fromDate || toDate) {
    where['issueDate'] = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where: where as never,
      include: { items: true, customer: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.invoice.count({ where: where as never }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function update(id: number, data: Parameters<typeof create>[0]) {
  const inv = await getById(id);
  if (inv.status !== 'DRAFT') throw new BusinessException('Only DRAFT invoices can be updated');

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);

  const items = data.items.map((item) => {
    const qty = new Decimal(item.quantity);
    const price = new Decimal(item.unitPrice);
    const discPct = new Decimal(item.discountPercent ?? 0);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSubtotal = qty.mul(price);
    const disc = lineSubtotal.mul(discPct).div(100).toDecimalPlaces(2);
    const lineAfterDisc = lineSubtotal.minus(disc);
    const tax = lineAfterDisc.mul(taxRate).div(100).toDecimalPlaces(2);
    const lineTotal = lineAfterDisc.plus(tax);
    subtotal = subtotal.plus(lineSubtotal);
    discountAmount = discountAmount.plus(disc);
    taxAmount = taxAmount.plus(tax);
    return { ...item, lineTotal };
  });

  const billDiscPct = new Decimal(data.billDiscountPct ?? 0);
  const billDiscAmt = subtotal.minus(discountAmount).mul(billDiscPct).div(100).toDecimalPlaces(2);
  discountAmount = discountAmount.plus(billDiscAmt);
  const shippingAmount = new Decimal(data.shippingAmount ?? 0);
  const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingAmount);

  return prisma.invoice.update({
    where: { id },
    data: {
      customerId: data.customerId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      paymentTerms: data.paymentTerms,
      poNumber: data.poNumber,
      shippingAmount,
      notes: data.notes,
      termsConditions: data.termsConditions,
      billDiscountPct: billDiscPct,
      billDiscountAmt: billDiscAmt,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          productSku: it.productSku,
          quantity: new Decimal(it.quantity),
          unitPrice: new Decimal(it.unitPrice),
          discountPercent: new Decimal(it.discountPercent ?? 0),
          taxRate: new Decimal(it.taxRate ?? 0),
          lineTotal: it.lineTotal,
        })),
      },
    },
    include: { items: { include: { product: true } }, customer: true, outlet: true },
  });
}

export async function deleteInvoice(id: number) {
  const inv = await getById(id);
  if (inv.status !== 'DRAFT') throw new BusinessException('Only DRAFT invoices can be deleted');
  await prisma.invoice.delete({ where: { id } });
}

export async function updateStatus(id: number, status: string) {
  return prisma.invoice.update({
    where: { id },
    data: { status: status as never },
  });
}

export async function recordPayment(id: number, amount: number) {
  const inv = await getById(id);
  const newPaid = new Decimal(inv.paidAmount.toString()).plus(amount);
  const newStatus = newPaid.greaterThanOrEqualTo(inv.totalAmount) ? 'PAID'
    : newPaid.greaterThan(0) ? 'PARTIAL'
    : inv.status;
  return prisma.invoice.update({
    where: { id },
    data: { paidAmount: newPaid, status: newStatus as never },
  });
}
