import { Router, Request, Response } from 'express';
import * as expenseService from '../services/expense.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/stats', async (req: Request, res: Response) => {
  const { outletId, from, to } = req.query as Record<string, string>;
  res.json(successResponse(await expenseService.getStats(
    parseInt(outletId),
    from ? new Date(from) : undefined,
    to   ? new Date(to + 'T23:59:59') : undefined,
  )));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, from, to, categoryId, paymentMode, status, itcEligible } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await expenseService.search(
    parseInt(outletId),
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
    categoryId ? parseInt(categoryId) : undefined,
    paymentMode,
    status,
    itcEligible !== undefined ? itcEligible === 'true' : undefined,
    page,
    size
  )));
});

router.post('/', async (req: Request, res: Response) => {
  res.json(successResponse(await expenseService.create(req.body), 'Expense recorded'));
});

router.put('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await expenseService.update(parseInt(req.params.id), req.body), 'Expense updated'));
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.query as { status: string };
  res.json(successResponse(await expenseService.updateStatus(parseInt(req.params.id), status), 'Status updated'));
});

router.delete('/:id', async (req: Request, res: Response) => {
  await expenseService.deleteExpense(parseInt(req.params.id));
  res.json(successResponse(null, 'Expense deleted'));
});

router.post('/generate-recurring', async (_req: Request, res: Response) => {
  const count = await expenseService.generateDueRecurringExpenses();
  res.json(successResponse({ generated: count }, `Generated ${count} recurring expense(s)`));
});

router.get('/export/csv', async (req: Request, res: Response) => {
  const { outletId, from, to, categoryId, paymentMode, status } = req.query as Record<string, string>;
  const expenses = await expenseService.getAllForExport(
    parseInt(outletId),
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined,
    categoryId ? parseInt(categoryId) : undefined,
    paymentMode,
    status
  );
  const lines = ['Date,Category,Vendor,Payment Mode,Amount,GST Amount,Total Amount,Status'];
  for (const e of expenses) {
    const fmt = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') ? `"${s}"` : s;
    };
    lines.push(`${e.expenseDate.toISOString().split('T')[0]},${fmt(e.expenseCategory?.name)},${fmt(e.vendor)},${e.paymentMode},${e.amount},${e.gstAmount},${e.totalAmount},${e.status}`);
  }
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${date}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\uFEFF' + lines.join('\n'));
});

export default router;
