'use server';

/**
 * Действия конструктора акций.
 *
 * Вызывающие: src/components/promos/PromoBuilder.tsx.
 * forecast — детерминированный прогноз из движка, дёргается на каждое
 * изменение формы. create/launch — сохранение и запуск.
 */

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/repo';
import type { CreatePromoInput } from '@/lib/repo';
import type { Promo, PromoForecast } from '@/lib/types';
import { requireBusinessAccess } from '@/lib/auth';

class PromoValidationError extends Error {}
const invalid = (message: string): never => { throw new PromoValidationError(message); };

async function validatedPromoInput(input: CreatePromoInput): Promise<CreatePromoInput> {
  const repo = await getRepo();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const durationDays = (endsAt.getTime() - startsAt.getTime()) / 86_400_000;
  if (!input.title.trim() || input.title.trim().length > 80) invalid('Название акции: от 1 до 80 символов');
  if ((input.body?.length ?? 0) > 500) invalid('Описание акции длиннее 500 символов');
  if (!Number.isFinite(input.value) || input.value <= 0 || input.value > 1_000_000) invalid('Укажите корректный размер предложения');
  if (['discount', 'winback', 'return_reward', 'item_promo', 'two_plus_one'].includes(input.kind) && input.value > 90) invalid('Скидка не может быть выше 90%');
  if (input.kind === 'double_points' && input.value > 10) invalid('Множитель бонусов не может быть выше 10×');
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || durationDays < 1 || durationDays > 60) invalid('Срок акции должен быть от 1 до 60 дней');
  const placements = [...new Set(input.placements ?? [])];
  if (placements.length === 0) invalid('Выберите, где показать или применять акцию');
  if (!placements.includes('cashier')) invalid('Оставьте кассу включённой — без неё акцию нельзя применить');
  if (input.goal === 'new_customers' && !placements.some((placement) => placement === 'site' || placement === 'qr_landing')) invalid('Для новых клиентов включите публичный сайт или QR-страницу');
  if (input.goal !== 'new_customers' && input.segment === 'no_consent') invalid('Клиентам без согласия нельзя отправлять акцию');
  if (input.goal !== 'new_customers') {
    const segment = (await repo.listSegments(input.businessId)).find((item) => item.code === input.segment);
    if (!segment?.count) invalid('В выбранном CRM-сегменте пока нет клиентов');
  }
  if (input.branchId && !(await repo.listBranches(input.businessId)).some((branch) => branch.id === input.branchId)) invalid('Филиал не принадлежит этому бизнесу');
  return { ...input, title: input.title.trim(), body: input.body?.trim(), segment: input.goal === 'new_customers' ? 'new' : input.segment, channel: input.goal === 'new_customers' ? 'push' : input.channel, placements };
}

export async function forecast(input: CreatePromoInput): Promise<{ forecast: PromoForecast | null; error: string | null }> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const repo = await getRepo();
  try {
    return { forecast: await repo.forecastPromo(await validatedPromoInput(input)), error: null };
  } catch (cause) {
    if (cause instanceof PromoValidationError) return { forecast: null, error: cause.message };
    throw cause;
  }
}

export async function createPromo(input: CreatePromoInput): Promise<Promo> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const repo = await getRepo();
  const promo = await repo.createPromo(await validatedPromoInput(input));
  revalidatePath('/dashboard/promos');
  return promo;
}

export async function launchPromo(id: string): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  const promo = await repo.launchPromo(id);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
  revalidatePath('/b/[slug]', 'page');
  revalidatePath('/join/[slug]', 'page');
  revalidatePath('/me/[businessId]', 'page');
  return promo;
}

export async function launchPromoNowAction(id: string): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  await repo.updatePromo(id, { startsAt: new Date().toISOString(), status: 'draft' });
  const promo = await repo.launchPromo(id);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
  revalidatePath('/b/[slug]', 'page');
  revalidatePath('/join/[slug]', 'page');
  revalidatePath('/me/[businessId]', 'page');
  return promo;
}

export async function updatePromoAction(id: string, patch: Partial<Pick<Promo, 'title' | 'body' | 'value' | 'startsAt' | 'endsAt' | 'status' | 'branchId' | 'channel' | 'placements'>>): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  if (patch.title !== undefined && patch.title.trim().length < 3) throw new Error('Заголовок слишком короткий');
  if (patch.value !== undefined && (!Number.isFinite(patch.value) || patch.value < 0)) throw new Error('Некорректное значение предложения');
  const mechanicsChanged = ['value', 'startsAt', 'endsAt', 'branchId', 'channel', 'placements'].some((key) => key in patch);
  if (mechanicsChanged && !['draft', 'scheduled'].includes(existing.status)) throw new Error('У запущенной акции нельзя менять механику. Создайте копию.');
  let nextPatch: Partial<Promo> = patch;
  if (mechanicsChanged) {
    const normalized = await validatedPromoInput({
      businessId: existing.businessId,
      kind: existing.kind,
      title: patch.title ?? existing.title,
      body: patch.body ?? existing.body,
      value: patch.value ?? existing.value,
      segment: existing.segment,
      goal: existing.goal,
      branchId: patch.branchId === undefined ? existing.branchId : patch.branchId,
      channel: patch.channel ?? existing.channel,
      placements: patch.placements ?? existing.placements,
      startsAt: patch.startsAt ?? existing.startsAt,
      endsAt: patch.endsAt ?? existing.endsAt,
    });
    const nextForecast = await repo.forecastPromo(normalized);
    if (!nextForecast) throw new Error('Не удалось пересчитать прогноз акции');
    nextPatch = { ...patch, ...normalized, forecast: nextForecast, audienceSize: nextForecast.estimatedAudience ?? existing.audienceSize };
  }
  const promo = await repo.updatePromo(id, nextPatch);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
  revalidatePath(`/b/[slug]`, 'page');
  revalidatePath('/join/[slug]', 'page');
  revalidatePath('/me/[businessId]', 'page');
  return promo;
}

export async function duplicatePromoAction(id: string): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  const copy = await repo.createPromo(await validatedPromoInput({
    businessId: existing.businessId,
    kind: existing.kind,
    title: `${existing.title} — копия`,
    body: existing.body,
    value: existing.value,
    segment: existing.segment,
    goal: existing.goal,
    branchId: existing.branchId,
    channel: existing.channel,
    placements: existing.placements,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  }));
  revalidatePath('/dashboard/promos');
  return copy;
}
