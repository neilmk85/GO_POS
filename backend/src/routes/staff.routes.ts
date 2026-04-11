import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

// Staff = users with non-admin roles at an outlet
router.get('/', async (req: Request, res: Response) => {
  const { outletId } = req.query as { outletId?: string };
  const users = await prisma.user.findMany({
    where: outletId ? { outletId: parseInt(outletId) } : undefined,
    include: { userRoles: { include: { role: true } }, outlet: true },
    orderBy: { name: 'asc' },
  });
  res.json(successResponse(users));
});

router.get('/export/csv', async (req: Request, res: Response) => {
  const { outletId } = req.query as { outletId?: string };
  const users = await prisma.user.findMany({
    where: outletId ? { outletId: parseInt(outletId) } : undefined,
    include: { userRoles: { include: { role: true } }, outlet: true },
    orderBy: { name: 'asc' },
  });
  const lines = ['name,email,phone,roles,outlet,active'];
  for (const u of users) {
    const roles = u.userRoles.map((ur) => ur.role.name).join(';');
    lines.push(`"${u.name}","${u.email}","${u.phone ?? ''}","${roles}","${u.outlet?.name ?? ''}",${u.active}`);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=staff_export.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(lines.join('\n'));
});

export default router;
