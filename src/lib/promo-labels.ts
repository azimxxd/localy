/**
 * Localy — ярлыки типов акций и статусов.
 *
 * Вызывающие: src/components/promos/PromoBuilder.tsx, страницы /dashboard/promos.
 * Держим отдельно, чтобы конструктор и список не расходились в названиях.
 */

import type { PromoKind, PromoStatus } from '@/lib/types';

export const PROMO_KIND_LABELS: Record<PromoKind, string> = {
  discount: 'Скидка',
  coupon: 'Купон на сумму',
  points: 'Бонусы в подарок',
  gift: 'Подарок к покупке',
  two_plus_one: 'Два плюс один',
  double_points: 'Двойные бонусы',
  return_reward: 'Награда за возврат',
  item_promo: 'Акция на товар',
  winback: 'Возврат ушедших',
  birthday: 'Подарок на день рождения',
  referral: 'Приведи друга',
};

/** Смысл размера акции — совпадает с движком PROMO_VALUE_MEANING. */
export type PromoValueMeaning = 'percent' | 'currency' | 'points' | 'multiplier';

/** Единица размера акции — подпись рядом с полем value. */
export const PROMO_UNIT: Record<PromoValueMeaning, string> = {
  percent: '%',
  currency: '₸',
  points: 'бонусов',
  multiplier: '×',
};

export const PROMO_STATUS_LABELS: Record<PromoStatus, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирована',
  active: 'Идёт',
  paused: 'Приостановлена',
  finished: 'Завершена',
};
