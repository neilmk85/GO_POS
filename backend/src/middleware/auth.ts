import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';
import { errorResponse } from '../utils/response';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('No token provided'));
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    if (!payload.email) {
      res.status(401).json(errorResponse('Invalid token'));
      return;
    }
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.active) {
      res.status(401).json(errorResponse('User not found or inactive'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map((ur) => ur.role.name),
      outletId: user.outletId,
    };
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    const isExpired = message.includes('expired');
    res.status(401).json(errorResponse(isExpired ? 'Token expired' : 'Invalid token'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Not authenticated'));
      return;
    }
    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      res.status(403).json(errorResponse(`Required role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, res, next);
}
