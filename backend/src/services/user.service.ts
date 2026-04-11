import prisma from '../utils/prisma';
import { hashPassword } from '../utils/bcrypt';
import { BusinessException, ResourceNotFoundException } from '../utils/response';

export async function getAllUsers(outletId?: number) {
  return prisma.user.findMany({
    where: outletId ? { outletId } : undefined,
    include: { userRoles: { include: { role: true } }, outlet: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { include: { role: true } }, outlet: true },
  });
  if (!user) throw new ResourceNotFoundException('User', id);
  return user;
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  employeeCode?: string;
  pinCode?: string;
  outletId?: number;
  roles?: string[];
  maxDiscountPercent?: number;
}) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new BusinessException(`Email already in use: ${data.email}`);

  let roleIds: number[] = [];
  if (data.roles && data.roles.length > 0) {
    const roles = await prisma.role.findMany({ where: { name: { in: data.roles as never[] } } });
    roleIds = roles.map((r) => r.id);
  } else {
    const cashier = await prisma.role.findFirst({ where: { name: 'CASHIER' } });
    if (cashier) roleIds = [cashier.id];
  }

  const hashed = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      phone: data.phone,
      employeeCode: data.employeeCode,
      pinCode: data.pinCode,
      outletId: data.outletId,
      maxDiscountPercent: data.maxDiscountPercent ?? 10.0,
      userRoles: { create: roleIds.map((id) => ({ roleId: id })) },
    },
    include: { userRoles: { include: { role: true } }, outlet: true },
  });
}

export async function updateUser(id: number, data: {
  name?: string;
  phone?: string;
  employeeCode?: string;
  pinCode?: string;
  outletId?: number;
  roles?: string[];
  maxDiscountPercent?: number;
  profileImage?: string;
}) {
  await getUserById(id);

  const updateData: Record<string, unknown> = {
    name: data.name,
    phone: data.phone,
    employeeCode: data.employeeCode,
    pinCode: data.pinCode,
    outletId: data.outletId,
    maxDiscountPercent: data.maxDiscountPercent,
    profileImage: data.profileImage,
  };

  // Remove undefined values
  Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k]);

  if (data.roles && data.roles.length > 0) {
    const roles = await prisma.role.findMany({ where: { name: { in: data.roles as never[] } } });
    await prisma.userRole.deleteMany({ where: { userId: id } });
    updateData['userRoles'] = { create: roles.map((r) => ({ roleId: r.id })) };
  }

  return prisma.user.update({
    where: { id },
    data: updateData as never,
    include: { userRoles: { include: { role: true } }, outlet: true },
  });
}

export async function toggleUserActive(id: number) {
  const user = await getUserById(id);
  return prisma.user.update({
    where: { id },
    data: { active: !user.active },
    include: { userRoles: { include: { role: true } }, outlet: true },
  });
}

export async function changePassword(id: number, currentPassword: string, newPassword: string) {
  const { comparePassword } = await import('../utils/bcrypt');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ResourceNotFoundException('User', id);

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) throw new BusinessException('Current password is incorrect');

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
}

export async function getAllRoles() {
  return prisma.role.findMany();
}
