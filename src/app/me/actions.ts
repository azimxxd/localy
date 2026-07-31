'use server';

/**
 * Действия клиентской витрины /me.
 *
 * Вызывающие: src/components/me/ClientQr.tsx.
 * Ротация QR раз в QR_ROTATION_SECONDS — защита от повторного использования
 * снятого экрана. Реальная проверка срока при списании — на стороне кассы.
 */

import { getRepo } from '@/lib/repo';

export async function rotateToken(customerId: string): Promise<string> {
  const repo = await getRepo();
  const customer = await repo.rotateQrToken(customerId);
  return customer.qrToken;
}
