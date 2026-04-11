import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/filters', async (req: Request, res: Response) => {
  const outletId = req.query.outletId ? parseInt(req.query.outletId as string) : undefined;
  const where = outletId ? { outletId } : {};

  const [modules, actions] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    }),
    prisma.activityLog.findMany({
      where,
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    }),
  ]);

  res.json(successResponse({
    modules: modules.map(m => m.module),
    actions: actions.map(a => a.action),
  }));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, userId, module, action, search, from, to } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '50');

  const where: any = {};
  if (outletId) where.outletId = parseInt(outletId);
  if (userId)   where.userId   = parseInt(userId);
  if (module)   where.module   = module;
  if (action)   where.action   = action;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00+05:30');
    if (to)   where.createdAt.lte = new Date(to   + 'T23:59:59+05:30');
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { userName:    { contains: search, mode: 'insensitive' } },
      { userEmail:   { contains: search, mode: 'insensitive' } },
      { module:      { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * size,
      take: size,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / size);
  res.json(successResponse({ content: data, totalElements: total, totalPages, page, size }));
});

router.delete('/', requireRole('SUPER_ADMIN'), async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const { count } = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });
  res.json(successResponse({ deleted: count }, `Deleted ${count} old log entries`));
});

export default router;
