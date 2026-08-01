'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession, hashPassword } from '@/lib/auth';
import { getRepo } from '@/lib/repo';

export interface LoginState {
  error?: string;
}
export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!login || !password) return { error: 'Введите логин и пароль' };

  const user = await (await getRepo()).getUserByLogin(login);
  if (!user || !user.active || user.passwordHash !== hashPassword(password)) {
    return { error: 'Неверный логин или пароль' };
  }

  await createSession(user.id);
  redirect(user.role === 'cashier' ? '/pos' : user.role === 'platform_admin' ? '/admin' : '/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
