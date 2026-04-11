import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { successResponse, ResourceNotFoundException, BusinessException } from '../utils/response';
import { generateSONumber } from '../utils/numberGenerator';
import { Decimal } from '@prisma/client/runtime/library';
import { logActivity } from '../utils/activityLogger';
import { generateInvoiceNumber } from '../utils/numberGenerator';

const router = Router();
router.use(authenticate);

const SO_INCLUDE = {
  customer: true,
  outlet: true,
  createdByUser: true,
  items: {
    include: { product: { include: { taxGroup: true } }, variant: true },
    orderBy: { id: 'asc' as const },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcItems(items: Array<{
  productId: number; variantId?: number; productName: string; sku?: string;
  quantity: number; unitPrice: number; discountPercent?: number; taxRate?: number; notes?: string;
}>) {
  let subtotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let taxAmount = new Decimal(0);

  const mapped = items.map((it) => {
    const qty  = new Decimal(it.quantity);
    const price = new Decimal(it.unitPrice);
    const disc  = new Decimal(it.discountPercent ?? 0);
    const tax   = new Decimal(it.taxRate ?? 0);
    const lineSub  = qty.mul(price);
    const lineDisc = lineSub.mul(disc).div(100).toDecimalPlaces(2);
    const lineBase = lineSub.minus(lineDisc);
    const lineTax  = lineBase.mul(tax).div(100).toDecimalPlaces(2);
    const lineTotal = lineBase.plus(lineTax);
    subtotal       = subtotal.plus(lineSub);
    discountAmount = discountAmount.plus(lineDisc);
    taxAmount      = taxAmount.plus(lineTax);
    return { it, qty, price, disc, tax, lineDisc, lineTax, lineTotal };
  });

  return { mapped, subtotal, discountAmount, taxAmount };
}

// ── POST / — Create Sales Order ───────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const {
    customerId, outletId, customerPoNumber,
    orderDate, requiredDate,
    paymentTerms, shippingAddress, shippingCity, shippingState,
    notes, termsConditions, shippingAmount, advanceAmount,
    items,
  } = req.body;

  if (!customerId) throw new BusinessException('Customer is required');
  if (!items || !items.length) throw new BusinessException('At least one item is required');

  // Credit limit check
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new ResourceNotFoundException('Customer', customerId);
  if (customer.blacklisted) throw new BusinessException('Customer is blacklisted');

  const { mapped, subtotal, discountAmount, taxAmount } = calcItems(items);
  const shipping = new Decimal(shippingAmount ?? 0);
  const total = subtotal.minus(discountAmount).plus(taxAmount).plus(shipping);

  if (customer.creditLimit.gt(0)) {
    const available = customer.creditLimit.minus(customer.outstandingDue);
    if (total.gt(available)) {
      throw new BusinessException(
        `Order total ₹${total.toFixed(2)} exceeds available credit limit ₹${available.toFixed(2)}`
      );
    }
  }

  const so = await prisma.salesOrder.create({
    data: {
      soNumber: generateSONumber(),
      customerId,
      outletId: outletId ?? req.user?.outletId ?? 1,
      createdByUserId: req.user?.id,
      customerPoNumber,
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      paymentTerms,
      shippingAddress, shippingCity, shippingState,
      shippingAmount: shipping,
      advanceAmount: new Decimal(advanceAmount ?? 0),
      notes, termsConditions,
      subtotal, discountAmount, taxAmount,
      totalAmount: total,
      createdBy: req.user?.email,
      items: {
        create: mapped.map(({ it, qty, price, disc, lineDisc, lineTax, lineTotal }) => ({
          productId: it.productId,
          variantId: it.variantId ?? undefined,
          productName: it.productName,
          sku: it.sku,
          quantity: qty,
          unitPrice: price,
          discountPercent: disc,
          discountAmount: lineDisc,
          taxRate: new Decimal(it.taxRate ?? 0),
          taxAmount: lineTax,
          lineTotal,
          notes: it.notes,
        })),
      },
    },
    include: SO_INCLUDE,
  });

  logActivity({ req, module: 'SALES_ORDER', action: 'CREATED', entityId: so.id,
    description: `Created SO ${so.soNumber} for ${customer.name} — ₹${so.totalAmount}` });
  res.json(successResponse(so, `Sales Order ${so.soNumber} created`));
});

// ── GET / — List Sales Orders ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { outletId, status, customerId, from, to, search } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');

  const where: any = {};
  if (outletId) where.outletId = parseInt(outletId);
  if (status && status !== 'ALL') where.status = status;
  if (customerId) where.customerId = parseInt(customerId);
  if (from && to) where.orderDate = { gte: new Date(from), lte: new Date(to + 'T23:59:59') };
  if (search) {
    where.OR = [
      { soNumber: { contains: search, mode: 'insensitive' } },
      { customerPoNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: { customer: true, outlet: true, items: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.salesOrder.count({ where }),
  ]);
  res.json(successResponse({ content: data, totalElements: total, page, size }));
});

// ── GET /:id — Get by ID ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: SO_INCLUDE });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  res.json(successResponse(so));
});

// ── PUT /:id — Update (DRAFT only) ────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (so.status !== 'DRAFT') throw new BusinessException('Only DRAFT sales orders can be edited');

  const {
    customerId, customerPoNumber, orderDate, requiredDate,
    paymentTerms, shippingAddress, shippingCity, shippingState,
    notes, termsConditions, shippingAmount, advanceAmount, items,
  } = req.body;

  if (items) await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

  const { mapped, subtotal, discountAmount, taxAmount } = items
    ? calcItems(items)
    : { mapped: [], subtotal: so.subtotal, discountAmount: so.discountAmount, taxAmount: so.taxAmount };

  const shipping = new Decimal(shippingAmount ?? so.shippingAmount.toString());
  const total = subtotal.minus(discountAmount).plus(taxAmount).plus(shipping);

  const updated = await prisma.salesOrder.update({
    where: { id },
    data: {
      customerId: customerId ?? so.customerId,
      customerPoNumber: customerPoNumber ?? so.customerPoNumber,
      orderDate: orderDate ? new Date(orderDate) : so.orderDate,
      requiredDate: requiredDate ? new Date(requiredDate) : so.requiredDate,
      paymentTerms: paymentTerms ?? so.paymentTerms,
      shippingAddress: shippingAddress ?? so.shippingAddress,
      shippingCity: shippingCity ?? so.shippingCity,
      shippingState: shippingState ?? so.shippingState,
      notes: notes !== undefined ? notes : so.notes,
      termsConditions: termsConditions !== undefined ? termsConditions : so.termsConditions,
      shippingAmount: shipping,
      advanceAmount: new Decimal(advanceAmount ?? so.advanceAmount.toString()),
      subtotal, discountAmount, taxAmount, totalAmount: total,
      updatedBy: req.user?.email,
      items: items ? {
        create: mapped.map(({ it, qty, price, disc, lineDisc, lineTax, lineTotal }) => ({
          productId: it.productId,
          variantId: it.variantId ?? undefined,
          productName: it.productName,
          sku: it.sku,
          quantity: qty,
          unitPrice: price,
          discountPercent: disc,
          discountAmount: lineDisc,
          taxRate: new Decimal(it.taxRate ?? 0),
          taxAmount: lineTax,
          lineTotal,
          notes: it.notes,
        })),
      } : undefined,
    },
    include: SO_INCLUDE,
  });

  logActivity({ req, module: 'SALES_ORDER', action: 'UPDATED', entityId: id, description: `Updated SO ${so.soNumber}` });
  res.json(successResponse(updated, 'Sales Order updated'));
});

// ── PATCH /:id/confirm — DRAFT → CONFIRMED ────────────────────────────────────
router.patch('/:id/confirm', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: { items: true } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (so.status !== 'DRAFT') throw new BusinessException('Only DRAFT orders can be confirmed');

  const updated = await prisma.salesOrder.update({
    where: { id },
    data: { status: 'CONFIRMED', updatedBy: req.user?.email },
    include: SO_INCLUDE,
  });

  logActivity({ req, module: 'SALES_ORDER', action: 'CONFIRMED', entityId: id, description: `Confirmed SO ${so.soNumber}` });
  res.json(successResponse(updated, 'Sales Order confirmed'));
});

// ── PATCH /:id/deliver — Record delivery ──────────────────────────────────────
router.patch('/:id/deliver', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: { items: true } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (!['CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(so.status)) {
    throw new BusinessException('Order must be CONFIRMED or in processing to record delivery');
  }

  const { deliveredItems, deliveryDate } = req.body as {
    deliveredItems: { itemId: number; deliveredQty: number }[];
    deliveryDate?: string;
  };

  // Update each item's deliveredQuantity
  for (const d of deliveredItems) {
    const item = so.items.find(i => i.id === d.itemId);
    if (!item) continue;
    const newDelivered = new Decimal(item.deliveredQuantity.toString()).plus(d.deliveredQty);
    if (newDelivered.gt(item.quantity)) throw new BusinessException(`Delivered qty exceeds ordered qty for item ${item.productName}`);
    await prisma.salesOrderItem.update({ where: { id: d.itemId }, data: { deliveredQuantity: newDelivered } });
  }

  // Recompute status
  const refreshed = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
  const allDelivered = refreshed.every(i => new Decimal(i.deliveredQuantity.toString()).gte(i.quantity));
  const anyDelivered = refreshed.some(i => new Decimal(i.deliveredQuantity.toString()).gt(0));
  const newStatus = allDelivered ? 'DELIVERED' : anyDelivered ? 'PARTIALLY_DELIVERED' : so.status;

  const updated = await prisma.salesOrder.update({
    where: { id },
    data: { status: newStatus as never, deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(), updatedBy: req.user?.email },
    include: SO_INCLUDE,
  });

  logActivity({ req, module: 'SALES_ORDER', action: 'DELIVERED', entityId: id, description: `Delivery recorded for SO ${so.soNumber} — status: ${newStatus}` });
  res.json(successResponse(updated, 'Delivery recorded'));
});

// ── POST /:id/invoice — Generate Invoice from SO ──────────────────────────────
router.post('/:id/invoice', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id }, include: { items: true, customer: true, outlet: true } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (!['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(so.status)) {
    throw new BusinessException('Invoice can only be generated for confirmed or delivered orders');
  }

  const { dueDate, notes: invoiceNotes } = req.body;
  const invoiceNumber = await generateInvoiceNumber();

  // Invoiceable items = delivered but not yet invoiced
  const invoiceableItems = so.items.filter(i =>
    new Decimal(i.deliveredQuantity.toString()).minus(i.invoicedQuantity.toString()).gt(0)
  );

  if (!invoiceableItems.length) {
    // If no deliveries yet (e.g., service/digital), invoice all
    invoiceableItems.push(...so.items);
  }

  let subtotal = new Decimal(0);
  let discountAmount = new Decimal(0);
  let taxAmount = new Decimal(0);

  const invoiceItemsData = invoiceableItems.map(i => {
    const qty = new Decimal(i.deliveredQuantity.toString()).minus(i.invoicedQuantity.toString());
    const effQty = qty.lte(0) ? new Decimal(i.quantity.toString()) : qty;
    const lineBase = effQty.mul(i.unitPrice).minus(effQty.mul(i.unitPrice).mul(i.discountPercent).div(100));
    const lineTax  = lineBase.mul(i.taxRate).div(100).toDecimalPlaces(2);
    const lineTotal = lineBase.plus(lineTax);
    subtotal       = subtotal.plus(effQty.mul(i.unitPrice));
    discountAmount = discountAmount.plus(effQty.mul(i.unitPrice).mul(i.discountPercent).div(100));
    taxAmount      = taxAmount.plus(lineTax);
    return { i, effQty, lineBase, lineTax, lineTotal };
  });

  const invoiceTotal = subtotal.minus(discountAmount).plus(taxAmount).plus(so.shippingAmount);
  const advancePaid  = new Decimal(so.advanceAmount.toString());
  const invoiceStatus = advancePaid.gte(invoiceTotal) ? 'PAID' : advancePaid.gt(0) ? 'PARTIAL' : 'SENT';

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId: so.customerId,
      outletId: so.outletId,
      issueDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: invoiceStatus,
      subtotal,
      discountAmount,
      taxAmount,
      shippingAmount: so.shippingAmount,
      totalAmount: invoiceTotal,
      paidAmount: advancePaid,
      notes: invoiceNotes ?? so.notes,
      createdBy: req.user?.email,
      items: {
        create: invoiceItemsData.map(({ i, effQty, lineTotal }) => ({
          productId: i.productId,
          productName: i.productName,
          productSku: i.sku ?? undefined,
          quantity: effQty,
          unitPrice: i.unitPrice,
          discountPercent: i.discountPercent,
          taxRate: i.taxRate,
          lineTotal,
        })),
      },
    },
  });

  // Mark items as invoiced
  for (const { i, effQty } of invoiceItemsData) {
    await prisma.salesOrderItem.update({
      where: { id: i.id },
      data: { invoicedQuantity: new Decimal(i.invoicedQuantity.toString()).plus(effQty) },
    });
  }

  // Update SO status
  const refreshed = await prisma.salesOrderItem.findMany({ where: { salesOrderId: id } });
  const allInvoiced = refreshed.every(i => new Decimal(i.invoicedQuantity.toString()).gte(i.quantity));
  if (allInvoiced) {
    await prisma.salesOrder.update({ where: { id }, data: { status: 'INVOICED', updatedBy: req.user?.email } });
  }

  logActivity({ req, module: 'SALES_ORDER', action: 'INVOICED', entityId: id, description: `Invoice ${invoiceNumber} generated from SO ${so.soNumber}` });
  res.json(successResponse({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }, `Invoice ${invoiceNumber} created`));
});

// ── PATCH /:id/cancel ─────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (['DELIVERED', 'INVOICED'].includes(so.status)) throw new BusinessException('Cannot cancel a delivered or invoiced order');

  const updated = await prisma.salesOrder.update({
    where: { id },
    data: { status: 'CANCELLED', updatedBy: req.user?.email },
    include: SO_INCLUDE,
  });

  logActivity({ req, module: 'SALES_ORDER', action: 'CANCELLED', entityId: id, description: `Cancelled SO ${so.soNumber}` });
  res.json(successResponse(updated, 'Sales Order cancelled'));
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const so = await prisma.salesOrder.findUnique({ where: { id } });
  if (!so) throw new ResourceNotFoundException('SalesOrder', id);
  if (so.status !== 'DRAFT') throw new BusinessException('Only DRAFT sales orders can be deleted');
  await prisma.salesOrder.delete({ where: { id } });
  logActivity({ req, module: 'SALES_ORDER', action: 'DELETED', entityId: id, description: `Deleted SO ${so.soNumber}` });
  res.json(successResponse({ id }, 'Sales Order deleted'));
});

export default router;
