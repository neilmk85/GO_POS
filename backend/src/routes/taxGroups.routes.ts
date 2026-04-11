import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  res.json(successResponse(await prisma.taxGroup.findMany({ orderBy: { totalRate: 'asc' } })));
});

router.get('/:id', async (req: Request, res: Response) => {
  const tg = await prisma.taxGroup.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!tg) throw new ResourceNotFoundException('TaxGroup', parseInt(req.params.id));
  res.json(successResponse(tg));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const tg = await prisma.taxGroup.create({ data: { ...req.body, createdBy: req.user?.email } });
  logActivity({ req, module: 'SETTINGS', action: 'CREATED', entityId: tg.id, description: `Created tax group "${tg.name}" — ${tg.totalRate}%` });
  res.json(successResponse(tg, 'Tax group created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const before = await prisma.taxGroup.findUnique({ where: { id: parseInt(req.params.id) } });
  const tg = await prisma.taxGroup.update({
    where: { id: parseInt(req.params.id) },
    data: { ...req.body, updatedBy: req.user?.email },
  });
  const changes: string[] = [];
  if (before) {
    const rateFields: Array<[keyof typeof before, string]> = [
      ['name', 'name'],
      ['totalRate', 'totalRate'],
      ['cgstRate', 'cgstRate'],
      ['sgstRate', 'sgstRate'],
      ['igstRate', 'igstRate'],
      ['cessRate', 'cessRate'],
      ['hsnCode', 'hsnCode'],
      ['inclusive', 'inclusive'],
    ];
    for (const [field, label] of rateFields) {
      const bv = before[field], av = tg[field];
      if (String(bv ?? '') !== String(av ?? '')) {
        const unit = ['totalRate','cgstRate','sgstRate','igstRate','cessRate'].includes(field) ? '%' : '';
        changes.push(`${label}: ${bv ?? ''}${unit} → ${av ?? ''}${unit}`);
      }
    }
  }
  const desc = changes.length > 0
    ? `Updated tax group "${tg.name}" — ${changes.join(', ')}`
    : `Updated tax group "${tg.name}"`;
  logActivity({ req, module: 'SETTINGS', action: 'UPDATED', entityId: tg.id, description: desc });
  res.json(successResponse(tg, 'Tax group updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const existing = await prisma.taxGroup.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.taxGroup.delete({ where: { id: parseInt(req.params.id) } });
  logActivity({ req, module: 'SETTINGS', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted tax group "${existing?.name ?? req.params.id}"` });
  res.json(successResponse(null, 'Tax group deleted'));
});

export default router;
