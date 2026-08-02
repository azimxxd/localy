'use server';

import { redirect } from 'next/navigation';
import { createCustomerSession } from '@/lib/auth';
import { issuePhoneVerification, normalizePhone, verifyPhoneCode } from '@/lib/phone-verification';
import { enforceRateLimit, requestRateLimitKey } from '@/lib/rate-limit';
import { getRepo } from '@/lib/repo';

export interface JoinState {
  error?: string;
  verificationRequired?: boolean;
  devCode?: string;
  values?: { name: string; phone: string; birthday: string; consent: boolean };
}

export async function registerAndJoin(
  slug: string,
  _state: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const birthday = String(formData.get('birthday') ?? '').trim() || null;
  const consent = formData.get('consent') === 'on';
  const verificationCode = String(formData.get('verificationCode') ?? '').trim();
  const digits = normalizePhone(phone).slice(1);
  if (name.length < 2 || digits.length < 10) {
    return { error: 'Укажите имя и корректный номер телефона' };
  }

  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) return { error: 'Бизнес недоступен' };

  const values = { name, phone, birthday: birthday ?? '', consent };
  const purpose = `join:${slug}`;
  if (!verificationCode) {
    const key = await requestRateLimitKey(`otp-send:${normalizePhone(phone)}`);
    if (!(await enforceRateLimit(key, 3, 15 * 60_000))) {
      return { error: 'Слишком много кодов. Повторите через 15 минут.', values };
    }
    try {
      const issued = await issuePhoneVerification(phone, purpose);
      return { verificationRequired: true, devCode: issued.devCode, values };
    } catch {
      return { error: 'Не удалось отправить код. Попробуйте позже.', values };
    }
  }

  const verifyKey = await requestRateLimitKey(`otp-check:${normalizePhone(phone)}`);
  if (!(await enforceRateLimit(verifyKey, 5, 15 * 60_000))) {
    return { error: 'Слишком много попыток. Запросите новый код позже.', verificationRequired: true, values };
  }
  if (!(await verifyPhoneCode(phone, purpose, verificationCode))) {
    return { error: 'Неверный или просроченный код', verificationRequired: true, values };
  }

  const normalizedPhone = normalizePhone(phone);
  let customer = await repo.findCustomerByPhone(normalizedPhone);
  const isNew = !customer;
  if (!customer) customer = await repo.createCustomer({ name, phone: normalizedPhone, birthday });
  const existingMembership = await repo.getMembership(business.id, customer.id);
  await repo.joinBusiness(business.id, customer.id);
  await repo.updateConsent(
    business.id,
    customer.id,
    consent ? ['telegram', 'push'] : [],
  );
  if (isNew || !existingMembership) await repo.incrementBusinessQrStat(business.id, 'registration');
  await createCustomerSession(customer.id);
  redirect('/me');
}
