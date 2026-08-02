'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession, hashPassword, passwordNeedsRehash, verifyPassword } from '@/lib/auth';
import { enforceRateLimit, requestRateLimitKey } from '@/lib/rate-limit';
import { getRepo } from '@/lib/repo';

export interface LoginState {
  error?: string;
}
export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!login || !password) return { error: 'Введите логин и пароль' };

  const rateKey = await requestRateLimitKey(`login:${login}`);
  if (!(await enforceRateLimit(rateKey, 8, 15 * 60_000))) {
    return { error: 'Слишком много попыток. Повторите через 15 минут.' };
  }

  const repo = await getRepo();
  const user = await repo.getUserByLogin(login);
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: 'Неверный логин или пароль' };
  }

  if (passwordNeedsRehash(user.passwordHash)) {
    await repo.updateUser(user.id, { passwordHash: hashPassword(password) });
  }

  await createSession(user.id);
  redirect(user.role === 'cashier' ? '/pos' : user.role === 'platform_admin' ? '/admin' : '/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
