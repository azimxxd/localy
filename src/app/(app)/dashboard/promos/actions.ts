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

export async function forecast(input: CreatePromoInput): Promise<PromoForecast | null> {
  const repo = await getRepo();
  return repo.forecastPromo(input);
}

export async function createPromo(input: CreatePromoInput): Promise<Promo> {
  const repo = await getRepo();
  return repo.createPromo(input);
}

export async function launchPromo(id: string): Promise<Promo> {
  const repo = await getRepo();
  const promo = await repo.launchPromo(id);
  revalidatePath(`/dashboard/promos/${id}`);
  revalidatePath('/dashboard/promos');
  return promo;
}
