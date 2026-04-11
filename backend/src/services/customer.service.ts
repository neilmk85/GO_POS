import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';

export async function getAll(page = 0, size = 20, search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.customer.count({ where }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getById(id: number) {
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) throw new ResourceNotFoundException('Customer', id);
  return c;
}

export async function getByPhone(phone: string) {
  const c = await prisma.customer.findUnique({ where: { phone } });
  if (!c) throw new ResourceNotFoundException(`Customer with phone ${phone}`);
  return c;
}

export async function search(q: string) {
  return prisma.customer.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
  });
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  phone2?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  dateOfBirth?: Date;
  anniversaryDate?: Date;
  segment?: string;
  discountPercent?: number;
  creditLimit?: number;
}) {
  if (data.phone) {
    const exists = await prisma.customer.findUnique({ where: { phone: data.phone } });
    if (exists) throw new BusinessException(`Phone ${data.phone} already registered`);
  }
  return prisma.customer.create({ data: data as never });
}

export async function updateCustomer(id: number, data: Record<string, unknown>) {
  await getById(id);
  return prisma.customer.update({ where: { id }, data: data as never });
}

export async function addLoyaltyPoints(customerId: number, points: Decimal, orderId?: number, description?: string) {
  const customer = await getById(customerId);
  const newBalance = new Decimal(customer.loyaltyPoints.toString()).plus(points);
  await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: newBalance } });
  await prisma.loyaltyTransaction.create({
    data: {
      customerId,
      orderId,
      type: 'EARNED',
      points,
      balanceAfter: newBalance,
      description,
    },
  });
}

export async function redeemLoyaltyPoints(customerId: number, points: Decimal) {
  const customer = await getById(customerId);
  const current = new Decimal(customer.loyaltyPoints.toString());
  if (points.greaterThan(current)) throw new BusinessException('Insufficient loyalty points');
  const newBalance = current.minus(points);
  await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: newBalance } });
  await prisma.loyaltyTransaction.create({
    data: {
      customerId,
      type: 'REDEEMED',
      points: points.negated(),
      balanceAfter: newBalance,
      description: 'Points redeemed',
    },
  });
}

export async function updateTotalSpent(customerId: number, amount: Decimal) {
  await prisma.customer.update({
    where: { id: customerId },
    data: { totalSpent: { increment: amount } },
  });
}

export async function updateOutstandingDue(customerId: number, amount: Decimal) {
  await prisma.customer.update({
    where: { id: customerId },
    data: { outstandingDue: { increment: amount } },
  });
}

export async function getLoyaltyHistory(customerId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.loyaltyTransaction.count({ where: { customerId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getCustomersWithDues() {
  return prisma.customer.findMany({
    where: { outstandingDue: { gt: 0 } },
    orderBy: { outstandingDue: 'desc' },
  });
}
