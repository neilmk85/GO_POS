import { Request } from 'express';
import prisma from './prisma';

interface LogOptions {
  req: Request;
  module: string;
  action: string;
  entityId?: number;
  description: string;
}

export async function logActivity({ req, module, action, entityId, description }: LogOptions) {
  try {
    await prisma.activityLog.create({
      data: {
        module,
        action,
        entityId: entityId ?? null,
        description,
        userId: req.user?.id ?? null,
        userName: req.user?.name ?? null,
        userEmail: req.user?.email ?? null,
        outletId: req.user?.outletId ?? null,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? null,
      },
    });
  } catch {
    // Never crash the request because of logging failure
  }
}

export function diffFields(before: Record<string, any>, after: Record<string, any>, fields: string[]): string {
  return fields
    .filter(f => before[f] !== undefined && String(before[f]) !== String(after[f] ?? ''))
    .map(f => `${f}: ${before[f]} → ${after[f] ?? ''}`)
    .join(', ');
}
