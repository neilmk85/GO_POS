import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';

export async function openShift(outletId: number, cashierId: number, openingCash: number) {
  // Check no open shift exists
  const existing = await prisma.shift.findFirst({
    where: { outletId, cashierId, status: 'OPEN' },
  });
  if (existing) throw new BusinessException('A shift is already open for this cashier');

  return prisma.shift.create({
    data: {
      outletId,
      cashierId,
      openedAt: new Date(),
      openingCash: new Decimal(openingCash),
      status: 'OPEN',
    },
    include: { outlet: true, cashier: true },
  });
}

export async function closeShift(shiftId: number, closingCash: number, notes?: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { orders: true },
  });
  if (!shift) throw new ResourceNotFoundException('Shift', shiftId);
  if (shift.status !== 'OPEN') throw new BusinessException('Shift is not open');

  const closingCashDec = new Decimal(closingCash);
  const variance = closingCashDec.minus(shift.expectedCash);

  return prisma.shift.update({
    where: { id: shiftId },
    data: {
      closedAt: new Date(),
      closingCash: closingCashDec,
      cashVariance: variance,
      status: 'CLOSED',
      notes,
    },
    include: { outlet: true, cashier: true },
  });
}

export async function getCurrentShift(cashierId: number) {
  return prisma.shift.findFirst({
    where: { cashierId, status: 'OPEN' },
    include: { outlet: true, cashier: true },
  });
}

export async function getShiftsByOutlet(outletId: number) {
  return prisma.shift.findMany({
    where: { outletId },
    include: { cashier: true },
    orderBy: { openedAt: 'desc' },
  });
}

export async function updateShiftTotals(shiftId: number, saleAmount: Decimal, discountAmount: Decimal) {
  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      totalSales: { increment: saleAmount },
      totalOrders: { increment: 1 },
      totalDiscounts: { increment: discountAmount },
      expectedCash: { increment: saleAmount },
    },
  });
}
