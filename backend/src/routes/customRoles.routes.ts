import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  res.json(successResponse(await prisma.customRole.findMany({ where: { active: true } })));
});

router.get('/:id', async (req: Request, res: Response) => {
  const role = await prisma.customRole.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!role) throw new ResourceNotFoundException('CustomRole', parseInt(req.params.id));
  res.json(successResponse(role));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const role = await prisma.customRole.create({ data: req.body });
  res.json(successResponse(role, 'Custom role created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const role = await prisma.customRole.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json(successResponse(role, 'Custom role updated'));
});

router.delete('/:id', requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  await prisma.customRole.delete({ where: { id: parseInt(req.params.id) } });
  res.json(successResponse(null, 'Custom role deleted'));
});

export default router;
