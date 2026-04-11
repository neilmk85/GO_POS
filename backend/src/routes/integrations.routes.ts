import { Router, Request, Response } from 'express';
import * as integrationService from '../services/integration.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

// ── Channels ─────────────────────────────────────────────────────────────────

router.get('/channels', async (req: Request, res: Response) => {
  const outletId = parseInt(req.query.outletId as string);
  const config = await integrationService.getConfig(outletId);
  res.json(successResponse(config?.channelConfig ?? {}));
});

router.put('/channels', async (req: Request, res: Response) => {
  const { outletId, ...channelConfig } = req.body;
  await integrationService.upsertChannelConfig(outletId, channelConfig);
  res.json(successResponse(null, 'Channel settings updated'));
});

// ── Message Templates ─────────────────────────────────────────────────────────

router.get('/templates', async (req: Request, res: Response) => {
  const outletId = parseInt(req.query.outletId as string);
  const config = await integrationService.getConfig(outletId);
  res.json(successResponse(config?.templates ?? {}));
});

router.put('/templates', async (req: Request, res: Response) => {
  const { outletId, templates } = req.body;
  await integrationService.upsertTemplates(outletId, templates);
  res.json(successResponse(null, 'Templates updated'));
});

// ── Test channel ──────────────────────────────────────────────────────────────

router.post('/test', async (req: Request, res: Response) => {
  const { outletId, channel } = req.body;
  if (channel === 'email') {
    const config = await integrationService.getConfig(outletId);
    const emailCfg = config?.channelConfig ? (config.channelConfig as Record<string, unknown>)['email'] as { fromEmail?: string } : undefined;
    await integrationService.testEmail(outletId, emailCfg?.fromEmail ?? req.user?.email ?? '');
  }
  res.json(successResponse(null, `Test ${channel} sent`));
});

// ── Send emails ───────────────────────────────────────────────────────────────

router.post('/send/invoice-email', async (req: Request, res: Response) => {
  const { invoiceId, email } = req.body;
  await integrationService.sendInvoiceEmail(invoiceId, email);
  res.json(successResponse(null, 'Invoice email sent'));
});

router.post('/send/quotation-email', async (req: Request, res: Response) => {
  const { quotationId, email } = req.body;
  await integrationService.sendQuotationEmail(quotationId, email);
  res.json(successResponse(null, 'Quotation email sent'));
});

// ── Legacy routes (kept for backwards compat) ─────────────────────────────────

router.get('/:outletId', async (req: Request, res: Response) => {
  const config = await integrationService.getConfig(parseInt(req.params.outletId));
  res.json(successResponse(config));
});

router.put('/:outletId', async (req: Request, res: Response) => {
  const { channelConfig, templates } = req.body;
  const config = await integrationService.upsertConfig(
    parseInt(req.params.outletId),
    channelConfig,
    templates
  );
  res.json(successResponse(config, 'Integration settings updated'));
});

router.post('/test-email', async (req: Request, res: Response) => {
  const { outletId, email } = req.body;
  await integrationService.testEmail(outletId, email);
  res.json(successResponse(null, 'Test email sent'));
});

router.post('/send-invoice-email', async (req: Request, res: Response) => {
  const { invoiceId, email } = req.body;
  await integrationService.sendInvoiceEmail(invoiceId, email);
  res.json(successResponse(null, 'Invoice email sent'));
});

router.post('/send-quotation-email', async (req: Request, res: Response) => {
  const { quotationId, email } = req.body;
  await integrationService.sendQuotationEmail(quotationId, email);
  res.json(successResponse(null, 'Quotation email sent'));
});

export default router;
