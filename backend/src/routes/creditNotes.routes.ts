import { Router, Request, Response } from 'express';
import * as creditNoteService from '../services/creditNote.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  const { customerId, originalOrderId, outletId, totalAmount, reason, expiryDays } = req.body;
  const cn = await creditNoteService.createCreditNote({
    customerId,
    originalOrderId,
    outletId,
    totalAmount: new Decimal(totalAmount),
    reason,
    expiryDays,
  });
  res.json(successResponse(cn, 'Credit note created'));
});

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  res.json(successResponse(await creditNoteService.getCreditNotesByCustomer(parseInt(req.params.customerId))));
});

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await creditNoteService.getAllCreditNotes(parseInt(req.query.outletId as string), page, size)));
});

router.post('/:id/apply', async (req: Request, res: Response) => {
  const { amount } = req.body;
  res.json(successResponse(await creditNoteService.applyCreditNote(parseInt(req.params.id), new Decimal(amount)), 'Credit note applied'));
});

router.put('/:id/cancel', async (req: Request, res: Response) => {
  const { reason } = req.query as { reason?: string };
  res.json(successResponse(await creditNoteService.cancelCreditNote(parseInt(req.params.id), reason ?? ''), 'Credit note cancelled'));
});

export default router;
