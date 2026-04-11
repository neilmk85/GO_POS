import { Router, Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import * as integrationService from '../services/integration.service';
import { authenticate, optionalAuth } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

// Public route - no auth
router.get('/public/:invoiceNumber', optionalAuth, async (req: Request, res: Response) => {
  res.json(successResponse(await invoiceService.getByInvoiceNumber(req.params.invoiceNumber)));
});

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  const inv = await invoiceService.create(req.body);
  logActivity({ req, module: 'INVOICE', action: 'CREATED', entityId: inv.id, description: `Created invoice ${inv.invoiceNumber} — ₹${inv.totalAmount}` });
  res.json(successResponse(inv, 'Invoice created'));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, status, fromDate, toDate } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await invoiceService.getByOutlet(
    parseInt(outletId),
    status,
    fromDate ? new Date(fromDate) : undefined,
    toDate ? new Date(toDate) : undefined,
    page,
    size
  )));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await invoiceService.getById(parseInt(req.params.id))));
});

router.put('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await invoiceService.update(parseInt(req.params.id), req.body), 'Invoice updated'));
});

router.delete('/:id', async (req: Request, res: Response) => {
  await invoiceService.deleteInvoice(parseInt(req.params.id));
  res.json(successResponse(null, 'Invoice deleted'));
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.query as { status: string };
  res.json(successResponse(await invoiceService.updateStatus(parseInt(req.params.id), status), 'Status updated'));
});

router.patch('/:id/payment', async (req: Request, res: Response) => {
  const { amount } = req.query as { amount: string };
  res.json(successResponse(await invoiceService.recordPayment(parseInt(req.params.id), parseFloat(amount)), 'Payment recorded'));
});

router.post('/:id/send-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  await integrationService.sendInvoiceEmail(parseInt(req.params.id), email);
  res.json(successResponse(null, 'Invoice email sent'));
});

export default router;
