/**
 * Localy — движок уровня и активности клиента.
 *
 * Чистые функции, без обращений к БД. Импортируется из repo и из API-роутов.
 * Вызывающие: src/lib/repo/*, src/app/api/**, экраны CRM.
 *
 * Ключевая идея продукта:
 * активность считается от ЛИЧНОЙ частоты визитов конкретного человека,
 * а не от абсолютных цифр. Кофейня (медиана 7 дней) и ремонт телефонов
 * (медиана 90+ дней) обрабатываются одной формулой — пороги растягиваются
 * сами, настраивать под нишу ничего не нужно.
 */

import {
  ACTIVITY_THRESHOLDS,
  type ActivityState,
  type ActivityThresholds,
  type Customer,
  type CustomerProfile,
  type LoyaltyConfig,
  type LoyaltyLevel,
  type Membership,
  type Transaction,
} from '@/lib/types';

const DAY_MS = 86_400_000;

/** Разница в днях между двумя ISO-датами. Всегда >= 0. */
export function daysBetween(fromIso: string, toIso: string): number {
  const diff = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
}

/** Медиана числового массива. Пустой массив → 0. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Обычная частота визитов этого человека, в днях.
 *
 * Берём медиану, а не среднее: один аномальный перерыв (отпуск, болезнь)
 * не должен смещать оценку. Учитываем только реальные визиты — покупки,
 * не ручные корректировки баланса.
 *
 * @param visitDates ISO-даты визитов, порядок неважен
 * @returns медиана интервалов; 0 если визитов меньше двух
 */
export function medianIntervalDays(visitDates: string[]): number {
  if (visitDates.length < 2) return 0;
  const sorted = [...visitDates].sort();
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(daysBetween(sorted[i - 1], sorted[i]));
  }
  return median(intervals);
}

/** Даты визитов из транзакций — только покупки. */
export function visitDatesFrom(transactions: Transaction[]): string[] {
  return transactions
    .filter((t) => t.kind === 'purchase' && t.status !== 'pending_confirmation' && t.status !== 'cancelled')
    .map((t) => t.createdAt);
}

/**
 * Текущая активность клиента.
 *
 * Проверка на примере из продуктовой спеки (медиана 7 дней):
 *   10 дней → 7×1.3 = 9.1  <  10  ≤ 7×2.0 = 14.0  → declining  (активность снижается)
 *   14 дней → 14 ≤ 14.0                            → declining  (граница)
 *   16 дней → 14.0 < 16 ≤ 7×3.5 = 24.5             → at_risk    (под риском ухода)
 *   25 дней → 25 > 24.5                            → lapsed     (давно не приходил)
 *
 * Если визит был один — судить о частоте не по чему. Тогда используем
 * запасную медиану: клиент считается активным первые 30 дней.
 */
export function activityState(
  daysSinceLastVisit: number,
  medianInterval: number,
  fallbackIntervalDays = 30,
  thresholds: ActivityThresholds = ACTIVITY_THRESHOLDS,
): ActivityState {
  const base = medianInterval > 0 ? medianInterval : fallbackIntervalDays;

  if (daysSinceLastVisit <= base * thresholds.declining) return 'active';
  if (daysSinceLastVisit <= base * thresholds.atRisk) return 'declining';
  if (daysSinceLastVisit <= base * thresholds.lapsed) return 'at_risk';
  return 'lapsed';
}

/**
 * Уровень лояльности — по количеству визитов, сроку жизни и сумме.
 *
 * Порог визитов масштабируется от частоты ниши: для кофейни «постоянный»
 * это ~10 визитов, для ремонта телефонов такого числа не будет никогда,
 * поэтому вклад даёт и срок отношений, и потраченная сумма.
 */
export function loyaltyLevel(
  visits: number,
  lifetimeDays: number,
  totalSpent: number,
  avgCheck: number,
  visitDates: string[] = [],
): LoyaltyLevel {
  const uniqueDays = new Set(visitDates.map((date) => date.slice(0, 10))).size || visits;
  const uniqueWeeks = new Set(
    visitDates.map((date) => {
      const value = new Date(date);
      const yearStart = Date.UTC(value.getUTCFullYear(), 0, 1);
      const week = Math.ceil((value.getTime() - yearStart + 86_400_000) / (7 * 86_400_000));
      return `${value.getUTCFullYear()}-${week}`;
    }),
  ).size;
  const spendScore = avgCheck > 0 ? totalSpent / avgCheck : 0;

  if (uniqueDays <= 1) return 'new';
  if (uniqueDays <= 3 || uniqueWeeks < 3) return 'returning';
  if (lifetimeDays < 45 || uniqueWeeks < 5) return 'habit_forming';
  if (lifetimeDays >= 120 && uniqueWeeks >= 10 && visits >= 12 && spendScore >= 10) return 'loyal';
  if (lifetimeDays >= 60 && uniqueWeeks >= 6 && visits >= 7) return 'regular';
  return 'habit_forming';
}

/**
 * Вероятность визита в ближайшие N дней.
 *
 * Простая, объяснимая модель: чем ближе прошедший срок к личной медиане,
 * тем выше шанс; после 2× медианы шанс быстро падает. Без обучения и без
 * внешних сервисов — демо не может упасть, а цифру можно защитить на питче.
 *
 * «Арман обычно приходит по пятницам. Вероятность визита за 5 дней — 72%».
 */
export function visitProbability(
  daysSinceLastVisit: number,
  medianInterval: number,
  horizonDays: number,
): number {
  if (medianInterval <= 0) return 0;

  const ratio = (daysSinceLastVisit + horizonDays) / medianInterval;
  // Логистическая кривая с центром в 1.0 медианы
  const p = 1 / (1 + Math.exp(-3 * (ratio - 1)));
  // После 2.5 медиан клиент, скорее всего, уже не вернётся сам
  const decay = ratio > 2.5 ? Math.max(0, 1 - (ratio - 2.5) / 2) : 1;

  return Math.round(Math.min(0.95, p * decay) * 100) / 100;
}

/** Сколько визитов осталось до награды. 0 = награда доступна сейчас. */
export function visitsToReward(points: number, config: LoyaltyConfig, avgCheck: number): number {
  const remaining = config.rewardThreshold - points;
  if (remaining <= 0) return 0;

  const pointsPerVisit = avgCheck * config.pointsPerCurrency;
  if (pointsPerVisit <= 0) return Number.POSITIVE_INFINITY;

  return Math.ceil(remaining / pointsPerVisit);
}

/**
 * Полный профиль для карточки CRM.
 * Собирает всё, что владелец видит про конкретного человека.
 */
export function buildCustomerProfile(params: {
  customer: Customer;
  membership: Membership;
  transactions: Transaction[];
  loyalty: LoyaltyConfig;
  now?: string;
  fallbackIntervalDays?: number;
  activityThresholds?: ActivityThresholds;
}): CustomerProfile {
  const { customer, membership, transactions, loyalty } = params;
  const now = params.now ?? new Date().toISOString();

  const visits = visitDatesFrom(transactions);
  const medianInterval = medianIntervalDays(visits);
  const daysSince = daysBetween(membership.lastSeen, now);
  const lifetimeDays = daysBetween(membership.firstSeen, now);

  const purchases = transactions.filter(
    (t) => t.kind === 'purchase' && t.status !== 'pending_confirmation' && t.status !== 'cancelled',
  );
  const avgCheck =
    purchases.length > 0
      ? Math.round(purchases.reduce((sum, t) => sum + t.amount, 0) / purchases.length)
      : 0;

  return {
    customer,
    membership,
    level: loyaltyLevel(membership.visits, lifetimeDays, membership.totalSpent, avgCheck, visits),
    activity: activityState(daysSince, medianInterval, params.fallbackIntervalDays, params.activityThresholds),
    medianIntervalDays: medianInterval,
    daysSinceLastVisit: daysSince,
    avgCheck,
    visitsToReward: visitsToReward(membership.points, loyalty, avgCheck),
    visitProbability7d: visitProbability(daysSince, medianInterval, 7),
  };
}

// ─────────────────────────────────────────────────────────────
// Подписи для интерфейса
// ─────────────────────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<ActivityState, string> = {
  active: 'Активный',
  declining: 'Активность снижается',
  at_risk: 'Под риском ухода',
  lapsed: 'Давно не приходил',
};

export const LEVEL_LABELS: Record<LoyaltyLevel, string> = {
  new: 'Новый',
  returning: 'Вернувшийся',
  habit_forming: 'Формирует привычку',
  regular: 'Постоянный клиент',
  loyal: 'Лояльный клиент',
};

/** Тон бейджа активности: зелёный → жёлтый → оранжевый → серый. */
export const ACTIVITY_TONE: Record<ActivityState, 'success' | 'warning' | 'danger' | 'muted'> = {
  active: 'success',
  declining: 'warning',
  at_risk: 'danger',
  lapsed: 'muted',
};

/**
 * Человеческое объяснение статуса — идёт прямо в карточку CRM.
 * «Обычно приходит каждые 6–7 дней, последний визит 11 дней назад».
 */
export function explainActivity(profile: CustomerProfile): string {
  const { medianIntervalDays: m, daysSinceLastVisit: d } = profile;

  if (m === 0) {
    return d === 0 ? 'Первый визит сегодня' : `Единственный визит ${d} дн. назад`;
  }

  const low = Math.floor(m);
  const high = Math.ceil(m);
  const usual = low === high ? `каждые ${low} дн.` : `каждые ${low}–${high} дн.`;

  return `Обычно приходит ${usual}, последний визит ${d} дн. назад`;
}
