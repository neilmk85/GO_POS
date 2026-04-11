import { Router, Request, Response } from 'express';
import * as discountService from '../services/discount.service';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '0');
  const size = parseInt(req.query.size as string || '50');
  res.json(successResponse(await discountService.getAllDiscounts(page, size)));
});

router.get('/coupons', async (_req: Request, res: Response) => {
  res.json(successResponse(await discountService.getAllCoupons()));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await discountService.getDiscountById(parseInt(req.params.id))));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const d = await discountService.createDiscount(req.body);
  logActivity({ req, module: 'DISCOUNT', action: 'CREATED', entityId: d.id, description: `Created discount "${d.name}"` });
  res.json(successResponse(d, 'Discount created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const d = await discountService.updateDiscount(parseInt(req.params.id), req.body);
  logActivity({ req, module: 'DISCOUNT', action: 'UPDATED', entityId: d.id, description: `Updated discount "${d.name}"` });
  res.json(successResponse(d, 'Discount updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  await discountService.deleteDiscount(parseInt(req.params.id));
  logActivity({ req, module: 'DISCOUNT', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted discount ID ${req.params.id}` });
  res.json(successResponse(null, 'Discount deleted'));
});

// Coupons sub-routes
router.post('/coupons', async (req: Request, res: Response) => {
  const c = await discountService.createCoupon(req.body);
  logActivity({ req, module: 'DISCOUNT', action: 'CREATED', entityId: c.id, description: `Created coupon "${c.code}"` });
  res.json(successResponse(c, 'Coupon created'));
});

router.put('/coupons/:id', async (req: Request, res: Response) => {
  const c = await discountService.updateCoupon(parseInt(req.params.id), req.body);
  logActivity({ req, module: 'DISCOUNT', action: 'UPDATED', entityId: c.id, description: `Updated coupon "${c.code}"` });
  res.json(successResponse(c, 'Coupon updated'));
});

router.delete('/coupons/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  await discountService.deleteCoupon(parseInt(req.params.id));
  logActivity({ req, module: 'DISCOUNT', action: 'DELETED', entityId: parseInt(req.params.id), description: `Deleted coupon ID ${req.params.id}` });
  res.json(successResponse(null, 'Coupon deleted'));
});

export default router;
