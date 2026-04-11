import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface RouteDescriptor {
  action: string;
  module: string;
  baseDescription: string;
}

function seg(path: string, prefix: string): boolean {
  return path.startsWith(prefix);
}

function describe(method: string, path: string): RouteDescriptor | null {
  // Normalize path: strip trailing slash
  const p = path.replace(/\/+$/, '');

  if (p === '/auth/login') return { action: 'LOGIN', module: 'AUTH', baseDescription: 'Logged in' };
  if (p === '/auth/logout') return { action: 'LOGOUT', module: 'AUTH', baseDescription: 'Logged out' };
  if (p === '/auth/register') return { action: 'CREATED', module: 'AUTH', baseDescription: 'Registered new user' };

  if (seg(p, '/invoices')) {
    if (method === 'POST' && p === '/invoices') return { action: 'CREATED', module: 'INVOICE', baseDescription: 'Created invoice' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'INVOICE', baseDescription: 'Updated invoice' };
    if (method === 'PATCH' && p.includes('/status')) return { action: 'UPDATED', module: 'INVOICE', baseDescription: 'Updated invoice status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'INVOICE', baseDescription: 'Deleted invoice' };
  }

  if (seg(p, '/quotations')) {
    if (method === 'POST' && p === '/quotations') return { action: 'CREATED', module: 'QUOTATION', baseDescription: 'Created quotation' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'QUOTATION', baseDescription: 'Updated quotation' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'QUOTATION', baseDescription: 'Updated quotation status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'QUOTATION', baseDescription: 'Deleted quotation' };
  }

  if (seg(p, '/orders')) {
    if (method === 'POST' && p.includes('/checkout')) return { action: 'CREATED', module: 'ORDER', baseDescription: 'Created order' };
    if (method === 'POST' && p.includes('/return')) return { action: 'CREATED', module: 'ORDER', baseDescription: 'Processed return' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'ORDER', baseDescription: 'Updated order' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'ORDER', baseDescription: 'Deleted order' };
  }

  if (seg(p, '/customers')) {
    if (method === 'POST' && p === '/customers') return { action: 'CREATED', module: 'CUSTOMER', baseDescription: 'Created customer' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'CUSTOMER', baseDescription: 'Updated customer' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'CUSTOMER', baseDescription: 'Deleted customer' };
  }

  if (seg(p, '/products')) {
    if (method === 'POST' && p === '/products') return { action: 'CREATED', module: 'PRODUCT', baseDescription: 'Created product' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'PRODUCT', baseDescription: 'Updated product' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'PRODUCT', baseDescription: 'Toggled product status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'PRODUCT', baseDescription: 'Deleted product' };
  }

  if (seg(p, '/inventory')) {
    if (p.includes('/adjust')) return { action: 'UPDATED', module: 'INVENTORY', baseDescription: 'Stock adjusted' };
    if (p.includes('/transfers')) {
      if (method === 'POST') return { action: 'CREATED', module: 'TRANSFER', baseDescription: 'Created stock transfer' };
      return { action: 'UPDATED', module: 'TRANSFER', baseDescription: 'Updated stock transfer' };
    }
    if (method === 'PUT') return { action: 'UPDATED', module: 'INVENTORY', baseDescription: 'Stock updated' };
  }

  if (seg(p, '/purchase-orders')) {
    if (method === 'POST') return { action: 'CREATED', module: 'PURCHASE_ORDER', baseDescription: 'Created purchase order' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'PURCHASE_ORDER', baseDescription: 'Updated purchase order' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'PURCHASE_ORDER', baseDescription: 'Updated purchase order status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'PURCHASE_ORDER', baseDescription: 'Deleted purchase order' };
  }

  if (seg(p, '/purchase-bills')) {
    if (method === 'POST' && p === '/purchase-bills') return { action: 'CREATED', module: 'BILL', baseDescription: 'Created purchase bill' };
    if (method === 'POST') return { action: 'UPDATED', module: 'BILL', baseDescription: 'Updated purchase bill' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'BILL', baseDescription: 'Deleted purchase bill' };
  }

  if (seg(p, '/bulk-purchases')) {
    if (method === 'POST' && p === '/bulk-purchases') return { action: 'CREATED', module: 'PURCHASE', baseDescription: 'Created bulk purchase' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'PURCHASE', baseDescription: 'Updated bulk purchase status' };
    if (method === 'POST' && p.includes('/convert')) return { action: 'CREATED', module: 'PURCHASE', baseDescription: 'Converted bulk purchase' };
  }

  if (seg(p, '/purchase-returns')) {
    if (method === 'POST') return { action: 'CREATED', module: 'RETURN', baseDescription: 'Created purchase return' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'RETURN', baseDescription: 'Updated purchase return' };
  }

  if (seg(p, '/credit-notes')) {
    if (method === 'POST' && p === '/credit-notes') return { action: 'CREATED', module: 'CREDIT_NOTE', baseDescription: 'Created credit note' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'CREDIT_NOTE', baseDescription: 'Updated credit note' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'CREDIT_NOTE', baseDescription: 'Deleted credit note' };
  }

  if (seg(p, '/discounts')) {
    if (method === 'POST' && p === '/discounts') return { action: 'CREATED', module: 'DISCOUNT', baseDescription: 'Created discount' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'DISCOUNT', baseDescription: 'Updated discount' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'DISCOUNT', baseDescription: 'Deleted discount' };
  }

  if (seg(p, '/expenses')) {
    if (method === 'POST' && p === '/expenses') return { action: 'CREATED', module: 'EXPENSE', baseDescription: 'Created expense' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'EXPENSE', baseDescription: 'Updated expense' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'EXPENSE', baseDescription: 'Updated expense status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'EXPENSE', baseDescription: 'Deleted expense' };
  }

  if (seg(p, '/users') || seg(p, '/staff')) {
    if (method === 'POST') return { action: 'CREATED', module: 'STAFF', baseDescription: 'Added staff member' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'STAFF', baseDescription: 'Updated staff member' };
    if (method === 'PATCH') return { action: 'UPDATED', module: 'STAFF', baseDescription: 'Changed staff status' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'STAFF', baseDescription: 'Removed staff member' };
  }

  if (seg(p, '/categories')) {
    if (method === 'POST' && p === '/categories') return { action: 'CREATED', module: 'CATEGORY', baseDescription: 'Created category' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'CATEGORY', baseDescription: 'Updated category' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'CATEGORY', baseDescription: 'Deleted category' };
  }

  if (seg(p, '/tax-groups')) {
    if (method === 'POST') return { action: 'CREATED', module: 'SETTINGS', baseDescription: 'Created tax group' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'SETTINGS', baseDescription: 'Updated tax group' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'SETTINGS', baseDescription: 'Deleted tax group' };
  }

  if (seg(p, '/outlets')) {
    if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATED', module: 'SETTINGS', baseDescription: 'Updated outlet settings' };
    if (method === 'POST') return { action: 'CREATED', module: 'SETTINGS', baseDescription: 'Created outlet' };
  }

  if (seg(p, '/integrations')) {
    if (method === 'PUT') return { action: 'UPDATED', module: 'SETTINGS', baseDescription: 'Updated integration settings' };
    if (method === 'POST' && p.includes('/test')) return { action: 'UPDATED', module: 'SETTINGS', baseDescription: 'Tested integration channel' };
    if (method === 'POST' && p.includes('/send')) return { action: 'UPDATED', module: 'SETTINGS', baseDescription: 'Sent communication' };
  }

  if (seg(p, '/shifts')) {
    if (method === 'POST') return { action: 'CREATED', module: 'SHIFT', baseDescription: 'Opened new shift' };
    if (method === 'PUT' || method === 'PATCH') return { action: 'UPDATED', module: 'SHIFT', baseDescription: 'Closed shift' };
  }

  if (seg(p, '/incentives')) {
    if (method === 'POST') return { action: 'CREATED', module: 'INCENTIVE', baseDescription: 'Created incentive rule' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'INCENTIVE', baseDescription: 'Updated incentive rule' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'INCENTIVE', baseDescription: 'Deleted incentive rule' };
  }

  if (seg(p, '/vendors')) {
    if (method === 'POST' && p === '/vendors') return { action: 'CREATED', module: 'VENDOR', baseDescription: 'Created vendor' };
    if (method === 'PUT') return { action: 'UPDATED', module: 'VENDOR', baseDescription: 'Updated vendor' };
    if (method === 'DELETE') return { action: 'DELETED', module: 'VENDOR', baseDescription: 'Deleted vendor' };
  }

  return null;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function buildDescription(base: string, entityLabel: string | null, entityId: number | null): string {
  if (entityLabel) return `${base} — ${entityLabel}`;
  if (entityId) return `${base} #${entityId}`;
  return base;
}

function extractEntityLabel(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const priorityFields = [
    'invoiceNumber', 'quotationNumber', 'orderNumber', 'billNumber',
    'creditNoteNumber', 'poNumber', 'referenceNumber',
    'name', 'title', 'code'
  ];
  for (const f of priorityFields) {
    if (b[f] && typeof b[f] === 'string' && (b[f] as string).trim()) {
      return b[f] as string;
    }
  }
  return null;
}

export function activityLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }

  const skipPaths = ['/activity-logs', '/uploads'];
  if (skipPaths.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  const originalSend = res.send.bind(res);
  res.send = function (body) {
    const result = originalSend(body);

    const status = res.statusCode;
    if (status < 200 || status >= 300) return result;

    const path = req.path.replace(/\/+$/, '');
    const desc = describe(req.method, path);
    if (!desc) return result;

    const user = req.user;
    const userId = user?.id ?? null;
    const userName = user?.name ?? null;
    const userEmail = user?.email ?? null;
    const outletId = user?.outletId ?? null;

    // Extract entity ID from path
    const idMatch = path.match(/\/(\d+)/);
    const entityId = idMatch ? parseInt(idMatch[1]) : null;

    // Use service-set description or derive from body
    const serviceDesc = req.activityDescription || null;
    const entityLabel = serviceDesc ? null : extractEntityLabel(req.body);
    const description = serviceDesc || buildDescription(desc.baseDescription, entityLabel, entityId);

    prisma.activityLog.create({
      data: {
        action: desc.action,
        module: desc.module,
        entityId: entityId,
        description,
        userId: userId,
        userName: userName,
        userEmail: userEmail,
        outletId: outletId,
        ipAddress: getClientIp(req),
      },
    }).catch((err: Error) => {
      console.warn('[ActivityLog] Failed to save:', err.message);
    });

    return result;
  };

  next();
}
