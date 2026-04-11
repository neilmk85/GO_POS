import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { generateBillNumber } from '../utils/numberGenerator';
import { Decimal } from '@prisma/client/runtime/library';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.post('/from-po/:poId', async (req: Request, res: Response) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: parseInt(req.params.poId) },
    include: { items: { include: { product: true } }, supplier: true },
  });
  if (!po) throw new ResourceNotFoundException('PurchaseOrder', parseInt(req.params.poId));

  const { vendorBillNumber, billDate, dueDate, notes, supplyType, vendorGstin } = req.body;
  const taxAmount = new Decimal(po.taxAmount.toString());
  const isIntra = (supplyType ?? 'INTRA_STATE') === 'INTRA_STATE';
  const cgstAmount = isIntra ? taxAmount.div(2).toDecimalPlaces(2) : new Decimal(0);
  const sgstAmount = isIntra ? taxAmount.minus(cgstAmount) : new Decimal(0);
  const igstAmount = isIntra ? new Decimal(0) : taxAmount;

  const bill = await prisma.purchaseBill.create({
    data: {
      billNumber: generateBillNumber(),
      supplierId: po.supplierId,
      outletId: po.outletId,
      sourcePoId: po.id,
      vendorBillNumber,
      billDate: billDate ? new Date(billDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      subtotal: po.subtotal,
      taxAmount: po.taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      supplyType: (supplyType ?? 'INTRA_STATE') as never,
      vendorGstin: vendorGstin ?? po.supplier?.gstin ?? undefined,
      totalAmount: po.totalAmount,
      notes: notes ?? po.notes,
      createdBy: req.user?.email,
      items: {
        create: po.items.map((item) => ({
          productId: item.productId,
          quantity: item.orderedQuantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: { items: { include: { product: true } }, supplier: true },
  });

  logActivity({ req, module: 'BILL', action: 'CREATED', entityId: bill.id, description: `Created purchase bill ${bill.billNumber} from PO — ₹${bill.totalAmount}` });
  res.json(successResponse({ id: bill.id, billNumber: bill.billNumber }, 'Bill created from PO'));
});

router.post('/:id/payment', async (req: Request, res: Response) => {
  const bill = await prisma.purchaseBill.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!bill) throw new ResourceNotFoundException('PurchaseBill', parseInt(req.params.id));

  const { amount } = req.body;
  const newPaid = new Decimal(bill.paidAmount.toString()).plus(amount);
  const newStatus = newPaid.greaterThanOrEqualTo(bill.totalAmount) ? 'PAID'
    : newPaid.greaterThan(0) ? 'PARTIAL'
    : bill.status;

  const updated = await prisma.purchaseBill.update({
    where: { id: bill.id },
    data: { paidAmount: newPaid, status: newStatus as never, updatedBy: req.user?.email },
  });

  logActivity({ req, module: 'BILL', action: 'UPDATED', entityId: bill.id, description: `Recorded payment of ₹${amount} for bill ID ${bill.id} — status: ${newStatus}` });
  res.json(successResponse({ id: updated.id, paidAmount: updated.paidAmount, status: updated.status }, 'Payment recorded'));
});

router.post('/', async (req: Request, res: Response) => {
  const { supplierId, outletId, items, billDate, dueDate, vendorBillNumber, notes, supplyType, vendorGstin } = req.body;
  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);

  const itemsData = (items as Array<{ productId: number; quantity: number; unitCost: number; taxRate?: number }>).map((it) => {
    const qty = new Decimal(it.quantity);
    const cost = new Decimal(it.unitCost);
    const taxRate = new Decimal(it.taxRate ?? 0);
    const lineSub = qty.mul(cost);
    const lineTax = lineSub.mul(taxRate).div(100).toDecimalPlaces(2);
    subtotal = subtotal.plus(lineSub);
    taxAmount = taxAmount.plus(lineTax);
    return { ...it, qty, cost, taxRate, lineTotal: lineSub.plus(lineTax) };
  });

  const isIntra = (supplyType ?? 'INTRA_STATE') === 'INTRA_STATE';
  const cgstAmount = isIntra ? taxAmount.div(2).toDecimalPlaces(2) : new Decimal(0);
  const sgstAmount = isIntra ? taxAmount.minus(cgstAmount) : new Decimal(0);
  const igstAmount = isIntra ? new Decimal(0) : taxAmount;

  const bill = await prisma.purchaseBill.create({
    data: {
      billNumber: generateBillNumber(),
      supplierId,
      outletId,
      vendorBillNumber,
      billDate: billDate ? new Date(billDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      subtotal,
      taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      supplyType: (supplyType ?? 'INTRA_STATE') as never,
      vendorGstin: vendorGstin ?? undefined,
      totalAmount: subtotal.plus(taxAmount),
      notes,
      createdBy: req.user?.email,
      items: {
        create: itemsData.map((it) => ({
          productId: it.productId,
          quantity: it.qty,
          unitCost: it.cost,
          taxRate: it.taxRate,
          lineTotal: it.lineTotal,
        })),
      },
    },
    include: { items: { include: { product: true } }, supplier: true },
  });

  logActivity({ req, module: 'BILL', action: 'CREATED', entityId: bill.id, description: `Created purchase bill ${bill.billNumber} — ₹${bill.totalAmount}` });
  res.json(successResponse({ id: bill.id, billNumber: bill.billNumber }, 'Bill created'));
});

router.get('/summary', async (req: Request, res: Response) => {
  const outletId = parseInt(req.query.outletId as string);
  const bills = await prisma.purchaseBill.findMany({ where: { outletId, status: { not: 'PAID' } } });
  const totalOutstanding = bills.reduce((s, b) => s.plus(new Decimal(b.totalAmount.toString()).minus(b.paidAmount)), new Decimal(0));
  res.json(successResponse({ totalOutstanding, unpaidCount: bills.length }));
});

router.get('/:id', async (req: Request, res: Response) => {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { items: { include: { product: true } }, supplier: true, sourcePo: true },
  });
  if (!bill) throw new ResourceNotFoundException('PurchaseBill', parseInt(req.params.id));
  res.json(successResponse(bill));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, from, to } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const where: Record<string, unknown> = { outletId: parseInt(outletId) };
  if (from && to) where['billDate'] = { gte: new Date(from), lte: new Date(to) };
  const [data, total] = await Promise.all([
    prisma.purchaseBill.findMany({
      where: where as never,
      include: { supplier: true, items: true },
      orderBy: { billDate: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.purchaseBill.count({ where: where as never }),
  ]);
  res.json(successResponse({ content: data, totalElements: total, page, size }));
});

router.delete('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.purchaseBill.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.purchaseBill.delete({ where: { id: parseInt(req.params.id) } });
  logActivity({ req, module: 'BILL', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted purchase bill ${existing?.billNumber ?? req.params.id}` });
  res.json(successResponse({ id: parseInt(req.params.id) }, 'Bill deleted'));
});

export default router;
