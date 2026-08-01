'use server';

import { redirect } from 'next/navigation';
import { createCustomerSession } from '@/lib/auth';
import { getRepo } from '@/lib/repo';

export interface JoinState {
  error?: string;
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
  const digits = phone.replace(/\D/g, '');
  if (name.length < 2 || digits.length < 10) {
    return { error: 'Укажите имя и корректный номер телефона' };
  }

  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) return { error: 'Бизнес недоступен' };

  let customer = await repo.findCustomerByPhone(phone);
  const isNew = !customer;
  if (!customer) customer = await repo.createCustomer({ name, phone, birthday });
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
