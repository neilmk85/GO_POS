import { Router, Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

function parseParams(req: Request) {
  return {
    outletId: parseInt(req.query.outletId as string),
    from: new Date(req.query.from as string),
    to: new Date(req.query.to as string + 'T23:59:59'),
  };
}

router.get('/sales-summary', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSalesSummary(outletId, from, to)));
});

router.get('/top-products', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const limit = parseInt(req.query.limit as string || '10');
  res.json(successResponse(await reportService.getTopProducts(outletId, from, to, limit)));
});

router.get('/payment-methods', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSalesByPaymentMethod(outletId, from, to)));
});

router.get('/daily-trend', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getDailySalesTrend(outletId, from, to)));
});

router.get('/sales-by-category', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSalesByCategory(outletId, from, to)));
});

router.get('/sales-by-product', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSalesByProduct(outletId, from, to)));
});

router.get('/sales-by-customer', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSalesByCustomer(outletId, from, to)));
});

router.get('/export/sales-csv', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await reportService.exportSalesCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename=sales_${req.query.from}_${req.query.to}.csv`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/purchase-summary', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getPurchaseSummary(outletId, from, to)));
});

router.get('/purchase-by-supplier', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getPurchaseBySupplier(outletId, from, to)));
});

router.get('/outstanding-pos', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getOutstandingPOs(outletId, from, to)));
});

router.get('/sale-returns', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getSaleReturns(outletId, from, to)));
});

router.get('/purchase-returns', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getPurchaseReturns(outletId, from, to)));
});

router.get('/outstanding-receivable', async (req: Request, res: Response) => {
  res.json(successResponse(await reportService.getOutstandingReceivable(parseInt(req.query.outletId as string))));
});

router.get('/payment-method-report', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  res.json(successResponse(await reportService.getPaymentMethodReport(outletId, from, to)));
});

router.get('/export/payment-csv', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await reportService.exportPaymentCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename=payments_${req.query.from}_${req.query.to}.csv`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/debtors-ledger', async (req: Request, res: Response) => {
  res.json(successResponse(await reportService.getDebtorsLedger(parseInt(req.query.outletId as string))));
});

router.get('/creditors-ledger', async (req: Request, res: Response) => {
  res.json(successResponse(await reportService.getCreditorsLedger(parseInt(req.query.outletId as string))));
});

router.get('/export/debtors-csv', async (req: Request, res: Response) => {
  const csv = await reportService.exportDebtorsCsv(parseInt(req.query.outletId as string));
  res.setHeader('Content-Disposition', 'attachment; filename=debtors_ledger.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/export/creditors-csv', async (req: Request, res: Response) => {
  const csv = await reportService.exportCreditorsCsv(parseInt(req.query.outletId as string));
  res.setHeader('Content-Disposition', 'attachment; filename=creditors_ledger.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/export/purchase-csv', async (req: Request, res: Response) => {
  const { outletId, from, to } = parseParams(req);
  const csv = await reportService.exportPurchaseCsv(outletId, from, to);
  res.setHeader('Content-Disposition', `attachment; filename=purchases_${req.query.from}_${req.query.to}.csv`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

export default router;
