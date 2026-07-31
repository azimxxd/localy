'use server';

/**
 * Действия кассы.
 *
 * Вызывающие: src/components/pos/PosTerminal.tsx.
 * resolveClient — «скан» QR или ввод телефона: узнаём, кто перед кассиром.
 * submitPurchase — единая операция: транзакция, баланс, аудит, уведомление
 * подписчиков (экран владельца обновляется сам).
 */

import { getRepo } from '@/lib/repo';
import type { PosPurchaseInput, PosPurchaseResult } from '@/lib/repo';
import type { Customer, Membership } from '@/lib/types';

export interface ResolvedClient {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'qrToken'>;
  membership: Pick<Membership, 'points' | 'visits' | 'totalSpent'> | null;
}

/** Ищем клиента по QR-токену, а если не вышло — по телефону. */
export async function resolveClient(
  businessId: string,
  code: string,
): Promise<ResolvedClient | { error: string }> {
  const repo = await getRepo();
  const trimmed = code.trim();
  if (!trimmed) return { error: 'Введите QR-код или телефон' };

  let customer = await repo.resolveQrToken(trimmed);
  if (!customer) customer = await repo.findCustomerByPhone(trimmed);
  if (!customer) return { error: 'Клиент не найден. Проверьте код или телефон.' };

  const membership = await repo.getMembership(businessId, customer.id);
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      qrToken: customer.qrToken,
    },
    membership: membership
      ? { points: membership.points, visits: membership.visits, totalSpent: membership.totalSpent }
      : null,
  };
}

export interface SubmitPurchaseInput {
  businessId: string;
  staffId: string;
  qrToken: string;
  amount: number;
  items: string[];
  redeemPoints: number;
}

export async function submitPurchase(
  input: SubmitPurchaseInput,
): Promise<PosPurchaseResult | { error: string }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Сумма покупки должна быть больше нуля' };
  }
  const repo = await getRepo();
  const payload: PosPurchaseInput = {
    businessId: input.businessId,
    branchId: null,
    staffId: input.staffId,
    qrToken: input.qrToken,
    amount: Math.round(input.amount),
    items: input.items,
    redeemPoints: Math.max(0, Math.round(input.redeemPoints)),
  };
  try {
    return await repo.recordPurchase(payload);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось провести покупку' };
  }
}
