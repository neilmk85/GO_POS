import { Request } from 'express';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  roles: string[];
  outletId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      activityDescription?: string;
    }
  }
}
