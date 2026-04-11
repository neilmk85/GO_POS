import { Router, Request, Response } from 'express';
import * as customerService from '../services/customer.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const search = req.query.search as string | undefined;
  res.json(successResponse(await customerService.getAll(page, size, search)));
});

router.get('/with-dues', async (_req: Request, res: Response) => {
  res.json(successResponse(await customerService.getCustomersWithDues()));
});

router.get('/search', async (req: Request, res: Response) => {
  res.json(successResponse(await customerService.search(req.query.q as string)));
});

router.get('/phone/:phone', async (req: Request, res: Response) => {
  res.json(successResponse(await customerService.getByPhone(req.params.phone)));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await customerService.getById(parseInt(req.params.id))));
});

router.get('/:id/loyalty-history', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await customerService.getLoyaltyHistory(parseInt(req.params.id), page, size)));
});

router.post('/', async (req: Request, res: Response) => {
  const c = await customerService.createCustomer(req.body);
  logActivity({ req, module: 'CUSTOMER', action: 'CREATED', entityId: c.id, description: `Created customer "${c.name}"` });
  res.json(successResponse(c, 'Customer created'));
});

router.put('/:id', async (req: Request, res: Response) => {
  const c = await customerService.updateCustomer(parseInt(req.params.id), req.body);
  logActivity({ req, module: 'CUSTOMER', action: 'UPDATED', entityId: c.id, description: `Updated customer "${c.name}"` });
  res.json(successResponse(c, 'Customer updated'));
});

// CSV export
router.get('/export/csv', async (_req: Request, res: Response) => {
  const { getAll } = await import('../services/customer.service');
  const allCustomers = (await getAll(0, 10000)).content;
  const lines = ['name,phone,email,city,state,segment,loyaltyPoints,totalSpent,outstandingDue'];
  for (const c of allCustomers) {
    lines.push(`"${c.name}","${c.phone ?? ''}","${c.email ?? ''}","${c.city ?? ''}","${c.state ?? ''}","${c.segment}",${c.loyaltyPoints},${c.totalSpent},${c.outstandingDue}`);
  }
  res.setHeader('Content-Disposition', 'attachment; filename=customers_export.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(lines.join('\n'));
});

export default router;
