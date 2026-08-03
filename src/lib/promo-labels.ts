/**
 * Localy — ярлыки типов акций и статусов.
 *
 * Вызывающие: src/components/promos/PromoBuilder.tsx, страницы /dashboard/promos.
 * Держим отдельно, чтобы конструктор и список не расходились в названиях.
 */

import type { PromoGoal, PromoKind, PromoPlacement, PromoStatus } from '@/lib/types';

export const PROMO_GOAL_LABELS: Record<PromoGoal, string> = {
  new_customers: 'Привлечь новых клиентов',
  return_customers: 'Вернуть тех, кто давно не приходил',
  increase_frequency: 'Увеличить частоту визитов',
  increase_check: 'Увеличить средний чек',
  sell_item: 'Продвинуть товар или услугу',
  activate_points: 'Помочь клиентам использовать бонусы',
  referrals: 'Привести друзей по рекомендации',
  fill_quiet_time: 'Заполнить тихие часы',
};

export const PROMO_GOAL_DESCRIPTIONS: Record<PromoGoal, string> = {
  new_customers: 'Акцию увидят люди, которых ещё нет в CRM: на сайте, QR-странице или офлайн-материалах.',
  return_customers: 'Целевая группа — клиенты, пропустившие свой обычный срок возврата.',
  increase_frequency: 'Даём повод зайти раньше обычного цикла.',
  increase_check: 'Предлагаем набор, дополнение или бонус за больший чек.',
  sell_item: 'Показываем предложение тем, кому интересны похожие позиции.',
  activate_points: 'Напоминаем о накопленных или скоро сгорающих бонусах.',
  referrals: 'Лояльные клиенты приглашают друзей, награду получают оба.',
  fill_quiet_time: 'Ограничиваем предложение нужным филиалом и периодом.',
};

export const PROMO_PLACEMENT_LABELS: Record<PromoPlacement, string> = {
  site: 'На публичном сайте',
  client_app: 'В кабинете клиента',
  cashier: 'Можно применить на кассе',
  qr_landing: 'На странице после QR',
};

export const PROMO_KIND_LABELS: Record<PromoKind, string> = {
  discount: 'Скидка',
  coupon: 'Купон на сумму',
  points: 'Бонусы в подарок',
  gift: 'Подарок к покупке',
  two_plus_one: 'Два плюс один',
  double_points: 'Двойные бонусы',
  return_reward: 'Награда за возврат',
  item_promo: 'Акция на товар',
  winback: 'Скидка для возврата',
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
