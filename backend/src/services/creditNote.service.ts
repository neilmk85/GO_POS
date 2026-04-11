import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateCreditNoteNumber } from '../utils/numberGenerator';

export async function createCreditNote(data: {
  customerId: number;
  originalOrderId?: number;
  outletId: number;
  totalAmount: Decimal;
  reason?: string;
  expiryDays?: number;
}) {
  const expiryDate = data.expiryDays
    ? new Date(Date.now() + data.expiryDays * 86400000)
    : null;

  return prisma.creditNote.create({
    data: {
      creditNoteNumber: generateCreditNoteNumber(),
      customerId: data.customerId,
      originalOrderId: data.originalOrderId,
      outletId: data.outletId,
      totalAmount: data.totalAmount,
      remainingAmount: data.totalAmount,
      usedAmount: new Decimal(0),
      expiryDate,
      reason: data.reason,
      status: 'ACTIVE',
    },
    include: { customer: true, outlet: true },
  });
}

export async function applyCreditNote(creditNoteId: number, amount: Decimal) {
  const cn = await prisma.creditNote.findUnique({ where: { id: creditNoteId } });
  if (!cn) throw new ResourceNotFoundException('CreditNote', creditNoteId);
  if (cn.status !== 'ACTIVE') throw new BusinessException('Credit note is not active');
  if (amount.greaterThan(cn.remainingAmount)) throw new BusinessException('Insufficient credit note balance');

  const newRemaining = new Decimal(cn.remainingAmount.toString()).minus(amount);
  const newUsed = new Decimal(cn.usedAmount.toString()).plus(amount);
  const newStatus = newRemaining.isZero() ? 'FULLY_USED' : 'ACTIVE';

  return prisma.creditNote.update({
    where: { id: creditNoteId },
    data: { usedAmount: newUsed, remainingAmount: newRemaining, status: newStatus as never },
  });
}

export async function getCreditNotesByCustomer(customerId: number) {
  return prisma.creditNote.findMany({
    where: { customerId },
    include: { customer: true, originalOrder: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function cancelCreditNote(id: number, reason: string) {
  const cn = await prisma.creditNote.findUnique({ where: { id } });
  if (!cn) throw new ResourceNotFoundException('CreditNote', id);
  if (cn.status !== 'ACTIVE') throw new BusinessException('Only active credit notes can be cancelled');
  return prisma.creditNote.update({
    where: { id },
    data: { status: 'CANCELLED' as never, notes: reason },
  });
}

export async function getAllCreditNotes(outletId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.creditNote.findMany({
      where: { outletId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.creditNote.count({ where: { outletId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}
