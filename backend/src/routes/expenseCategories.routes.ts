import { Router, Request, Response } from 'express';
import * as expenseService from '../services/expense.service';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  res.json(successResponse(await expenseService.getAllCategories()));
});

router.post('/', async (req: Request, res: Response) => {
  res.json(successResponse(await expenseService.createCategory(req.body), 'Category created'));
});

router.put('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await expenseService.updateCategory(parseInt(req.params.id), req.body), 'Category updated'));
});

router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  await expenseService.deleteCategory(parseInt(req.params.id));
  res.json(successResponse(null, 'Category deleted'));
});

export default router;
