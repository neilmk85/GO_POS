import { Router, Request, Response } from 'express';
import * as gstService from '../services/gst.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();
router.use(authenticate);

function parseParams(req: Request) {
  return {
    outletId: parseInt(req.query.outletId as string),
    from: new Date(req.query.from as string),
    to: new Date((req.query.to as string) + 'T23:59:59'),
  };
}

router.get('/gstr1', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await gstService.getGstr1(outletId, from, to)));
});

router.get('/gstr1/export', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await gstService.exportGstr1Csv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${req.query.from}_${req.query.to}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/gstr3b', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await gstService.getGstr3b(outletId, from, to)));
});

router.get('/gstr3b/export', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await gstService.exportGstr3bCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename="GSTR3B_${req.query.from}_${req.query.to}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/hsn-summary', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await gstService.getHsnSummary(outletId, from, to)));
});

router.get('/hsn-summary/export', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await gstService.exportHsnCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename="HSN_Summary_${req.query.from}_${req.query.to}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/hsn-purchase-summary', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await gstService.getHsnPurchaseSummary(outletId, from, to)));
});

router.get('/hsn-purchase-summary/export', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await gstService.exportHsnPurchaseCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename="HSN_Purchase_${req.query.from}_${req.query.to}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

router.get('/tally-export', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const xml = await gstService.tallyExport(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename="Tally_Export_${req.query.from}_${req.query.to}.xml"`);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

export default router;
