import { Request, Response, NextFunction } from 'express';
import { errorResponse, BusinessException, ResourceNotFoundException } from '../utils/response';

export function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  if (err instanceof BusinessException || err.name === 'BusinessException') {
    res.status(err.status || 400).json(errorResponse(err.message));
    return;
  }

  if (err instanceof ResourceNotFoundException || err.name === 'ResourceNotFoundException') {
    res.status(404).json(errorResponse(err.message));
    return;
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json(errorResponse('Invalid or expired token'));
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(422).json(errorResponse(err.message));
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientValidationError') {
    console.error('[PrismaValidation]', err.message);
    res.status(400).json(errorResponse('Invalid request data'));
    return;
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as { code?: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target?.[0] || 'field';
      res.status(409).json(errorResponse(`Duplicate value for ${field}`));
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json(errorResponse('Record not found'));
      return;
    }
  }

  res.status(err.status || 500).json(errorResponse(err.message || 'Internal server error'));
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json(errorResponse(`Route not found: ${req.method} ${req.path}`));
}
