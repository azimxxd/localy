import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const OTP_COOKIE = 'localy_phone_verification';
const OTP_TTL_SECONDS = 5 * 60;

interface OtpPayload {
  phone: string;
  purpose: string;
  codeHash: string;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.LOCALY_OTP_SECRET || process.env.LOCALY_SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV !== 'production' || process.env.LOCALY_ALLOW_INSECURE_LOCAL === 'true') {
    return 'localy-development-only-verification-secret';
  }
  throw new Error('LOCALY_OTP_SECRET или LOCALY_SESSION_SECRET должен содержать минимум 32 символа');
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function codeHash(phone: string, purpose: string, code: string): string {
  return createHmac('sha256', secret()).update(`${phone}:${purpose}:${code}`).digest('base64url');
}

function encode(payload: OtpPayload): string {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${value}.${sign(value)}`;
}

function decode(token: string): OtpPayload | null {
  const [value, supplied] = token.split('.');
  if (!value || !supplied) return null;
  const expectedBuffer = Buffer.from(sign(value));
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as OtpPayload;
    if (!payload.phone || !payload.purpose || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

async function deliverCode(phone: string, code: string): Promise<void> {
  const webhook = process.env.LOCALY_SMS_WEBHOOK_URL;
  if (!webhook) {
    if (process.env.NODE_ENV !== 'production' || process.env.LOCALY_ALLOW_DEV_OTP === 'true') return;
    throw new Error('SMS-провайдер не настроен');
  }
  if (process.env.NODE_ENV === 'production' && !webhook.startsWith('https://')) {
    throw new Error('LOCALY_SMS_WEBHOOK_URL должен использовать HTTPS');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.LOCALY_SMS_WEBHOOK_SECRET
        ? { authorization: `Bearer ${process.env.LOCALY_SMS_WEBHOOK_SECRET}` }
        : {}),
    },
    body: JSON.stringify({ phone, code, message: `Код Localy: ${code}. Действует 5 минут.` }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`SMS-провайдер вернул ${response.status}`);
}

export async function issuePhoneVerification(phoneInput: string, purpose: string): Promise<{ devCode?: string }> {
  const phone = normalizePhone(phoneInput);
  const code = String(randomInt(100_000, 1_000_000));
  const payload: OtpPayload = {
    phone,
    purpose,
    codeHash: codeHash(phone, purpose, code),
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  (await cookies()).set(OTP_COOKIE, encode(payload), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && process.env.LOCALY_SECURE_COOKIES !== 'false',
    path: '/',
    maxAge: OTP_TTL_SECONDS,
    priority: 'high',
  });
  await deliverCode(phone, code);
  return process.env.NODE_ENV !== 'production' || process.env.LOCALY_ALLOW_DEV_OTP === 'true'
    ? { devCode: code }
    : {};
}

export async function verifyPhoneCode(phoneInput: string, purpose: string, code: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(OTP_COOKIE)?.value;
  if (!token) return false;
  const payload = decode(token);
  const phone = normalizePhone(phoneInput);
  if (!payload || payload.phone !== phone || payload.purpose !== purpose) return false;
  const expected = Buffer.from(payload.codeHash);
  const supplied = Buffer.from(codeHash(phone, purpose, code.trim()));
  const valid = expected.length === supplied.length && timingSafeEqual(expected, supplied);
  if (valid) store.delete(OTP_COOKIE);
  return valid;
}
