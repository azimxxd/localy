'use server';

/**
 * Действия кассы.
 *
 * Вызывающие: src/components/pos/PosTerminal.tsx.
 * resolveClient — «скан» QR или ввод телефона: узнаём, кто перед кассиром.
 * submitPurchase — единая операция: транзакция, баланс, аудит, уведомление
 * подписчиков (экран владельца обновляется сам).
 */

import { revalidatePath } from 'next/cache';
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

/** Ищем клиента по динамическому QR, постоянному коду, телефону или ID. */
export async function resolveClient(
  businessId: string,
  code: string,
): Promise<ResolvedClient | { error: string }> {
  await requireBusinessAccess(businessId, ['owner', 'admin', 'manager', 'cashier']);
  const repo = await getRepo();
  const trimmed = code.trim();
  if (!trimmed) return { error: 'Введите QR-код или телефон' };

  let customer = await repo.resolveQrToken(trimmed);
  if (!customer) customer = await repo.findCustomerByPhone(trimmed);
  // Реферальный код — постоянный код клиента. Он не является QR-токеном и
  // не должен попадать под проверку срока действия QR.
  if (!customer) customer = await repo.findCustomerByReferralCode(trimmed);
  if (!customer) customer = await repo.getCustomer(trimmed);
  if (!customer && trimmed.length >= 2) {
    const matches = await repo.listCustomerProfiles(businessId, { search: trimmed, limit: 2 });
    if (matches.length === 1) customer = matches[0].customer;
    if (matches.length > 1) return { error: 'Найдено несколько клиентов. Уточните имя или введите телефон.' };
  }
  if (!customer) {
    return trimmed.toLowerCase().startsWith('qr_')
      ? { error: 'QR-код истёк. Для кассы можно ввести постоянный код клиента или попросить открыть карту заново.' }
      : { error: 'Клиент не найден. Проверьте постоянный код, телефон или ID.' };
  }

  // Постоянный код, телефон и ID не содержат актуальный QR. Обновляем
  // технический токен перед формой покупки, чтобы касса не принимала код,
  // но затем отклоняла сам чек из-за срока старого QR.
  customer = await repo.rotateQrToken(customer.id);

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
    const result = await repo.recordPurchase(payload);
    // Касса меняет не только свой экран: баланс, CRM-профиль, историю клиента,
    // аналитику и воронку акции. Инвалидируем их одним кадром после успешной
    // атомарной операции, иначе Next может отдать старый server-component.
    revalidatePath(`/dashboard/crm/${payload.customerId}`);
    revalidatePath('/dashboard/crm');
    revalidatePath('/dashboard/analytics');
    revalidatePath(`/me/${payload.businessId}`);
    revalidatePath('/me');
    if (payload.promoId) {
      revalidatePath(`/dashboard/promos/${payload.promoId}`);
      revalidatePath('/dashboard/promos');
      revalidatePath('/b/[slug]', 'page');
      revalidatePath('/join/[slug]', 'page');
    }
    return result;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Не удалось провести покупку' };
  }
}
