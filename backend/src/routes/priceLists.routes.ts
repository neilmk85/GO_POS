import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';

const router = Router();
router.use(authenticate);

const INCLUDE = {
  segments: true,
  customers: { include: { customer: { select: { id: true, name: true, phone: true } } } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, sellingPrice: true } },
      variant: { select: { id: true, name: true, priceAdjustment: true } },
    },
    orderBy: { id: 'asc' as const },
  },
};

// ── List all price lists ──────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  const priceLists = await prisma.priceList.findMany({
    include: INCLUDE,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(successResponse(priceLists));
});

// ── Get single price list ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const pl = await prisma.priceList.findUnique({
    where: { id: parseInt(req.params.id) },
    include: INCLUDE,
  });
  if (!pl) throw new ResourceNotFoundException('PriceList', parseInt(req.params.id));
  res.json(successResponse(pl));
});

// ── Resolve price for a product/variant for a customer ────────────────────────
// GET /api/price-lists/resolve?productId=X&variantId=Y&customerId=Z
router.get('/resolve/price', async (req: Request, res: Response) => {
  const productId = parseInt(req.query.productId as string);
  const variantId = req.query.variantId ? parseInt(req.query.variantId as string) : null;
  const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : null;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ResourceNotFoundException('Product', productId);

  const basePrice = parseFloat(product.sellingPrice.toString());

  if (!customerId) {
    res.json(successResponse({ price: basePrice, source: 'product' }));
    return;
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    res.json(successResponse({ price: basePrice, source: 'product' }));
    return;
  }

  const now = new Date();

  // Find active price lists that apply to this customer (by segment or explicit assignment)
  const priceLists = await prisma.priceList.findMany({
    where: {
      active: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      OR: [
        { segments: { some: { segment: customer.segment } } },
        { customers: { some: { customerId } } },
      ],
    },
    include: {
      items: true,
    },
    orderBy: { priority: 'desc' },
  });

  // Find the best matching price list item
  let resolvedPrice: number | null = null;
  for (const pl of priceLists) {
    // Try variant-specific item first
    const item = variantId
      ? pl.items.find(i => i.productId === productId && i.variantId === variantId)
        ?? pl.items.find(i => i.productId === productId && i.variantId === null)
      : pl.items.find(i => i.productId === productId && i.variantId === null);

    if (!item) continue;

    let price = basePrice;
    if (item.sellingPrice !== null) {
      price = parseFloat(item.sellingPrice.toString());
    } else if (item.discountPercent !== null) {
      price = basePrice * (1 - item.discountPercent / 100);
      price = Math.round(price * 100) / 100;
    }

    if (resolvedPrice === null || price < resolvedPrice) {
      resolvedPrice = price;
    }
    break; // highest priority list wins
  }

  res.json(successResponse({
    price: resolvedPrice ?? basePrice,
    source: resolvedPrice !== null ? 'price_list' : 'product',
  }));
});

// ── Create price list ─────────────────────────────────────────────────────────
router.post('/', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const { name, description, active, priority, startDate, endDate, segments, customerIds, items } = req.body;

  const pl = await prisma.priceList.create({
    data: {
      name,
      description: description || null,
      active: active !== false,
      priority: priority ?? 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      segments: segments?.length
        ? { create: segments.map((s: string) => ({ segment: s as never })) }
        : undefined,
      customers: customerIds?.length
        ? { create: customerIds.map((cid: number) => ({ customerId: cid })) }
        : undefined,
      items: items?.length
        ? {
            create: items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              sellingPrice: item.sellingPrice ?? null,
              discountPercent: item.discountPercent ?? null,
            })),
          }
        : undefined,
    },
    include: INCLUDE,
  });

  res.json(successResponse(pl, 'Price list created'));
});

// ── Update price list ─────────────────────────────────────────────────────────
router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { name, description, active, priority, startDate, endDate, segments, customerIds, items } = req.body;

  // Replace segments, customers, and items
  await prisma.$transaction([
    prisma.priceListSegment.deleteMany({ where: { priceListId: id } }),
    prisma.priceListCustomer.deleteMany({ where: { priceListId: id } }),
    prisma.priceListItem.deleteMany({ where: { priceListId: id } }),
  ]);

  const pl = await prisma.priceList.update({
    where: { id },
    data: {
      name,
      description: description || null,
      active: active !== false,
      priority: priority ?? 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      segments: segments?.length
        ? { create: segments.map((s: string) => ({ segment: s as never })) }
        : undefined,
      customers: customerIds?.length
        ? { create: customerIds.map((cid: number) => ({ customerId: cid })) }
        : undefined,
      items: items?.length
        ? {
            create: items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              sellingPrice: item.sellingPrice ?? null,
              discountPercent: item.discountPercent ?? null,
            })),
          }
        : undefined,
    },
    include: INCLUDE,
  });

  res.json(successResponse(pl, 'Price list updated'));
});

// ── Toggle active ─────────────────────────────────────────────────────────────
router.patch('/:id/toggle-active', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const pl = await prisma.priceList.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!pl) throw new ResourceNotFoundException('PriceList', parseInt(req.params.id));
  const updated = await prisma.priceList.update({
    where: { id: parseInt(req.params.id) },
    data: { active: !pl.active },
    include: INCLUDE,
  });
  res.json(successResponse(updated));
});

// ── Delete price list ─────────────────────────────────────────────────────────
router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  await prisma.priceList.delete({ where: { id: parseInt(req.params.id) } });
  res.json(successResponse(null, 'Price list deleted'));
});

export default router;
