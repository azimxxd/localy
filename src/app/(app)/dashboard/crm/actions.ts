'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { NotificationChannel } from '@/lib/types';

export async function addCustomerToBusiness(input: {
  businessId: string;
  name: string;
  phone: string;
}): Promise<{ customerId: string }> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager']);
  if (input.name.trim().length < 2 || input.phone.replace(/\D/g, '').length < 10) {
    throw new Error('Проверьте имя и телефон');
  }
  const repo = await getRepo();
  let customer = await repo.findCustomerByPhone(input.phone);
  if (!customer) customer = await repo.createCustomer({ name: input.name.trim(), phone: input.phone.trim(), birthday: null });
  await repo.joinBusiness(input.businessId, customer.id);
  await repo.updateMembership(input.businessId, customer.id, { source: 'Добавлен сотрудником' });
  revalidatePath('/dashboard/crm');
  return { customerId: customer.id };
}

export async function updateCustomerCard(input: {
  businessId: string;
  customerId: string;
  name: string;
  phone: string;
  birthday: string | null;
  source: string;
  notes: string;
  consentChannels: NotificationChannel[];
}): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager']);
  if (input.name.trim().length < 2 || input.phone.replace(/\D/g, '').length < 10) {
    throw new Error('Проверьте имя и телефон');
  }
  const repo = await getRepo();
  const membership = await repo.getMembership(input.businessId, input.customerId);
  if (!membership) throw new Error('Нет доступа к клиенту другого бизнеса');
  await Promise.all([
    repo.updateCustomer(input.customerId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      birthday: input.birthday || null,
    }),
    repo.updateMembership(input.businessId, input.customerId, {
      source: input.source.trim(),
      notes: input.notes.trim(),
    }),
    repo.updateConsent(input.businessId, input.customerId, input.consentChannels),
  ]);
  revalidatePath(`/dashboard/crm/${input.customerId}`);
  revalidatePath('/dashboard/crm');
}

export async function adjustCustomerPoints(input: {
  businessId: string;
  customerId: string;
  delta: number;
  note: string;
}): Promise<void> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager']);
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 100_000) {
    throw new Error('Укажите целое число от -100 000 до 100 000');
  }
  if (input.note.trim().length < 3) throw new Error('Укажите причину корректировки');
  const repo = await getRepo();
  const membership = await repo.getMembership(input.businessId, input.customerId);
  if (!membership) throw new Error('Нет доступа к клиенту');
  await repo.adjustPoints(input.businessId, input.customerId, session.staffId, input.delta, input.note.trim());
  revalidatePath(`/dashboard/crm/${input.customerId}`);
  revalidatePath('/dashboard/crm');
}

export async function removeCustomerFromCrm(input: { businessId: string; customerId: string }): Promise<void> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  const repo = await getRepo();
  if (!(await repo.getMembership(input.businessId, input.customerId))) throw new Error('Клиент не найден');
  await repo.removeCustomerFromBusiness(input.businessId, input.customerId, session.userId);
  revalidatePath('/dashboard/crm');
}
