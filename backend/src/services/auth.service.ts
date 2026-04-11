import prisma from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { BusinessException, ResourceNotFoundException } from '../utils/response';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roles?: string[];
  outletId?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: number;
  name: string;
  email: string;
  roles: string[];
  outletId: number | null;
  outletName: string | null;
}

async function getUserWithRoles(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: { include: { role: true } },
      outlet: true,
    },
  });
}

function buildAuthResponse(
  user: NonNullable<Awaited<ReturnType<typeof getUserWithRoles>>>,
  accessToken: string,
  refreshToken: string
): AuthResponse {
  return {
    accessToken,
    refreshToken,
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.userRoles.map((ur) => ur.role.name),
    outletId: user.outletId,
    outletName: user.outlet?.name ?? null,
  };
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  const user = await getUserWithRoles(req.email);
  if (!user || !user.active) throw new ResourceNotFoundException('User not found');

  const valid = await comparePassword(req.password, user.password);
  if (!valid) throw new BusinessException('Invalid credentials');

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const accessToken = generateAccessToken(user.email);
  const refreshToken = generateRefreshToken(user.email);

  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function register(req: RegisterRequest): Promise<AuthResponse> {
  const exists = await prisma.user.findUnique({ where: { email: req.email } });
  if (exists) throw new BusinessException(`Email already in use: ${req.email}`);

  let roleIds: number[] = [];
  if (req.roles && req.roles.length > 0) {
    const roles = await prisma.role.findMany({ where: { name: { in: req.roles as never[] } } });
    if (roles.length !== req.roles.length) throw new BusinessException('One or more roles not found');
    roleIds = roles.map((r) => r.id);
  } else {
    const cashier = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
    if (!cashier) throw new BusinessException('Default role not found');
    roleIds = [cashier.id];
  }

  const hashed = await hashPassword(req.password);
  const user = await prisma.user.create({
    data: {
      name: req.name,
      email: req.email,
      password: hashed,
      phone: req.phone,
      outletId: req.outletId,
      userRoles: { create: roleIds.map((id) => ({ roleId: id })) },
    },
    include: { userRoles: { include: { role: true } }, outlet: true },
  });

  const accessToken = generateAccessToken(user.email);
  const refreshToken = generateRefreshToken(user.email);
  return buildAuthResponse(user, accessToken, refreshToken);
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  let payload: { email: string };
  try {
    payload = verifyToken(token);
  } catch {
    throw new BusinessException('Invalid refresh token');
  }

  const user = await getUserWithRoles(payload.email);
  if (!user) throw new ResourceNotFoundException('User not found');

  const accessToken = generateAccessToken(user.email);
  const newRefreshToken = generateRefreshToken(user.email);
  return buildAuthResponse(user, accessToken, newRefreshToken);
}
