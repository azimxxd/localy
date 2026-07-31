/**
 * Localy — демо-режим выбора «кто сейчас смотрит».
 *
 * Вызывающие: ТОЛЬКО серверные компоненты ((app)/layout, dashboard, /pos, /me).
 * Импортирует next/headers — в клиентский бандл попасть не должен. Мутация
 * cookie вынесена в src/app/(app)/actions.ts ('use server').
 *
 * Настоящего auth в MVP нет — жюри его не оценивает, а полдня на него нет.
 * Текущий бизнес держим в cookie, клиента демонстрируем фиксированного.
 */

import { cookies } from 'next/headers';
import { getRepo } from '@/lib/repo';
import type { Business } from '@/lib/types';

export const BUSINESS_COOKIE = 'localy_biz';
export const DEFAULT_BUSINESS_ID = 'biz_almaty-coffee';

/** Клиент витрины /me. Входит в первые 14 — состоит во всех заведениях. */
export const DEMO_CUSTOMER_ID = 'cus_001';

export async function getActiveBusinessId(): Promise<string> {
  const store = await cookies();
  return store.get(BUSINESS_COOKIE)?.value ?? DEFAULT_BUSINESS_ID;
}

export async function getActiveBusiness(): Promise<Business> {
  const repo = await getRepo();
  const id = await getActiveBusinessId();
  const business = (await repo.getBusiness(id)) ?? (await repo.getBusiness(DEFAULT_BUSINESS_ID));
  if (!business) throw new Error('Демо-бизнес не найден в данных');
  return business;
}
