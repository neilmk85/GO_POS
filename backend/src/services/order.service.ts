import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';
import { BusinessException, ResourceNotFoundException } from '../utils/response';
import { generateOrderNumber } from '../utils/numberGenerator';
import * as inventoryService from './inventory.service';
import * as discountService from './discount.service';
import * as customerService from './customer.service';
import * as shiftService from './shift.service';
import * as creditNoteService from './creditNote.service';
import * as invoiceService from './invoice.service';

export interface CartItemRequest {
  productId: number;
  variantId?: number;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
  notes?: string;
}

export interface PaymentRequest {
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  creditNoteId?: number;
}

export interface CheckoutRequest {
  outletId: number;
  cashierId: number;
  shiftId?: number;
  customerId?: number;
  items: CartItemRequest[];
  payments: PaymentRequest[];
  couponCode?: string;
  billDiscountAmount?: number;
  billDiscountPercent?: number;
  loyaltyPointsToRedeem?: number;
  discountReason?: string;
  notes?: string;
  sendEmailReceipt?: boolean;
  sendSmsReceipt?: boolean;
  sendWhatsappReceipt?: boolean;
}

export interface ReturnItemRequest {
  orderItemId: number;
  returnQuantity: number;
  reason?: string;
}

export interface ReturnRequest {
  originalOrderId: number;
  items: ReturnItemRequest[];
  returnMethod?: string;
  reason?: string;
  notes?: string;
}

function d(n: number | Decimal | null | undefined): Decimal {
  if (n instanceof Decimal) return n;
  return new Decimal(n ?? 0);
}

export async function checkout(req: CheckoutRequest, activitySetter?: (desc: string) => void) {
  const outlet = await prisma.outlet.findUnique({ where: { id: req.outletId } });
  if (!outlet) throw new ResourceNotFoundException('Outlet', req.outletId);

  const cashier = await prisma.user.findUnique({ where: { id: req.cashierId } });
  if (!cashier) throw new ResourceNotFoundException('User', req.cashierId);

  const customer = req.customerId
    ? await prisma.customer.findUnique({ where: { id: req.customerId } })
    : null;

  const shift = req.shiftId
    ? await prisma.shift.findUnique({ where: { id: req.shiftId } })
    : null;

  // Build order items
  let subtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);

  const itemData: {
    productId: number;
    variantId?: number;
    productName: string;
    variantName?: string;
    sku?: string;
    quantity: Decimal;
    unitPrice: Decimal;
    costPrice?: Decimal;
    discountAmount: Decimal;
    taxRate: Decimal;
    taxAmount: Decimal;
    lineTotal: Decimal;
    notes?: string;
  }[] = [];

  for (const itemReq of req.items) {
    const product = await prisma.product.findUnique({
      where: { id: itemReq.productId },
      include: { taxGroup: true, category: true },
    });
    if (!product) throw new ResourceNotFoundException('Product', itemReq.productId);

    // Resolve price: explicit override → price list → product default
    let resolvedPrice = d(product.sellingPrice);
    if (customer) {
      const now = new Date();
      const applicableLists = await prisma.priceList.findMany({
        where: {
          active: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
          OR: [
            { segments: { some: { segment: customer.segment } } },
            { customers: { some: { customerId: customer.id } } },
          ],
        },
        include: { items: true },
        orderBy: { priority: 'desc' },
      });
      for (const pl of applicableLists) {
        const item = itemReq.variantId
          ? pl.items.find(i => i.productId === product.id && i.variantId === itemReq.variantId)
            ?? pl.items.find(i => i.productId === product.id && i.variantId === null)
          : pl.items.find(i => i.productId === product.id && i.variantId === null);
        if (!item) continue;
        if (item.sellingPrice !== null) {
          resolvedPrice = new Decimal(item.sellingPrice.toString());
        } else if (item.discountPercent !== null) {
          resolvedPrice = resolvedPrice.mul(1 - item.discountPercent / 100).toDecimalPlaces(2);
        }
        break;
      }
    }
    const unitPrice = itemReq.unitPrice != null ? new Decimal(itemReq.unitPrice) : resolvedPrice;

    if (product.minSellingPrice && unitPrice.lessThan(product.minSellingPrice)) {
      throw new BusinessException(`Price below minimum for product: ${product.name}`);
    }

    const quantity = new Decimal(itemReq.quantity);
    const lineTotal = unitPrice.mul(quantity);

    // Auto discounts
    const autoDiscount = await discountService.calculateItemDiscount(product.id, quantity, unitPrice);
    let manualDiscount = new Decimal(0);
    if (itemReq.discountPercent && itemReq.discountPercent > 0) {
      manualDiscount = lineTotal.mul(itemReq.discountPercent).div(100).toDecimalPlaces(2);
    }
    const itemDiscount = autoDiscount.greaterThan(manualDiscount) ? autoDiscount : manualDiscount;
    const discountedTotal = lineTotal.minus(itemDiscount);

    // Tax
    let taxRate = new Decimal(0);
    let taxAmount = new Decimal(0);
    if (product.taxGroup) {
      taxRate = d(product.taxGroup.totalRate);
      if (product.taxGroup.inclusive) {
        taxAmount = discountedTotal.mul(taxRate).div(new Decimal(100).plus(taxRate)).toDecimalPlaces(2);
      } else {
        taxAmount = discountedTotal.mul(taxRate).div(100).toDecimalPlaces(2);
      }
    }

    const finalLineTotal = product.taxGroup && !product.taxGroup.inclusive
      ? discountedTotal.plus(taxAmount)
      : discountedTotal;

    itemData.push({
      productId: itemReq.productId,
      variantId: itemReq.variantId,
      productName: product.name,
      sku: product.sku ?? undefined,
      quantity,
      unitPrice,
      costPrice: product.costPrice ? d(product.costPrice) : undefined,
      discountAmount: itemDiscount,
      taxRate,
      taxAmount,
      lineTotal: finalLineTotal,
      notes: itemReq.notes,
    });

    subtotal = subtotal.plus(lineTotal);
    totalDiscount = totalDiscount.plus(itemDiscount);
    totalTax = totalTax.plus(taxAmount);

    // Deduct inventory
    if (product.trackInventory) {
      const factor = d(product.saleFactor);
      await inventoryService.deductStock(product.id, itemReq.variantId ?? null, req.outletId, quantity, factor);
    }
  }

  // Coupon discount
  let couponDiscount = new Decimal(0);
  let couponCode: string | undefined;
  if (req.couponCode) {
    const afterItemDiscount = subtotal.minus(totalDiscount);
    const coupon = await discountService.validateCoupon(req.couponCode, afterItemDiscount, customer?.id ?? null);
    couponDiscount = discountService.applyCoupon(coupon, afterItemDiscount);
    couponCode = req.couponCode;
  }

  // Bill-level discount
  let billDiscount = new Decimal(0);
  if (req.billDiscountAmount) {
    billDiscount = new Decimal(req.billDiscountAmount);
  } else if (req.billDiscountPercent) {
    billDiscount = subtotal.minus(totalDiscount).minus(couponDiscount)
      .mul(req.billDiscountPercent).div(100).toDecimalPlaces(2);
  }

  const totalDiscountFinal = totalDiscount.plus(couponDiscount).plus(billDiscount);
  const totalAfterDiscount = subtotal.minus(totalDiscountFinal);
  let totalAmount = totalAfterDiscount.plus(totalTax);

  // Loyalty redemption
  let loyaltyDiscount = new Decimal(0);
  if (req.loyaltyPointsToRedeem && customer) {
    loyaltyDiscount = new Decimal(req.loyaltyPointsToRedeem).div(10).toDecimalPlaces(2);
    totalAmount = totalAmount.minus(loyaltyDiscount);
    await customerService.redeemLoyaltyPoints(customer.id, new Decimal(req.loyaltyPointsToRedeem));
  }

  if (totalAmount.lessThan(0)) totalAmount = new Decimal(0);

  // Process payments
  let totalPaid = new Decimal(0);
  const paymentData: {
    paymentMethod: string;
    amount: Decimal;
    referenceNumber?: string;
    status: string;
    creditNoteId?: number;
  }[] = [];

  for (const payReq of req.payments) {
    const amount = new Decimal(payReq.amount);
    if (payReq.paymentMethod === 'CREDIT_NOTE' && payReq.creditNoteId) {
      await creditNoteService.applyCreditNote(payReq.creditNoteId, amount);
    }
    paymentData.push({
      paymentMethod: payReq.paymentMethod,
      amount,
      referenceNumber: payReq.referenceNumber,
      status: 'COMPLETED',
      creditNoteId: payReq.creditNoteId,
    });
    totalPaid = totalPaid.plus(amount);
  }

  const changeAmount = totalPaid.minus(totalAmount);
  const isCredit = paymentData.some((p) => p.paymentMethod === 'CREDIT_SALE');

  // Create order
  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(outlet.code ?? 'OUT'),
      outletId: req.outletId,
      cashierId: req.cashierId,
      shiftId: shift?.id,
      customerId: customer?.id,
      status: 'COMPLETED',
      orderType: isCredit ? 'CREDIT_SALE' : 'SALE',
      subtotal,
      discountAmount: totalDiscountFinal,
      taxAmount: totalTax,
      totalAmount,
      paidAmount: totalPaid,
      changeAmount: changeAmount.greaterThan(0) ? changeAmount : new Decimal(0),
      couponCode,
      discountReason: req.discountReason,
      notes: req.notes,
      items: {
        create: itemData.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice,
          discountAmount: it.discountAmount,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
          notes: it.notes,
        })),
      },
      payments: {
        create: paymentData.map((p) => ({
          paymentMethod: p.paymentMethod as never,
          amount: p.amount,
          referenceNumber: p.referenceNumber,
          status: p.status as never,
          creditNoteId: p.creditNoteId,
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      payments: true,
      customer: true,
      outlet: true,
      cashier: { include: { userRoles: { include: { role: true } } } },
    },
  });

  // Post-checkout
  if (couponCode) await discountService.markCouponUsed(couponCode);

  if (customer) {
    const creditAmount = paymentData
      .filter((p) => p.paymentMethod === 'CREDIT_SALE')
      .reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
    if (creditAmount.greaterThan(0)) {
      await customerService.updateOutstandingDue(customer.id, creditAmount);
    }

    const pointsEarned = totalAmount.mul(0.01).toDecimalPlaces(0);
    if (pointsEarned.greaterThan(0)) {
      await customerService.addLoyaltyPoints(
        customer.id,
        pointsEarned,
        order.id,
        `Points earned on order ${order.orderNumber}`
      );
    }
    await customerService.updateTotalSpent(customer.id, totalAmount);

    await prisma.order.update({
      where: { id: order.id },
      data: { loyaltyPointsEarned: pointsEarned },
    });
  }

  if (shift) {
    await shiftService.updateShiftTotals(shift.id, totalAmount, totalDiscountFinal);
  }

  // Auto-generate invoice
  const invoice = await invoiceService.createFromOrder(order.id);

  if (activitySetter) {
    const custName = customer ? ` — ${customer.name}` : '';
    const itemsCount = order.items.length;
    activitySetter(
      `Order ${order.orderNumber} completed${custName} — ${itemsCount} item${itemsCount !== 1 ? 's' : ''}, ₹${totalAmount.toFixed(2)}`
    );
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    changeAmount: order.changeAmount,
  };
}

export async function processReturn(req: ReturnRequest, activitySetter?: (desc: string) => void) {
  const originalOrder = await prisma.order.findUnique({
    where: { id: req.originalOrderId },
    include: { items: { include: { product: true } }, outlet: true, customer: true, cashier: true },
  });
  if (!originalOrder) throw new ResourceNotFoundException('Order', req.originalOrderId);

  let returnTotal = new Decimal(0);
  const returnItems: {
    productId: number;
    productName: string;
    quantity: Decimal;
    unitPrice: Decimal;
    lineTotal: Decimal;
    notes?: string;
  }[] = [];

  for (const itemReq of req.items) {
    const originalItem = originalOrder.items.find((i) => i.id === itemReq.orderItemId);
    if (!originalItem) throw new ResourceNotFoundException('OrderItem not found');

    const available = d(originalItem.quantity).minus(d(originalItem.returnedQuantity));
    const returnQty = new Decimal(itemReq.returnQuantity);
    if (returnQty.greaterThan(available)) {
      throw new BusinessException(`Return quantity exceeds available for: ${originalItem.productName}`);
    }

    const returnLineTotal = d(originalItem.unitPrice).mul(returnQty);
    returnItems.push({
      productId: originalItem.productId,
      productName: originalItem.productName,
      quantity: returnQty,
      unitPrice: d(originalItem.unitPrice),
      lineTotal: returnLineTotal,
      notes: itemReq.reason,
    });
    returnTotal = returnTotal.plus(returnLineTotal);

    // Update returned quantity on original
    await prisma.orderItem.update({
      where: { id: itemReq.orderItemId },
      data: { returnedQuantity: d(originalItem.returnedQuantity).plus(returnQty) },
    });

    // Restock
    if (originalItem.product.trackInventory) {
      await prisma.inventory.updateMany({
        where: { productId: originalItem.productId, outletId: originalOrder.outletId },
        data: { quantityOnHand: { increment: returnQty } },
      });
    }
  }

  const returnOrder = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber('RET'),
      outletId: originalOrder.outletId,
      cashierId: originalOrder.cashierId,
      customerId: originalOrder.customerId,
      status: 'COMPLETED',
      orderType: 'RETURN',
      subtotal: returnTotal.negated(),
      totalAmount: returnTotal.negated(),
      notes: req.returnMethod ?? req.notes,
      items: {
        create: returnItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          notes: it.notes,
        })),
      },
      payments: {
        create: [{
          paymentMethod: (req.returnMethod ?? 'CASH') as never,
          amount: returnTotal,
          status: 'REFUNDED' as never,
          notes: req.reason,
        }],
      },
    },
    include: { customer: true, outlet: true },
  });

  if (req.returnMethod === 'CREDIT_NOTE' && originalOrder.customer) {
    await creditNoteService.createCreditNote({
      customerId: originalOrder.customer.id,
      originalOrderId: originalOrder.id,
      outletId: originalOrder.outletId,
      totalAmount: returnTotal,
      reason: req.reason,
      expiryDays: 365,
    });
  }

  // Update original order status
  const totalReturned = originalOrder.items.reduce(
    (s, item) => s.plus(item.returnedQuantity ?? 0), new Decimal(0)
  );
  const totalOrdered = originalOrder.items.reduce(
    (s, item) => s.plus(item.quantity), new Decimal(0)
  );
  const newStatus = totalReturned.plus(
    req.items.reduce((s, i) => s + i.returnQuantity, 0)
  ).gte(totalOrdered) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  await prisma.order.update({
    where: { id: originalOrder.id },
    data: { status: newStatus as never },
  });

  if (activitySetter) {
    const custName = returnOrder.customer ? ` for ${returnOrder.customer.name}` : '';
    activitySetter(
      `Return ${returnOrder.orderNumber}${custName} against order ${originalOrder.orderNumber} — ₹${returnTotal.toFixed(2)}`
    );
  }

  return returnOrder;
}

export async function getByOrderNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { product: true, variant: true } },
      payments: true,
      customer: true,
      outlet: true,
      cashier: { include: { userRoles: { include: { role: true } } } },
    },
  });
  if (!order) throw new ResourceNotFoundException(`Order not found: ${orderNumber}`);
  return order;
}

export async function getReturnOrders(outletId: number, page = 0, size = 100, from?: Date, to?: Date) {
  const where: any = { outletId, orderType: 'RETURN' }
  if (from && to) where.createdAt = { gte: from, lte: to }
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.order.count({ where }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getOrdersByOutlet(outletId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: { outletId },
      include: { items: { include: { product: true } }, payments: true, customer: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.order.count({ where: { outletId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getOrdersByOutletAndDateRange(
  outletId: number,
  from: Date,
  to: Date,
  page = 0,
  size = 20
) {
  const where = { outletId, createdAt: { gte: from, lte: to } };
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, payments: true, customer: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.order.count({ where }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function getOrdersByCustomer(customerId: number, page = 0, size = 20) {
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { product: true } }, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.order.count({ where: { customerId } }),
  ]);
  return { content: data, totalElements: total, page, size };
}

export async function holdOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ResourceNotFoundException('Order', orderId);
  return prisma.order.update({ where: { id: orderId }, data: { status: 'HELD' } });
}
