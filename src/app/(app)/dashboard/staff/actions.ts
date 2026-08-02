'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getSession, hashPassword, requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { StaffRole } from '@/lib/types';

const MANAGED_ROLES: StaffRole[] = ['admin', 'marketer', 'manager', 'cashier'];

function cleanRole(value: string): StaffRole {
  if (!MANAGED_ROLES.includes(value as StaffRole)) throw new Error('Недопустимая роль сотрудника');
  return value as StaffRole;
}

export async function inviteStaff(input: {
  businessId: string;
  name: string;
  login: string;
  password: string;
  role: string;
  branchId: string | null;
}): Promise<void> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  const role = cleanRole(input.role);
  if (session.role === 'admin' && role === 'admin') throw new Error('Администратор не может назначать других администраторов');
  const name = input.name.trim();
  const login = input.login.trim().toLowerCase();
  if (name.length < 2) throw new Error('Укажите имя сотрудника');
  if (!/^\S+@\S+\.\S+$/.test(login)) throw new Error('Укажите рабочий email');
  if (input.password.length < 12 || !/[a-zа-я]/i.test(input.password) || !/\d/.test(input.password) || !/[^\p{L}\p{N}]/u.test(input.password)) {
    throw new Error('Пароль: минимум 12 символов, буква, цифра и специальный знак');
  }

  const repo = await getRepo();
  if (await repo.getUserByLogin(login)) throw new Error('Пользователь с таким email уже существует');
  const staff = await repo.createStaff({
    businessId: input.businessId,
    branchId: input.branchId,
    name,
    role,
    pin: String(randomInt(1000, 10_000)),
    active: true,
  });
  await repo.createUser({
    login,
    name,
    passwordHash: hashPassword(input.password),
    role,
    businessId: input.businessId,
    staffId: staff.id,
    active: true,
  });
  revalidatePath('/dashboard/staff');
}

export async function updateStaffAccess(input: {
  businessId: string;
  staffId: string;
  role: string;
  branchId: string | null;
  active: boolean;
}): Promise<void> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  const repo = await getRepo();
  const current = (await repo.listStaff(input.businessId)).find((item) => item.id === input.staffId);
  if (!current) throw new Error('Сотрудник не найден');
  if (current.role === 'owner') throw new Error('Доступ владельца меняется только через поддержку Localy');
  const role = cleanRole(input.role);
  if (session.role === 'admin' && (current.role === 'admin' || role === 'admin')) {
    throw new Error('Изменять администраторов может только владелец');
  }
  await repo.updateStaff(input.staffId, { role, branchId: input.branchId, active: input.active });
  const user = (await repo.listUsers()).find((item) => item.staffId === input.staffId && item.businessId === input.businessId);
  if (user) await repo.updateUser(user.id, { role, active: input.active });
  revalidatePath('/dashboard/staff');
}

export async function currentStaffPermissions(): Promise<'owner' | 'admin'> {
  const session = await getSession();
  if (session?.role !== 'owner' && session?.role !== 'admin') throw new Error('Недостаточно прав');
  return session.role;
}
