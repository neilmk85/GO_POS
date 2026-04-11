import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateBulkPurchaseNumber } from '../utils/numberGenerator';

export async function recordPurchase(
  productId: number,
  outletId: number,
  purchaseQty: number,
  costPerUnit?: number,
  supplier?: string,
  invoiceNumber?: string,
  purchaseDate?: Date,
  notes?: string
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ResourceNotFoundException('Product', productId);

  const purchaseFactor = product.purchaseFactor ?? new Decimal(1);
  const purchaseQtyDec = new Decimal(purchaseQty);
  const baseQty = purchaseQtyDec.mul(purchaseFactor);
  const totalCost = costPerUnit ? new Decimal(costPerUnit).mul(purchaseQtyDec) : null;

  // Add to inventory
  const existing = await prisma.inventory.findFirst({ where: { productId, outletId } });
  if (existing) {
    await prisma.inventory.update({
      where: { id: existing.id },
      data: { quantityOnHand: new Decimal(existing.quantityOnHand.toString()).plus(baseQty), lastStockUpdate: new Date() },
    });
  } else {
    await prisma.inventory.create({
      data: { productId, outletId, quantityOnHand: baseQty, lastStockUpdate: new Date() },
    });
  }

  return prisma.bulkPurchase.create({
    data: {
      referenceNumber: generateBulkPurchaseNumber(),
      productId,
      outletId,
      purchaseUom: product.purchaseUom,
      purchaseQty: purchaseQtyDec,
      purchaseFactor,
      baseQty,
      baseUom: product.unitOfMeasure,
      costPerUnit: costPerUnit ? new Decimal(costPerUnit) : null,
      totalCost,
      supplier,
      invoiceNumber,
      purchaseDate: purchaseDate ?? new Date(),
      notes,
      conversionStatus: 'NOT_CONVERTED',
    },
    include: { product: true, outlet: true },
  });
}

export async function getHistory(outletId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.bulkPurchase.findMany({
      where: { outletId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.bulkPurchase.count({ where: { outletId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getHistoryByDate(outletId: number, from: Date, to: Date, page = 0, size = 20) {
  const where = { outletId, purchaseDate: { gte: from, lte: to } };
  const [data, total] = await Promise.all([
    prisma.bulkPurchase.findMany({
      where,
      include: { product: true },
      orderBy: { purchaseDate: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.bulkPurchase.count({ where }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getHistoryByProduct(productId: number, outletId: number) {
  return prisma.bulkPurchase.findMany({
    where: { productId, outletId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateConversionStatus(id: number, status: string) {
  return prisma.bulkPurchase.update({
    where: { id },
    data: { conversionStatus: status as never },
  });
}

export async function convert(
  bulkPurchaseId: number,
  targetProductId: number,
  fromBaseQty: number,
  saleQty: number,
  saleUom?: string,
  notes?: string
) {
  const bp = await prisma.bulkPurchase.findUnique({ where: { id: bulkPurchaseId }, include: { product: true } });
  if (!bp) throw new ResourceNotFoundException('BulkPurchase', bulkPurchaseId);

  const available = new Decimal(bp.baseQty?.toString() ?? 0).minus(bp.convertedBaseQty ?? 0);
  const fromQty = new Decimal(fromBaseQty);
  if (fromQty.greaterThan(available)) throw new BusinessException(`Insufficient base quantity. Available: ${available}`);

  // Add to target product inventory
  const inv = await prisma.inventory.findFirst({ where: { productId: targetProductId, outletId: bp.outletId } });
  const saleQtyDec = new Decimal(saleQty);
  if (inv) {
    await prisma.inventory.update({
      where: { id: inv.id },
      data: { quantityOnHand: new Decimal(inv.quantityOnHand.toString()).plus(saleQtyDec), lastStockUpdate: new Date() },
    });
  } else {
    await prisma.inventory.create({
      data: { productId: targetProductId, outletId: bp.outletId, quantityOnHand: saleQtyDec, lastStockUpdate: new Date() },
    });
  }

  const newConverted = new Decimal((bp.convertedBaseQty ?? 0).toString()).plus(fromQty);
  const newStatus = newConverted.greaterThanOrEqualTo(bp.baseQty ?? 0) ? 'CONVERTED' : 'PARTIALLY_CONVERTED';

  await prisma.bulkPurchase.update({
    where: { id: bulkPurchaseId },
    data: { convertedBaseQty: newConverted, conversionStatus: newStatus as never },
  });

  return prisma.bulkPurchaseConversion.create({
    data: {
      bulkPurchaseId,
      targetProductId,
      outletId: bp.outletId,
      fromBaseQty: fromQty,
      saleQty: saleQtyDec,
      saleUom,
      notes,
    },
    include: { bulkPurchase: true, targetProduct: true },
  });
}

export async function getConversions(bulkPurchaseId: number) {
  return prisma.bulkPurchaseConversion.findMany({
    where: { bulkPurchaseId },
    include: { targetProduct: true },
    orderBy: { convertedAt: 'desc' },
  });
}

export async function getTodayStats(outletId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayPurchases, allPurchases] = await Promise.all([
    prisma.bulkPurchase.findMany({
      where: { outletId, purchaseDate: { gte: today, lt: tomorrow } },
    }),
    prisma.bulkPurchase.findMany({ where: { outletId } }),
  ]);

  const todayTotal = todayPurchases.reduce((s, bp) => s.plus(bp.totalCost ?? 0), new Decimal(0));
  const allTotal = allPurchases.reduce((s, bp) => s.plus(bp.totalCost ?? 0), new Decimal(0));

  return {
    todayCount: todayPurchases.length,
    todayTotal,
    allTimeCount: allPurchases.length,
    allTimeTotal: allTotal,
  };
}
