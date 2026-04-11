import { Router, Request, Response } from 'express';
import * as bulkPurchaseService from '../services/bulkPurchase.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  const { productId, outletId, purchaseQty, costPerUnit, supplier, invoiceNumber, purchaseDate, notes } = req.body;
  const saved = await bulkPurchaseService.recordPurchase(
    productId, outletId, purchaseQty, costPerUnit, supplier, invoiceNumber,
    purchaseDate ? new Date(purchaseDate) : undefined, notes
  );
  res.json(successResponse({ id: saved.id, referenceNumber: saved.referenceNumber }, 'Bulk purchase recorded'));
});

router.get('/stats', async (req: Request, res: Response) => {
  res.json(successResponse(await bulkPurchaseService.getTodayStats(parseInt(req.query.outletId as string))));
});

router.get('/product/:productId', async (req: Request, res: Response) => {
  const outletId = parseInt(req.query.outletId as string);
  res.json(successResponse(await bulkPurchaseService.getHistoryByProduct(parseInt(req.params.productId), outletId)));
});

router.get('/', async (req: Request, res: Response) => {
  const { outletId, from, to } = req.query as Record<string, string>;
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');

  if (from && to) {
    res.json(successResponse(await bulkPurchaseService.getHistoryByDate(parseInt(outletId), new Date(from), new Date(to), page, size)));
  } else {
    res.json(successResponse(await bulkPurchaseService.getHistory(parseInt(outletId), page, size)));
  }
});

router.patch('/:id/conversion-status', async (req: Request, res: Response) => {
  const { status } = req.query as { status: string };
  const updated = await bulkPurchaseService.updateConversionStatus(parseInt(req.params.id), status);
  res.json(successResponse({ id: updated.id, conversionStatus: updated.conversionStatus }, 'Status updated'));
});

router.post('/:id/convert', async (req: Request, res: Response) => {
  const { targetProductId, fromBaseQty, saleQty, saleUom, notes } = req.body;
  const result = await bulkPurchaseService.convert(parseInt(req.params.id), targetProductId, fromBaseQty, saleQty, saleUom, notes);
  res.json(successResponse(result, 'Conversion recorded'));
});

router.get('/:id/conversions', async (req: Request, res: Response) => {
  res.json(successResponse(await bulkPurchaseService.getConversions(parseInt(req.params.id))));
});

export default router;
