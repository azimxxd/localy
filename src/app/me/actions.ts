'use server';

/**
 * Действия клиентской витрины /me.
 *
 * Вызывающие: src/components/me/ClientQr.tsx.
 * Ротация QR раз в QR_ROTATION_SECONDS — защита от повторного использования
 * снятого экрана. Реальная проверка срока при списании — на стороне кассы.
 */

import { getRepo } from '@/lib/repo';
import { destroyCustomerSession, getCustomerSessionId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { NotificationChannel } from '@/lib/types';

export async function rotateToken(customerId: string): Promise<string> {
  const activeCustomerId = await getCustomerSessionId();
  if (!activeCustomerId || activeCustomerId !== customerId) {
    throw new Error('Нельзя обновить QR другого клиента');
  }
  const repo = await getRepo();
  const customer = await repo.rotateQrToken(customerId);
  return customer.qrToken;
}

export async function confirmPendingPurchase(transactionId: string): Promise<void> {
  const repo = await getRepo();
  const transaction = await repo.getTransaction(transactionId);
  if (!transaction) throw new Error('Операция не найдена');
  const customerId = await getCustomerSessionId();
  if (!customerId) throw new Error('Подтверждение доступно только вошедшему клиенту');
  if (transaction.customerId !== customerId) throw new Error('Нельзя подтвердить чужое списание');
  await repo.confirmRedeem(transactionId);
  revalidatePath('/me');
  revalidatePath(`/me/${transaction.businessId}`);
}

export async function updateMyConsent(businessId: string, channel: NotificationChannel, enabled: boolean): Promise<void> {
  const allowed: NotificationChannel[] = ['telegram', 'email', 'sms', 'whatsapp', 'push'];
  if (!allowed.includes(channel)) throw new Error('Неизвестный канал');
  const repo = await getRepo();
  const customerId = await getCustomerSessionId();
  if (!customerId) throw new Error('Изменение согласий доступно только вошедшему клиенту');
  const membership = await repo.getMembership(businessId, customerId);
  if (!membership) throw new Error('Вы не состоите в программе этого бизнеса');
  const channels = enabled ? [...new Set([...membership.consentChannels, channel])] : membership.consentChannels.filter((item) => item !== channel);
  await repo.updateConsent(businessId, customerId, channels);
  revalidatePath(`/me/${businessId}`);
}

export async function logoutCustomer(): Promise<never> {
  await destroyCustomerSession();
  redirect('/discover');
}
