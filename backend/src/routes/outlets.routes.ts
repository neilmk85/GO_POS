import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  res.json(successResponse(await prisma.outlet.findMany({ orderBy: { name: 'asc' } })));
});

router.get('/:id', async (req: Request, res: Response) => {
  const outlet = await prisma.outlet.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!outlet) throw new ResourceNotFoundException('Outlet', parseInt(req.params.id));
  res.json(successResponse(outlet));
});

router.post('/', requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const outlet = await prisma.outlet.create({ data: { ...req.body, createdBy: req.user?.email } });
  res.json(successResponse(outlet, 'Outlet created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { users, inventories, ...data } = req.body;
  const outlet = await prisma.outlet.update({
    where: { id: parseInt(req.params.id) },
    data: { ...data, updatedBy: req.user?.email },
  });
  res.json(successResponse(outlet, 'Outlet updated'));
});

router.patch('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { users, inventories, ...data } = req.body;
  const outlet = await prisma.outlet.update({
    where: { id: parseInt(req.params.id) },
    data: { ...data, updatedBy: req.user?.email },
  });
  res.json(successResponse(outlet, 'Outlet updated'));
});

export default router;
