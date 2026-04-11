import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { successResponse, ResourceNotFoundException, BusinessException } from '../utils/response';
import { generatePONumber } from '../utils/numberGenerator';
import { Decimal } from '@prisma/client/runtime/library';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.post('/direct', async (req: Request, res: Response) => {
  // Direct purchase - PO received immediately, stock updated
  const { supplierId, outletId, items, notes } = req.body;
  const poNumber = generatePONumber();

  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);

  const itemsData = (items as Array<{
    productId: number;
    quantity: number;
    unitCost: number;
    taxRate?: number;
  }>).map((item) => {
    const qty = new Decimal(item.quantity);
    const cost = new Decimal(item.unitCost);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSub = qty.mul(cost);
    const lineTax = lineSub.mul(taxRate).div(100).toDecimalPlaces(2);
    subtotal = subtotal.plus(lineSub);
    taxAmount = taxAmount.plus(lineTax);
    return { ...item, qty, cost, taxRate, lineSub, lineTax, lineTotal: lineSub.plus(lineTax) };
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId,
      outletId,
      createdByUserId: req.user?.id,
      status: 'RECEIVED',
      receivedDate: new Date(),
      subtotal,
      taxAmount,
      totalAmount: subtotal.plus(taxAmount),
      notes,
      items: {
        create: itemsData.map((it) => ({
          productId: it.productId,
          orderedQuantity: it.qty,
          receivedQuantity: it.qty,
          unitCost: it.cost,
          taxRate: it.taxRate,
          lineTotal: it.lineTotal,
        })),
      },
      createdBy: req.user?.email,
    },
    include: { items: { include: { product: true } }, supplier: true },
  });

  // Update inventory for all items
  for (const item of itemsData) {
    const inv = await prisma.inventory.findFirst({ where: { productId: item.productId, outletId } });
    if (inv) {
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { quantityOnHand: new Decimal(inv.quantityOnHand.toString()).plus(item.qty), lastStockUpdate: new Date() },
      });
    } else {
      await prisma.inventory.create({
        data: { productId: item.productId, outletId, quantityOnHand: item.qty, lastStockUpdate: new Date() },
      });
    }
  }

  logActivity({ req, module: 'PURCHASE', action: 'CREATED', entityId: po.id, description: `Direct purchase ${po.poNumber} — ₹${po.totalAmount}, ${itemsData.length} item(s)` });
  res.json(successResponse({ id: po.id, poNumber: po.poNumber }, 'Purchase recorded successfully'));
});

router.post('/', async (req: Request, res: Response) => {
  const { supplierId, outletId, items, notes, expectedDate } = req.body;
  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);

  const itemsData = (items as Array<{
    productId: number;
    quantity: number;
    unitCost: number;
    taxRate?: number;
  }>).map((item) => {
    const qty = new Decimal(item.quantity);
    const cost = new Decimal(item.unitCost);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSub = qty.mul(cost);
    const lineTax = lineSub.mul(taxRate).div(100).toDecimalPlaces(2);
    subtotal = subtotal.plus(lineSub);
    taxAmount = taxAmount.plus(lineTax);
    return { ...item, qty, cost, taxRate, lineTotal: lineSub.plus(lineTax) };
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: generatePONumber(),
      supplierId,
      outletId,
      createdByUserId: req.user?.id,
      status: 'DRAFT',
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      subtotal,
      taxAmount,
      totalAmount: subtotal.plus(taxAmount),
      notes,
      items: {
        create: itemsData.map((it) => ({
          productId: it.productId,
          orderedQuantity: it.qty,
          receivedQuantity: new Decimal(0),
          unitCost: it.cost,
          taxRate: it.taxRate,
          lineTotal: it.lineTotal,
        })),
      },
      createdBy: req.user?.email,
    },
    include: { items: { include: { product: true } }, supplier: true },
  });

  logActivity({ req, module: 'PURCHASE_ORDER', action: 'CREATED', entityId: po.id, description: `Created PO ${po.poNumber} — ₹${po.totalAmount}, ${itemsData.length} item(s)` });
  res.json(successResponse({ id: po.id, poNumber: po.poNumber }, 'Purchase order created'));
});

router.put('/:id', async (req: Request, res: Response) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!po) throw new ResourceNotFoundException('PurchaseOrder', parseInt(req.params.id));
  if (po.status === 'RECEIVED') throw new BusinessException('Cannot update a received purchase order');

  const { items, notes, expectedDate, status } = req.body;
  if (items) {
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      status: status ?? po.status,
      expectedDate: expectedDate ? new Date(expectedDate) : po.expectedDate,
      notes: notes ?? po.notes,
      updatedBy: req.user?.email,
      items: items ? {
        create: (items as Array<{ productId: number; quantity: number; unitCost: number; taxRate?: number }>).map((it) => ({
          productId: it.productId,
          orderedQuantity: new Decimal(it.quantity),
          receivedQuantity: new Decimal(0),
          unitCost: new Decimal(it.unitCost),
          taxRate: new Decimal(it.taxRate ?? 0),
          lineTotal: new Decimal(it.quantity).mul(it.unitCost),
        })),
      } : undefined,
    },
    include: { items: { include: { product: true } }, supplier: true },
  });

  logActivity({ req, module: 'PURCHASE_ORDER', action: 'UPDATED', entityId: updated.id, description: `Updated PO ${updated.poNumber}` });
  res.json(successResponse({ id: updated.id, poNumber: updated.poNumber }, 'Purchase order updated'));
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.query as { status: string };
  const po = await prisma.purchaseOrder.update({
    where: { id: parseInt(req.params.id) },
    data: { status: status as never, updatedBy: req.user?.email },
  });
  res.json(successResponse({ id: po.id, status: po.status }, 'Status updated'));
});

router.delete('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.purchaseOrder.delete({ where: { id: parseInt(req.params.id) } });
  logActivity({ req, module: 'PURCHASE_ORDER', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted PO ${existing?.poNumber ?? req.params.id}` });
  res.json(successResponse({ id: parseInt(req.params.id) }, 'Purchase order deleted'));
});

router.get('/:poNumber', async (req: Request, res: Response) => {
  // Try by ID first, then by PO number
  const id = parseInt(req.params.poNumber);
  let po;
  if (!isNaN(id)) {
    po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, supplier: true },
    });
  } else {
    po = await prisma.purchaseOrder.findUnique({
      where: { poNumber: req.params.poNumber },
      include: { items: { include: { product: true } }, supplier: true },
    });
  }
  if (!po) throw new ResourceNotFoundException('PurchaseOrder', req.params.poNumber);
  res.json(successResponse(po));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, from, to } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const where: Record<string, unknown> = { outletId: parseInt(outletId) };
  if (from && to) {
    where['createdAt'] = { gte: new Date(from), lte: new Date(to + 'T23:59:59') };
  }
  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: where as never,
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.purchaseOrder.count({ where: where as never }),
  ]);
  res.json(successResponse({ content: data, totalElements: total, page, size }));
});

export default router;
