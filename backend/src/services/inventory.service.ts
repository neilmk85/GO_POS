import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateTransferNumber } from '../utils/numberGenerator';

export async function getStock(productId: number, outletId: number) {
  const inv = await prisma.inventory.findFirst({
    where: { productId, outletId, variantId: null },
    include: { product: { include: { category: true, taxGroup: true } }, outlet: true },
  });
  if (!inv) throw new ResourceNotFoundException(`Inventory for product ${productId} at outlet ${outletId}`);
  return inv;
}

export async function getStockAcrossOutlets(productId: number) {
  return prisma.inventory.findMany({
    where: { productId },
    include: { outlet: true, variant: true },
  });
}

export async function getAllByOutlet(outletId: number) {
  return prisma.inventory.findMany({
    where: { outletId },
    include: { product: { include: { category: true } }, variant: true },
    orderBy: { product: { name: 'asc' } },
  });
}

export async function getLowStockByOutlet(outletId: number) {
  return prisma.$queryRaw<unknown[]>`
    SELECT i.*, p.name as product_name, p.sku, p.reorder_level as product_reorder_level
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    WHERE i.outlet_id = ${outletId}
    AND i.quantity_on_hand <= i.reorder_level
    AND p.track_inventory = true
    ORDER BY i.quantity_on_hand ASC
  `;
}

export async function deductStock(
  productId: number,
  variantId: number | null,
  outletId: number,
  quantity: Decimal,
  factor: Decimal
) {
  const deductQty = quantity.mul(factor);

  let inv = await prisma.inventory.findFirst({
    where: { productId, variantId: variantId ?? null, outletId },
  });

  if (!inv) {
    // Create inventory record with 0 stock (will go negative if allowed)
    inv = await prisma.inventory.create({
      data: { productId, variantId, outletId, quantityOnHand: new Decimal(0), lastStockUpdate: new Date() },
    });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  const newQty = new Decimal(inv.quantityOnHand.toString()).minus(deductQty);

  if (newQty.lessThan(0) && !product?.allowNegativeStock) {
    throw new BusinessException(`Insufficient stock for product: ${product?.name ?? productId}`);
  }

  await prisma.inventory.update({
    where: { id: inv.id },
    data: { quantityOnHand: newQty, lastStockUpdate: new Date() },
  });
}

export async function adjustStock(
  productId: number,
  outletId: number,
  quantity: number,
  reason: string,
  notes?: string,
  userId?: number
) {
  let inv = await prisma.inventory.findFirst({ where: { productId, outletId } });
  if (!inv) {
    inv = await prisma.inventory.create({
      data: { productId, outletId, quantityOnHand: new Decimal(0), lastStockUpdate: new Date() },
    });
  }

  const before = new Decimal(inv.quantityOnHand.toString());
  const adjustment = new Decimal(quantity);
  const after = before.plus(adjustment);

  await prisma.inventory.update({
    where: { id: inv.id },
    data: { quantityOnHand: after, lastStockUpdate: new Date() },
  });

  await prisma.stockAdjustment.create({
    data: {
      productId,
      outletId,
      adjustedById: userId,
      quantityBefore: before,
      adjustmentQuantity: adjustment,
      quantityAfter: after,
      reason: reason as never,
      notes,
    },
  });

  return prisma.inventory.findUnique({
    where: { id: inv.id },
    include: { product: true, outlet: true },
  });
}

export async function getAdjustments(outletId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { outletId },
      include: { product: true, adjustedBy: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.stockAdjustment.count({ where: { outletId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function createTransfer(
  fromOutletId: number,
  toOutletId: number,
  items: { productId: number; variantId?: number; quantity: number }[],
  notes?: string,
  requestedById?: number
) {
  if (fromOutletId === toOutletId) throw new BusinessException('From and To outlet cannot be the same');

  return prisma.stockTransfer.create({
    data: {
      transferNumber: generateTransferNumber(),
      fromOutletId,
      toOutletId,
      requestedById,
      notes,
      status: 'REQUESTED',
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          requestedQuantity: new Decimal(it.quantity),
        })),
      },
    },
    include: { items: { include: { product: true } }, fromOutlet: true, toOutlet: true },
  });
}

export async function approveTransfer(id: number, approvedById: number) {
  const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!transfer) throw new ResourceNotFoundException('StockTransfer', id);
  if (transfer.status !== 'REQUESTED') throw new BusinessException('Transfer is not in REQUESTED state');

  return prisma.stockTransfer.update({
    where: { id },
    data: { status: 'APPROVED', approvedById },
    include: { items: true, fromOutlet: true, toOutlet: true },
  });
}

export async function shipTransfer(id: number) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });
  if (!transfer) throw new ResourceNotFoundException('StockTransfer', id);
  if (transfer.status !== 'APPROVED') throw new BusinessException('Transfer must be APPROVED before shipping');

  // Deduct from source
  for (const item of transfer.items) {
    await deductStock(
      item.productId,
      item.variantId,
      transfer.fromOutletId,
      item.requestedQuantity,
      new Decimal(1)
    );
    await prisma.stockTransferItem.update({
      where: { id: item.id },
      data: { shippedQuantity: item.requestedQuantity },
    });
  }

  return prisma.stockTransfer.update({
    where: { id },
    data: { status: 'IN_TRANSIT' },
    include: { items: true, fromOutlet: true, toOutlet: true },
  });
}

export async function receiveTransfer(
  id: number,
  receivedItems: { transferItemId: number; receivedQuantity: number }[],
  receivedById?: number
) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer) throw new ResourceNotFoundException('StockTransfer', id);

  for (const recv of receivedItems) {
    const item = transfer.items.find((i) => i.id === recv.transferItemId);
    if (!item) continue;

    const qty = new Decimal(recv.receivedQuantity);
    // Add to destination
    const destInv = await prisma.inventory.findFirst({
      where: { productId: item.productId, outletId: transfer.toOutletId },
    });
    if (destInv) {
      await prisma.inventory.update({
        where: { id: destInv.id },
        data: { quantityOnHand: new Decimal(destInv.quantityOnHand.toString()).plus(qty), lastStockUpdate: new Date() },
      });
    } else {
      await prisma.inventory.create({
        data: { productId: item.productId, outletId: transfer.toOutletId, quantityOnHand: qty, lastStockUpdate: new Date() },
      });
    }

    await prisma.stockTransferItem.update({
      where: { id: item.id },
      data: { receivedQuantity: qty },
    });
  }

  return prisma.stockTransfer.update({
    where: { id },
    data: { status: 'RECEIVED', receivedById },
    include: { items: { include: { product: true } }, fromOutlet: true, toOutlet: true },
  });
}

export async function getTransfers(outletId: number, page = 0, size = 20) {
  const where = {
    OR: [{ fromOutletId: outletId }, { toOutletId: outletId }],
  };
  const [data, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      include: { items: { include: { product: true } }, fromOutlet: true, toOutlet: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.stockTransfer.count({ where }),
  ]);
  return { content: data, totalElements: total, page, size };
}
