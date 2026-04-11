import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException } from '../utils/response';

export async function calculateItemDiscount(
  productId: number,
  quantity: Decimal,
  unitPrice: Decimal
): Promise<Decimal> {
  const now = new Date();
  const discounts = await prisma.discount.findMany({
    where: {
      active: true,
      OR: [
        { applyOn: 'PRODUCT', products: { some: { productId } } },
        { applyOn: 'CART' },
      ],
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { priority: 'desc' },
  });

  let bestDiscount = new Decimal(0);
  const lineTotal = unitPrice.mul(quantity);

  for (const d of discounts) {
    let discountAmount = new Decimal(0);
    if (d.valueType === 'PERCENTAGE') {
      discountAmount = lineTotal.mul(d.value).div(100).toDecimalPlaces(2);
    } else if (d.valueType === 'FLAT') {
      discountAmount = new Decimal(d.value.toString());
    }

    if (d.maxDiscountAmount && discountAmount.greaterThan(d.maxDiscountAmount)) {
      discountAmount = new Decimal(d.maxDiscountAmount.toString());
    }

    if (discountAmount.greaterThan(bestDiscount)) {
      bestDiscount = discountAmount;
    }
  }

  return bestDiscount;
}

export async function validateCoupon(code: string, orderAmount: Decimal, customerId: number | null) {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw new BusinessException(`Coupon not found: ${code}`);
  if (!coupon.active) throw new BusinessException('Coupon is not active');

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) throw new BusinessException('Coupon not yet valid');
  if (coupon.expiryDate && coupon.expiryDate < now) throw new BusinessException('Coupon has expired');
  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) throw new BusinessException('Coupon usage limit reached');
  if (orderAmount.lessThan(coupon.minOrderAmount)) {
    throw new BusinessException(`Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`);
  }
  if (coupon.customerId && coupon.customerId !== customerId) throw new BusinessException('Coupon not valid for this customer');
  return coupon;
}

export function applyCoupon(coupon: { valueType: string; value: Decimal; maxDiscountAmount: Decimal | null }, orderAmount: Decimal): Decimal {
  let discount = new Decimal(0);
  if (coupon.valueType === 'PERCENTAGE') {
    discount = orderAmount.mul(coupon.value).div(100).toDecimalPlaces(2);
  } else if (coupon.valueType === 'FLAT') {
    discount = new Decimal(coupon.value.toString());
  }

  if (coupon.maxDiscountAmount && discount.greaterThan(coupon.maxDiscountAmount)) {
    discount = new Decimal(coupon.maxDiscountAmount.toString());
  }

  return discount;
}

export async function markCouponUsed(code: string) {
  await prisma.coupon.update({
    where: { code },
    data: { timesUsed: { increment: 1 } },
  });
}

export async function getAllDiscounts() {
  return prisma.discount.findMany({
    include: { products: { include: { product: true } }, categories: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDiscountById(id: number) {
  return prisma.discount.findUnique({
    where: { id },
    include: { products: { include: { product: true } }, categories: { include: { category: true } } },
  });
}

export async function createDiscount(data: Record<string, unknown>) {
  const { productIds, categoryIds, ...rest } = data as {
    productIds?: number[];
    categoryIds?: number[];
    [key: string]: unknown;
  };
  const createData = {
    ...(rest as object),
    products: productIds ? { create: productIds.map((pid) => ({ productId: pid })) } : undefined,
    categories: categoryIds ? { create: categoryIds.map((cid) => ({ categoryId: cid })) } : undefined,
  };
  return prisma.discount.create({
    data: createData as never,
    include: { products: { include: { product: true } }, categories: { include: { category: true } } },
  });
}

export async function updateDiscount(id: number, data: Record<string, unknown>) {
  const { productIds, categoryIds, ...rest } = data as {
    productIds?: number[];
    categoryIds?: number[];
    [key: string]: unknown;
  };

  // Update product/category links
  if (productIds !== undefined) {
    await prisma.discountProduct.deleteMany({ where: { discountId: id } });
    if (productIds.length > 0) {
      await prisma.discountProduct.createMany({ data: productIds.map((pid) => ({ discountId: id, productId: pid })) });
    }
  }
  if (categoryIds !== undefined) {
    await prisma.discountCategory.deleteMany({ where: { discountId: id } });
    if (categoryIds.length > 0) {
      await prisma.discountCategory.createMany({ data: categoryIds.map((cid) => ({ discountId: id, categoryId: cid })) });
    }
  }

  return prisma.discount.update({
    where: { id },
    data: rest as never,
    include: { products: { include: { product: true } }, categories: { include: { category: true } } },
  });
}

export async function deleteDiscount(id: number) {
  await prisma.discount.delete({ where: { id } });
}

// Coupons
export async function getAllCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCoupon(data: Record<string, unknown>) {
  return prisma.coupon.create({ data: data as never });
}

export async function updateCoupon(id: number, data: Record<string, unknown>) {
  return prisma.coupon.update({ where: { id }, data: data as never });
}

export async function deleteCoupon(id: number) {
  await prisma.coupon.delete({ where: { id } });
}
