import { Router, Request, Response } from 'express';
import * as orderService from '../services/order.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.post('/checkout', async (req: Request, res: Response) => {
  const { billDiscount, billDiscountType, salesStaffId, ...rest } = req.body;
  const body = {
    ...rest,
    cashierId: req.user?.id,
    ...(billDiscount && billDiscountType === 'percent'
      ? { billDiscountPercent: billDiscount }
      : billDiscount
        ? { billDiscountAmount: billDiscount }
        : {}),
  };
  const result = await orderService.checkout(body, (desc) => { req.activityDescription = desc; });
  logActivity({ req, module: 'ORDER', action: 'CREATED', entityId: result.orderId, description: `Created order ${result.orderNumber} — ₹${result.totalAmount}` });
  res.json(successResponse(result, 'Order created'));
});

router.post('/return', async (req: Request, res: Response) => {
  const result = await orderService.processReturn(req.body, (desc) => { req.activityDescription = desc; });
  logActivity({ req, module: 'RETURN', action: 'CREATED', entityId: result.id, description: `Processed return for order — ₹${result.totalAmount ?? 0}` });
  res.json(successResponse(result, 'Return processed'));
});

router.get('/returns/:outletId', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size  = parseInt(req.query.size  as string || '100');
  const { from, to } = req.query as { from?: string; to?: string };
  const fromDate = from ? new Date(from) : undefined;
  const toDate   = to   ? new Date(to + 'T23:59:59') : undefined;
  res.json(successResponse(await orderService.getReturnOrders(parseInt(req.params.outletId), page, size, fromDate, toDate)));
});

router.get('/outlet/:outletId', async (req: Request, res: Response) => {
  const outletId = parseInt(req.params.outletId);
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  const { from, to } = req.query as { from?: string; to?: string };

  if (from && to) {
    const result = await orderService.getOrdersByOutletAndDateRange(
      outletId, new Date(from), new Date(to + 'T23:59:59'), page, size
    );
    res.json(successResponse(result));
  } else {
    res.json(successResponse(await orderService.getOrdersByOutlet(outletId, page, size)));
  }
});

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '20');
  res.json(successResponse(await orderService.getOrdersByCustomer(parseInt(req.params.customerId), page, size)));
});

router.get('/:orderNumber', async (req: Request, res: Response) => {
  res.json(successResponse(await orderService.getByOrderNumber(req.params.orderNumber)));
});

router.put('/:orderId/hold', async (req: Request, res: Response) => {
  const order = await orderService.holdOrder(parseInt(req.params.orderId));
  req.activityDescription = `Order ${order.orderNumber} put on hold`;
  res.json(successResponse(order, 'Order held'));
});

export default router;
