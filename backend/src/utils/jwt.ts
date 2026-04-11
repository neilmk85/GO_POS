import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pos-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30d';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '365d';

export interface JwtPayload {
  email: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

export function generateRefreshToken(email: string): string {
  return jwt.sign({ email, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRY } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
