import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { generateBarcode } from '../utils/numberGenerator';
import { logActivity } from '../utils/activityLogger';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') },
});

router.use(authenticate);

router.get('/generate-barcode', async (_req: Request, res: Response) => {
  let barcode: string;
  let attempts = 0;
  do {
    barcode = generateBarcode();
    const existing = await prisma.product.findFirst({ where: { barcode } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);
  res.json(successResponse(barcode!));
});

router.get('/units', async (_req: Request, res: Response) => {
  const units = await prisma.product.findMany({
    select: { unitOfMeasure: true },
    distinct: ['unitOfMeasure'],
    where: { unitOfMeasure: { not: undefined } },
  });
  res.json(successResponse(units.map((u) => u.unitOfMeasure).filter(Boolean)));
});

router.get('/low-stock', async (req: Request, res: Response) => {
  const outletId = parseInt(req.query.outletId as string);
  const lowStock = await prisma.inventory.findMany({
    where: {
      outletId,
      product: { trackInventory: true, active: true },
    },
    include: { product: { include: { category: true } } },
  });
  const result = lowStock.filter((inv) =>
    parseFloat(inv.quantityOnHand.toString()) <= (inv.reorderLevel ?? inv.product.reorderLevel)
  );
  res.json(successResponse(result));
});

router.get('/category/:categoryId', async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { categoryId: parseInt(req.params.categoryId), active: true },
    include: { taxGroup: true, category: true, variants: true },
  });
  res.json(successResponse(products));
});

router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q } },
      ],
    },
    include: { taxGroup: true, category: true, variants: true },
    take: 30,
  });
  res.json(successResponse(products));
});

router.get('/barcode/:barcode', async (req: Request, res: Response) => {
  const product = await prisma.product.findFirst({
    where: { barcode: req.params.barcode },
    include: { taxGroup: true, category: true, variants: true, images: true },
  });
  if (!product) throw new ResourceNotFoundException(`Product with barcode ${req.params.barcode}`);
  res.json(successResponse(product));
});

router.get('/:id', async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { taxGroup: true, category: true, variants: true, images: true },
  });
  if (!product) throw new ResourceNotFoundException('Product', parseInt(req.params.id));
  res.json(successResponse(product));
});

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const [data, total] = await Promise.all([
    prisma.product.findMany({
      include: { taxGroup: true, category: true, variants: true },
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.product.count(),
  ]);
  res.json(successResponse({ content: data, totalElements: total, page, size }));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const { variants, images, inventories, priceListItems, taxGroup, category, hsnCode,
    categoryId: bodyCatId, taxGroupId: bodyTaxId, ...productData } = req.body;
  const categoryId = bodyCatId ?? (req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined);
  const taxGroupId = bodyTaxId ?? (req.query.taxGroupId ? parseInt(req.query.taxGroupId as string) : undefined);
  const product = await prisma.product.create({
    data: {
      ...productData,
      createdBy: req.user?.email,
      category: categoryId ? { connect: { id: categoryId } } : undefined,
      taxGroup: taxGroupId ? { connect: { id: taxGroupId } } : undefined,
    },
    include: { taxGroup: true, category: true, variants: true },
  });
  logActivity({ req, module: 'PRODUCT', action: 'CREATED', entityId: product.id, description: `Created product "${product.name}" — SKU: ${product.sku ?? 'N/A'}, Price: ₹${product.sellingPrice}` });
  res.json(successResponse(product, 'Product created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const { variants, images, inventories, priceListItems, taxGroup, category, hsnCode,
    categoryId: bodyCatId, taxGroupId: bodyTaxId, ...productData } = req.body;
  const categoryId = bodyCatId ?? (req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined);
  const taxGroupId = bodyTaxId ?? (req.query.taxGroupId ? parseInt(req.query.taxGroupId as string) : undefined);
  const before = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  const product = await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: {
      ...productData,
      updatedBy: req.user?.email,
      category: categoryId !== undefined ? (categoryId ? { connect: { id: categoryId } } : { disconnect: true }) : undefined,
      taxGroup: taxGroupId !== undefined ? (taxGroupId ? { connect: { id: taxGroupId } } : { disconnect: true }) : undefined,
    },
    include: { taxGroup: true, category: true, variants: true },
  });
  const changes: string[] = [];
  if (before) {
    const tracked = ['name', 'sellingPrice', 'costPrice', 'mrp', 'minSellingPrice', 'sku', 'barcode', 'description', 'unitOfMeasure', 'reorderLevel', 'trackInventory', 'allowNegativeStock', 'productType', 'active', 'featured'];
    for (const f of tracked) {
      const bv = (before as any)[f], av = (product as any)[f];
      if (bv !== av && (bv != null || av != null)) changes.push(`${f}: ${bv ?? ''} → ${av ?? ''}`);
    }
  }
  const desc = changes.length > 0 ? `Updated product "${product.name}" — ${changes.join(', ')}` : `Updated product "${product.name}"`;
  logActivity({ req, module: 'PRODUCT', action: 'UPDATED', entityId: product.id, description: desc });
  res.json(successResponse(product, 'Product updated'));
});

router.patch('/:id/toggle-active', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!product) throw new ResourceNotFoundException('Product', parseInt(req.params.id));
  const updated = await prisma.product.update({
    where: { id: parseInt(req.params.id) },
    data: { active: !product.active },
  });
  res.json(successResponse(updated));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const existing = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.product.update({ where: { id: parseInt(req.params.id) }, data: { active: false } });
  logActivity({ req, module: 'PRODUCT', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted product "${existing?.name ?? req.params.id}"` });
  res.json(successResponse(null, 'Product deleted'));
});

// CSV import template
router.get('/import/template', (_req: Request, res: Response) => {
  const csv = 'name,sku,barcode,sellingPrice,costPrice,mrp,categoryName,taxGroupName,unitOfMeasure,description\n';
  res.setHeader('Content-Disposition', 'attachment; filename=products_template.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// CSV export
router.get('/export/csv', async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    include: { category: true, taxGroup: true },
    orderBy: { name: 'asc' },
  });
  const lines = ['name,sku,barcode,sellingPrice,costPrice,mrp,category,taxGroup,unitOfMeasure,active'];
  for (const p of products) {
    lines.push(`"${p.name}","${p.sku ?? ''}","${p.barcode ?? ''}",${p.sellingPrice},${p.costPrice ?? ''},${p.mrp ?? ''},"${p.category?.name ?? ''}","${p.taxGroup?.name ?? ''}","${p.unitOfMeasure}",${p.active}`);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=products_export.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(lines.join('\n'));
});

// Image upload
router.post('/:id/images', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  const image = await prisma.productImage.create({
    data: {
      productId: parseInt(req.params.id),
      imageUrl,
      primary: req.body.primary === 'true',
    },
  });
  res.json(successResponse(image, 'Image uploaded'));
});

// ─── Variant CRUD ─────────────────────────────────────────────────────────────

router.get('/:id/variants', async (req: Request, res: Response) => {
  const variants = await prisma.productVariant.findMany({
    where: { productId: parseInt(req.params.id) },
    orderBy: { createdAt: 'asc' },
  });
  res.json(successResponse(variants));
});

router.post(
  '/:id/variants',
  requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'),
  async (req: Request, res: Response) => {
    const productId = parseInt(req.params.id);
    const { sku, barcode, attribute1Name, attribute1Value, attribute2Name, attribute2Value, priceAdjustment, costPrice, active } = req.body;
    const parts = [attribute1Value, attribute2Value].filter(Boolean);
    const name = parts.length > 0 ? parts.join(' / ') : req.body.name || 'Variant';
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name,
        sku: sku || null,
        barcode: barcode || null,
        attribute1Name: attribute1Name || null,
        attribute1Value: attribute1Value || null,
        attribute2Name: attribute2Name || null,
        attribute2Value: attribute2Value || null,
        priceAdjustment: priceAdjustment ?? 0,
        costPrice: costPrice || null,
        active: active !== false,
        createdBy: req.user?.email,
      },
    });
    res.json(successResponse(variant, 'Variant created'));
  }
);

router.put(
  '/:id/variants/:variantId',
  requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'),
  async (req: Request, res: Response) => {
    const { attribute1Name, attribute1Value, attribute2Name, attribute2Value, priceAdjustment, costPrice, sku, barcode, active } = req.body;
    const parts = [attribute1Value, attribute2Value].filter(Boolean);
    const name = parts.length > 0 ? parts.join(' / ') : req.body.name;
    const variant = await prisma.productVariant.update({
      where: { id: parseInt(req.params.variantId) },
      data: {
        ...(name && { name }),
        sku: sku !== undefined ? (sku || null) : undefined,
        barcode: barcode !== undefined ? (barcode || null) : undefined,
        attribute1Name: attribute1Name !== undefined ? (attribute1Name || null) : undefined,
        attribute1Value: attribute1Value !== undefined ? (attribute1Value || null) : undefined,
        attribute2Name: attribute2Name !== undefined ? (attribute2Name || null) : undefined,
        attribute2Value: attribute2Value !== undefined ? (attribute2Value || null) : undefined,
        ...(priceAdjustment !== undefined && { priceAdjustment }),
        costPrice: costPrice !== undefined ? (costPrice || null) : undefined,
        ...(active !== undefined && { active }),
        updatedBy: req.user?.email,
      },
    });
    res.json(successResponse(variant, 'Variant updated'));
  }
);

router.delete(
  '/:id/variants/:variantId',
  requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'),
  async (req: Request, res: Response) => {
    await prisma.productVariant.delete({ where: { id: parseInt(req.params.variantId) } });
    res.json(successResponse(null, 'Variant deleted'));
  }
);

export default router;
