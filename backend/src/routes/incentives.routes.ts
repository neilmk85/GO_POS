import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, ResourceNotFoundException } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const { outletId } = req.query as { outletId?: string };
  const rules = await prisma.incentiveRule.findMany({
    where: outletId ? { outletId: parseInt(outletId) } : undefined,
    include: { outlet: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(successResponse(rules));
});

router.get('/payouts', async (req: Request, res: Response) => {
  const { outletId, staffId, month, year } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (outletId) where['outletId'] = parseInt(outletId);
  if (staffId) where['staffId'] = parseInt(staffId);
  if (month) where['month'] = parseInt(month);
  if (year) where['year'] = parseInt(year);
  res.json(successResponse(await prisma.incentivePayout.findMany({ where: where as never, orderBy: { year: 'desc' } })));
});

router.get('/:id', async (req: Request, res: Response) => {
  const rule = await prisma.incentiveRule.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { outlet: true },
  });
  if (!rule) throw new ResourceNotFoundException('IncentiveRule', parseInt(req.params.id));
  res.json(successResponse(rule));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const rule = await prisma.incentiveRule.create({
    data: { ...req.body, createdBy: req.user?.email },
    include: { outlet: true },
  });
  res.json(successResponse(rule, 'Incentive rule created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const rule = await prisma.incentiveRule.update({
    where: { id: parseInt(req.params.id) },
    data: { ...req.body, updatedBy: req.user?.email },
    include: { outlet: true },
  });
  res.json(successResponse(rule, 'Incentive rule updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  await prisma.incentiveRule.delete({ where: { id: parseInt(req.params.id) } });
  res.json(successResponse(null, 'Incentive rule deleted'));
});

router.post('/calculate-payout', async (req: Request, res: Response) => {
  const { outletId, staffId, month, year } = req.body;

  // Get all completed orders for the staff in the given month/year
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const orders = await prisma.order.findMany({
    where: {
      outletId,
      cashierId: staffId,
      status: 'COMPLETED',
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const totalSales = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const totalTransactions = orders.length;

  const rules = await prisma.incentiveRule.findMany({
    where: {
      active: true,
      OR: [{ outletId }, { outletId: null }],
      AND: [{ OR: [{ applyToAll: true }, { staffIds: { path: [], array_contains: staffId } }] }],
    },
  });

  let commissionEarned = 0;
  let bonusEarned = 0;

  for (const rule of rules) {
    if (rule.ruleType === 'COMMISSION' && rule.commissionRate) {
      commissionEarned += (totalSales * rule.commissionRate) / 100;
    } else if (rule.ruleType === 'TARGET_BONUS' && rule.targetAmount && rule.bonusAmount) {
      if (totalSales >= rule.targetAmount) bonusEarned += rule.bonusAmount;
    } else if (rule.ruleType === 'PER_TRANSACTION' && rule.bonusPerTransaction && rule.minTransactionAmount) {
      const eligibleTxns = orders.filter((o) => Number(o.totalAmount) >= (rule.minTransactionAmount ?? 0)).length;
      bonusEarned += eligibleTxns * rule.bonusPerTransaction;
    }
  }

  const staffUser = await prisma.user.findUnique({ where: { id: staffId } });
  const payout = await prisma.incentivePayout.upsert({
    where: { staffId_outletId_month_year: { staffId, outletId, month, year } },
    update: { totalSales, totalTransactions, commissionEarned, bonusEarned, totalIncentive: commissionEarned + bonusEarned },
    create: {
      staffId,
      staffName: staffUser?.name ?? '',
      outletId,
      month,
      year,
      totalSales,
      totalTransactions,
      commissionEarned,
      bonusEarned,
      totalIncentive: commissionEarned + bonusEarned,
    },
  });

  res.json(successResponse(payout, 'Payout calculated'));
});

export default router;
