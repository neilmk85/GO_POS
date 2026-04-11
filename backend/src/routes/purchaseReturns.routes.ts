import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { generatePurchaseReturnNumber } from '../utils/numberGenerator';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  const { purchaseOrderId, outletId, items, reason, creditMethod, notes } = req.body;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: { include: { product: true } } },
  });
  if (!po) throw new ResourceNotFoundException('PurchaseOrder', purchaseOrderId);

  let totalAmount = new Decimal(0);
  const itemsData = (items as Array<{ productId: number; returnedQuantity: number; unitCost: number; purchaseOrderItemId?: number; productName?: string }>).map((it) => {
    const qty = new Decimal(it.returnedQuantity);
    const cost = new Decimal(it.unitCost);
    const lineTotal = qty.mul(cost);
    totalAmount = totalAmount.plus(lineTotal);
    return { ...it, qty, cost, lineTotal };
  });

  const ret = await prisma.purchaseReturn.create({
    data: {
      returnNumber: generatePurchaseReturnNumber(),
      purchaseOrderId,
      outletId,
      reason,
      creditMethod: creditMethod as never,
      totalAmount,
      notes,
      createdBy: req.user?.email,
      items: {
        create: itemsData.map((it) => ({
          productId: it.productId,
          purchaseOrderItemId: it.purchaseOrderItemId,
          productName: it.productName,
          returnedQuantity: it.qty,
          unitCost: it.cost,
          lineTotal: it.lineTotal,
        })),
      },
    },
    include: { items: { include: { product: true } }, purchaseOrder: { include: { supplier: true } } },
  });

  // Deduct inventory
  for (const item of itemsData) {
    await prisma.inventory.updateMany({
      where: { productId: item.productId, outletId },
      data: { quantityOnHand: { decrement: item.qty } },
    });
  }

  res.json(successResponse(ret, 'Purchase return created'));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId } = req.query as { outletId: string };
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const [data, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      where: { outletId: parseInt(outletId) },
      include: { items: { include: { product: true } }, purchaseOrder: { include: { supplier: true } } },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.purchaseReturn.count({ where: { outletId: parseInt(outletId) } }),
  ]);
  res.json(successResponse({ content: data, totalElements: total, page, size }));
});

router.get('/:id', async (req: Request, res: Response) => {
  const ret = await prisma.purchaseReturn.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { items: { include: { product: true } }, purchaseOrder: { include: { supplier: true } } },
  });
  if (!ret) throw new ResourceNotFoundException('PurchaseReturn', parseInt(req.params.id));
  res.json(successResponse(ret));
});

export default router;
