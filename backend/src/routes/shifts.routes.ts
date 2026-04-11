import { Router, Request, Response } from 'express';
import * as shiftService from '../services/shift.service';
import { authenticate } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

router.post('/open', async (req: Request, res: Response) => {
  const { outletId, cashierId, openingCash } = req.body;
  res.json(successResponse(await shiftService.openShift(outletId, cashierId, openingCash), 'Shift opened'));
});

router.put('/:shiftId/close', async (req: Request, res: Response) => {
  const { closingCash, notes } = req.body;
  res.json(successResponse(await shiftService.closeShift(parseInt(req.params.shiftId), closingCash, notes), 'Shift closed'));
});

router.get('/current/:cashierId', async (req: Request, res: Response) => {
  res.json(successResponse(await shiftService.getCurrentShift(parseInt(req.params.cashierId))));
});

router.get('/outlet/:outletId', async (req: Request, res: Response) => {
  res.json(successResponse(await shiftService.getShiftsByOutlet(parseInt(req.params.outletId))));
});

export default router;
