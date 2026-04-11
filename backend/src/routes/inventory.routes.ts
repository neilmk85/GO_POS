import { Router, Request, Response } from 'express';
import * as inventoryService from '../services/inventory.service';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/product/:productId/outlet/:outletId', async (req: Request, res: Response) => {
  res.json(successResponse(await inventoryService.getStock(
    parseInt(req.params.productId), parseInt(req.params.outletId)
  )));
});

router.get('/product/:productId/all-outlets', async (req: Request, res: Response) => {
  res.json(successResponse(await inventoryService.getStockAcrossOutlets(parseInt(req.params.productId))));
});

router.get('/outlet/:outletId', async (req: Request, res: Response) => {
  res.json(successResponse(await inventoryService.getAllByOutlet(parseInt(req.params.outletId))));
});

router.get('/low-stock', async (req: Request, res: Response) => {
  res.json(successResponse(await inventoryService.getLowStockByOutlet(parseInt(req.query.outletId as string))));
});

router.post('/adjust', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'MANAGER'), async (req: Request, res: Response) => {
  const { productId, outletId, quantity, reason, notes, userId } = req.body;
  const result = await inventoryService.adjustStock(productId, outletId, quantity, reason, notes, userId || req.user?.id);
  logActivity({ req, module: 'INVENTORY', action: 'UPDATED', entityId: productId, description: `Stock adjusted — product ID ${productId}, qty: ${quantity > 0 ? '+' : ''}${quantity}, reason: ${reason ?? 'Manual'}${notes ? `, notes: ${notes}` : ''}` });
  res.json(successResponse(result, 'Stock adjusted'));
});

router.get('/adjustments', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await inventoryService.getAdjustments(parseInt(req.query.outletId as string), page, size)));
});

// Transfers
router.post('/transfers', requireRole('ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'MANAGER'), async (req: Request, res: Response) => {
  const { fromOutletId, toOutletId, items, notes, requestedById } = req.body;
  const result = await inventoryService.createTransfer(fromOutletId, toOutletId, items, notes, requestedById || req.user?.id);
  logActivity({ req, module: 'TRANSFER', action: 'CREATED', entityId: result.id, description: `Created stock transfer — outlet ${fromOutletId} → ${toOutletId}, ${items?.length ?? 0} item(s)` });
  res.json(successResponse(result, 'Transfer created'));
});

router.put('/transfers/:id/approve', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const approvedById = parseInt(req.query.approvedById as string) || req.user?.id!;
  const result = await inventoryService.approveTransfer(parseInt(req.params.id), approvedById);
  logActivity({ req, module: 'TRANSFER', action: 'UPDATED', entityId: parseInt(req.params.id), description: `Approved stock transfer ID ${req.params.id}` });
  res.json(successResponse(result, 'Transfer approved'));
});

router.put('/transfers/:id/ship', async (req: Request, res: Response) => {
  const result = await inventoryService.shipTransfer(parseInt(req.params.id));
  logActivity({ req, module: 'TRANSFER', action: 'UPDATED', entityId: parseInt(req.params.id), description: `Shipped stock transfer ID ${req.params.id}` });
  res.json(successResponse(result, 'Transfer shipped'));
});

router.put('/transfers/:id/receive', async (req: Request, res: Response) => {
  const { receivedItems, receivedById } = req.body;
  const result = await inventoryService.receiveTransfer(parseInt(req.params.id), receivedItems, receivedById || req.user?.id);
  logActivity({ req, module: 'TRANSFER', action: 'UPDATED', entityId: parseInt(req.params.id), description: `Received stock transfer ID ${req.params.id}` });
  res.json(successResponse(result, 'Transfer received'));
});

router.get('/transfers', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await inventoryService.getTransfers(parseInt(req.query.outletId as string), page, size)));
});

export default router;
