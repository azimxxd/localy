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
import { requireBusinessAccess } from '@/lib/auth';

export interface ResolvedClient {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'qrToken'>;
  membership: Pick<Membership, 'points' | 'visits' | 'totalSpent'> | null;
  rewardAvailable: boolean;
  rewardTitle: string;
  visitsToReward: number;
}

/** Ищем клиента по QR-токену, а если не вышло — по телефону. */
export async function resolveClient(
  businessId: string,
  code: string,
): Promise<ResolvedClient | { error: string }> {
  await requireBusinessAccess(businessId, ['owner', 'admin', 'manager', 'cashier']);
  const repo = await getRepo();
  const trimmed = code.trim();
  if (!trimmed) return { error: 'Введите QR-код или телефон' };

  let customer = await repo.resolveQrToken(trimmed);
  if (!customer && trimmed.startsWith('qr_')) {
    return { error: 'QR-код истёк. Попросите клиента открыть карту заново.' };
  }
  if (!customer) customer = await repo.findCustomerByPhone(trimmed);
  if (!customer) customer = await repo.getCustomer(trimmed);
  if (!customer && trimmed.length >= 2) {
    const matches = await repo.listCustomerProfiles(businessId, { search: trimmed, limit: 2 });
    if (matches.length === 1) customer = matches[0].customer;
    if (matches.length > 1) return { error: 'Найдено несколько клиентов. Уточните имя или введите телефон.' };
  }
  if (!customer) return { error: 'Клиент не найден. Проверьте код или телефон.' };

  const membership = await repo.getMembership(businessId, customer.id);
  const loyalty = await repo.getLoyaltyConfig(businessId);
  const every = loyalty.rewardEveryVisits ?? 6;
  const earnedRewards = membership ? Math.floor(membership.visits / every) : 0;
  const rewardAvailable = earnedRewards > (membership?.claimedVisitRewards ?? 0);
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
    rewardAvailable,
    rewardTitle: loyalty.rewardTitle,
    visitsToReward: rewardAvailable ? 0 : every - ((membership?.visits ?? 0) % every),
  };
}

export interface SubmitPurchaseInput {
  businessId: string;
  staffId: string;
  qrToken: string;
  customerId: string;
  amount: number;
  items: string[];
  redeemPoints: number;
  promoId?: string | null;
  claimReward?: boolean;
}

export async function submitPurchase(
  input: SubmitPurchaseInput,
): Promise<PosPurchaseResult | { error: string }> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager', 'cashier']);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Сумма покупки должна быть больше нуля' };
  }
  const repo = await getRepo();
  const staff = (await repo.listStaff(input.businessId)).find((item) => item.id === (session.staffId ?? input.staffId));
  const payload: PosPurchaseInput = {
    businessId: input.businessId,
    branchId: staff?.branchId ?? null,
    staffId: session.staffId ?? input.staffId,
    qrToken: input.qrToken,
    customerId: input.customerId,
    amount: Math.round(input.amount),
    items: input.items,
    redeemPoints: Math.max(0, Math.round(input.redeemPoints)),
    promoId: input.promoId ?? null,
    claimReward: input.claimReward,
  };
  try {
    return await repo.recordPurchase(payload);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось провести покупку' };
  }
}
