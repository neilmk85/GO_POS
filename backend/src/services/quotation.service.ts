import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateQuotationNumber } from '../utils/numberGenerator';

export async function create(data: {
  outletId: number;
  customerId?: number;
  validUntil?: Date;
  notes?: string;
  termsConditions?: string;
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
  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);

  const itemsData = data.items.map((item) => {
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

  const totalAmount = subtotal.minus(discountAmount).plus(taxAmount);

  return prisma.quotation.create({
    data: {
      quotationNumber: generateQuotationNumber(),
      outletId: data.outletId,
      customerId: data.customerId,
      validUntil: data.validUntil,
      notes: data.notes,
      termsConditions: data.termsConditions,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      status: 'DRAFT',
      items: {
        create: itemsData.map((it) => ({
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
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, outlet: true },
  });
  if (!q) throw new ResourceNotFoundException('Quotation', id);
  return q;
}

export async function getByOutlet(outletId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.quotation.findMany({
      where: { outletId },
      include: { items: true, customer: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.quotation.count({ where: { outletId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function update(id: number, data: Parameters<typeof create>[0]) {
  const q = await getById(id);
  if (q.status !== 'DRAFT') throw new BusinessException('Only DRAFT quotations can be updated');

  await prisma.quotationItem.deleteMany({ where: { quotationId: id } });

  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  let discountAmount = new Decimal(0);

  const itemsData = data.items.map((item) => {
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

  const totalAmount = subtotal.minus(discountAmount).plus(taxAmount);

  return prisma.quotation.update({
    where: { id },
    data: {
      customerId: data.customerId,
      validUntil: data.validUntil,
      notes: data.notes,
      termsConditions: data.termsConditions,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      items: {
        create: itemsData.map((it) => ({
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

export async function updateStatus(id: number, status: string) {
  return prisma.quotation.update({ where: { id }, data: { status: status as never } });
}

export async function deleteQuotation(id: number) {
  const q = await getById(id);
  if (q.status !== 'DRAFT') throw new BusinessException('Only DRAFT quotations can be deleted');
  await prisma.quotation.delete({ where: { id } });
}
