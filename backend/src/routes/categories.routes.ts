import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    include: { children: true, parent: true },
    where: { parentId: null },
    orderBy: { displayOrder: 'asc' },
  });
  res.json(successResponse(categories));
});

router.get('/all', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: { displayOrder: 'asc' },
  });
  res.json(successResponse(categories));
});

router.get('/:id', async (req: Request, res: Response) => {
  const c = await prisma.category.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { children: true, parent: true },
  });
  if (!c) throw new ResourceNotFoundException('Category', parseInt(req.params.id));
  res.json(successResponse(c));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const { parentId, ...data } = req.body;
  const c = await prisma.category.create({
    data: {
      ...data,
      createdBy: req.user?.email,
      parent: parentId ? { connect: { id: parentId } } : undefined,
    },
    include: { parent: true },
  });
  logActivity({ req, module: 'CATEGORY', action: 'CREATED', entityId: c.id, description: `Created category "${c.name}"` });
  res.json(successResponse(c, 'Category created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER'), async (req: Request, res: Response) => {
  const { parentId, children, products, ...data } = req.body;
  const c = await prisma.category.update({
    where: { id: parseInt(req.params.id) },
    data: {
      ...data,
      updatedBy: req.user?.email,
      parent: parentId !== undefined ? (parentId ? { connect: { id: parentId } } : { disconnect: true }) : undefined,
    },
    include: { parent: true, children: true },
  });
  logActivity({ req, module: 'CATEGORY', action: 'UPDATED', entityId: c.id, description: `Updated category "${c.name}"` });
  res.json(successResponse(c, 'Category updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const existing = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) } });
  await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
  logActivity({ req, module: 'CATEGORY', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted category "${existing?.name ?? req.params.id}"` });
  res.json(successResponse(null, 'Category deleted'));
});

export default router;
