import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/prisma';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  // Log login after successful auth
  try {
    await prisma.activityLog.create({
      data: {
        module: 'AUTH',
        action: 'LOGIN',
        description: `${result.name} logged in`,
        userId: result.userId,
        userName: result.name,
        userEmail: result.email,
        outletId: result.outletId,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? null,
      },
    });
  } catch {}
  res.json(successResponse(result));
});

router.post('/register', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.json(successResponse(result, 'User registered successfully'));
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.query as { refreshToken: string };
  const result = await authService.refreshToken(refreshToken);
  res.json(successResponse(result));
});

export default router;
