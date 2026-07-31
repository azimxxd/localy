import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import type { UserRole } from '@/lib/types';

export const SESSION_COOKIE = 'localy_session';
export const CUSTOMER_COOKIE = 'localy_customer';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SESSION_SECRET =
  process.env.LOCALY_SESSION_SECRET || 'localy-local-demo-session-secret-change-in-production';

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

export interface SessionUser {
  userId: string;
  login: string;
  name: string;
  role: UserRole;
  businessId: string | null;
  staffId: string | null;
}

export function hashPassword(password: string): string {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

function signature(value: string): string {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function encodeSession(payload: SessionPayload): string {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${value}.${signature(value)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [value, suppliedSignature] = token.split('.');
  if (!value || !suppliedSignature) return null;

  const expected = Buffer.from(signature(value));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    encodeSession({ userId, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.LOCALY_SECURE_COOKIES === 'true',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  );
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function createCustomerSession(customerId: string): Promise<void> {
  const store = await cookies();
  store.set(
    CUSTOMER_COOKIE,
    encodeSession({ userId: customerId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.LOCALY_SECURE_COOKIES === 'true',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    },
  );
}

export async function getCustomerSessionId(): Promise<string | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token)?.userId ?? null;
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = decodeSession(token);
  if (!payload) return null;

  const repo = await getRepo();
  const user = await repo.getUser(payload.userId);
  if (!user?.active) return null;
  if (user.businessId) {
    const business = await repo.getBusiness(user.businessId);
    if (!business || business.active === false) return null;
  }
  return {
    userId: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
    staffId: user.staffId,
  };
}

export async function requireSession(allowedRoles?: readonly UserRole[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (allowedRoles && !allowedRoles.includes(session.role)) redirect('/forbidden');
  return session;
}

/** Авторизация для Server Actions: не доверяет businessId из формы. */
export async function requireBusinessAccess(
  requestedBusinessId?: string,
  allowedRoles: readonly UserRole[] = ['owner', 'admin', 'marketer', 'cashier', 'manager'],
): Promise<SessionUser & { businessId: string }> {
  const session = await getSession();
  if (!session) throw new Error('Требуется вход в Localy');
  if (!allowedRoles.includes(session.role)) throw new Error('Недостаточно прав для этого действия');
  if (!session.businessId) throw new Error('Пользователь не привязан к бизнесу');
  if (requestedBusinessId && requestedBusinessId !== session.businessId) {
    throw new Error('Нет доступа к данным другого бизнеса');
  }
  return { ...session, businessId: session.businessId };
}
