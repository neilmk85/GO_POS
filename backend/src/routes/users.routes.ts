import { Router, Request, Response } from 'express';
import * as userService from '../services/user.service';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse } from '../utils/response';
import { logActivity } from '../utils/activityLogger';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const outletId = req.query.outletId ? parseInt(req.query.outletId as string) : undefined;
  res.json(successResponse(await userService.getAllUsers(outletId)));
});

router.get('/roles', async (_req: Request, res: Response) => {
  res.json(successResponse(await userService.getAllRoles()));
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json(successResponse(await userService.getUserById(parseInt(req.params.id))));
});

router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  logActivity({ req, module: 'STAFF', action: 'CREATED', entityId: user.id, description: `Created user "${user.name}" (${user.email})` });
  res.json(successResponse(user, 'User created'));
});

router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const user = await userService.updateUser(parseInt(req.params.id), req.body);
  logActivity({ req, module: 'STAFF', action: 'UPDATED', entityId: user.id, description: `Updated user "${user.name}"` });
  res.json(successResponse(user, 'User updated'));
});

router.patch('/:id/toggle-active', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const user = await userService.toggleUserActive(parseInt(req.params.id));
  logActivity({ req, module: 'STAFF', action: 'UPDATED', entityId: user.id, description: `${user.active ? 'Activated' : 'Deactivated'} user "${user.name}"` });
  res.json(successResponse(user));
});

router.post('/:id/change-password', async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(parseInt(req.params.id), currentPassword, newPassword);
  logActivity({ req, module: 'STAFF', action: 'UPDATED', entityId: parseInt(req.params.id), description: `Changed password for user ID ${req.params.id}` });
  res.json(successResponse(null, 'Password changed'));
});

export default router;
