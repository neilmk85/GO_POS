import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

// Suppliers (vendors)
router.get('/', async (_req: Request, res: Response) => {
  res.json(successResponse(await prisma.supplier.findMany({ orderBy: { name: 'asc' } })));
});

router.get('/export/csv', async (_req: Request, res: Response) => {
  const vendors = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const lines = ['name,contactPerson,phone,email,city,state,gstin,pan'];
  for (const v of vendors) {
    lines.push(`"${v.name}","${v.contactPerson ?? ''}","${v.phone ?? ''}","${v.email ?? ''}","${v.city ?? ''}","${v.state ?? ''}","${v.gstin ?? ''}","${v.pan ?? ''}"`);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=vendors_export.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(lines.join('\n'));
});

router.get('/:id', async (req: Request, res: Response) => {
  const s = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!s) throw new ResourceNotFoundException('Supplier', parseInt(req.params.id));
  res.json(successResponse(s));
});

router.post('/', async (req: Request, res: Response) => {
  const s = await prisma.supplier.create({ data: { ...req.body, createdBy: req.user?.email } });
  logActivity({ req, module: 'VENDOR', action: 'CREATED', entityId: s.id, description: `Created vendor "${s.name}"` });
  res.json(successResponse(s, 'Vendor created'));
});

router.put('/:id', async (req: Request, res: Response) => {
  const s = await prisma.supplier.update({
    where: { id: parseInt(req.params.id) },
    data: { ...req.body, updatedBy: req.user?.email },
  });
  logActivity({ req, module: 'VENDOR', action: 'UPDATED', entityId: s.id, description: `Updated vendor "${s.name}"` });
  res.json(successResponse(s, 'Vendor updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const existing = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.supplier.update({ where: { id: parseInt(req.params.id) }, data: { active: false } });
  logActivity({ req, module: 'VENDOR', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted vendor "${existing?.name ?? req.params.id}"` });
  res.json(successResponse(null, 'Vendor deleted'));
});

export default router;
