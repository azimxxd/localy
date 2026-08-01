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

export async function forecast(input: CreatePromoInput): Promise<PromoForecast | null> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const repo = await getRepo();
  return repo.forecastPromo(input);
}

export async function createPromo(input: CreatePromoInput): Promise<Promo> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const repo = await getRepo();
  return repo.createPromo(input);
}

export async function launchPromo(id: string): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  const promo = await repo.launchPromo(id);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
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
  return promo;
}

export async function updatePromoAction(id: string, patch: Partial<Pick<Promo, 'title' | 'body' | 'value' | 'startsAt' | 'endsAt' | 'status' | 'branchId' | 'channel' | 'placements'>>): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  if (patch.title !== undefined && patch.title.trim().length < 3) throw new Error('Заголовок слишком короткий');
  if (patch.value !== undefined && (!Number.isFinite(patch.value) || patch.value < 0)) throw new Error('Некорректное значение предложения');
  const promo = await repo.updatePromo(id, patch);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
  revalidatePath(`/b/[slug]`, 'page');
  return promo;
}

export async function duplicatePromoAction(id: string): Promise<Promo> {
  const repo = await getRepo();
  const existing = await repo.getPromo(id);
  if (!existing) throw new Error('Акция не найдена');
  await requireBusinessAccess(existing.businessId, ['owner', 'admin', 'marketer']);
  const copy = await repo.createPromo({
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
  });
  revalidatePath('/dashboard/promos');
  return copy;
}
