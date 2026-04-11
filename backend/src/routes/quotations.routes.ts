import { Router, Request, Response } from 'express';
import * as quotationService from '../services/quotation.service';
import * as integrationService from '../services/integration.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  const q = await quotationService.create(req.body);
  logActivity({ req, module: 'QUOTATION', action: 'CREATED', entityId: q.id, description: `Created quotation ${q.quotationNumber} — ₹${q.totalAmount}` });
  res.json(successResponse(q, 'Quotation created'));
});

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await quotationService.getByOutlet(parseInt(req.query.outletId as string), page, size)));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await quotationService.getById(parseInt(req.params.id))));
});

router.put('/:id', async (req: Request, res: Response) => {
  const q = await quotationService.update(parseInt(req.params.id), req.body);
  logActivity({ req, module: 'QUOTATION', action: 'UPDATED', entityId: q.id, description: `Updated quotation ${q.quotationNumber}` });
  res.json(successResponse(q, 'Quotation updated'));
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.query as { status: string };
  res.json(successResponse(await quotationService.updateStatus(parseInt(req.params.id), status), 'Status updated'));
});

router.delete('/:id', async (req: Request, res: Response) => {
  await quotationService.deleteQuotation(parseInt(req.params.id));
  logActivity({ req, module: 'QUOTATION', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted quotation ID ${req.params.id}` });
  res.json(successResponse(null, 'Quotation deleted'));
});

router.post('/:id/send-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  await integrationService.sendQuotationEmail(parseInt(req.params.id), email);
  res.json(successResponse(null, 'Quotation email sent'));
});

export default router;
