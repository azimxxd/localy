import type { PromoKind } from '@/lib/types';

type PromoRuntimeInput = { kind: PromoKind; value: number };

const PERCENT_DISCOUNT_KINDS: PromoKind[] = [
  'discount',
  'winback',
  'return_reward',
  'item_promo',
];

/** Реальная экономия по акции для кассы. Сумма на входе — обычный чек. */
export function promoSavingsFor(
  promo: PromoRuntimeInput,
  amount: number,
  items: string[] = [],
): number {
  const total = Math.max(0, Math.round(amount));
  if (!total) return 0;

  if (PERCENT_DISCOUNT_KINDS.includes(promo.kind)) {
    return Math.min(total, Math.round(total * Math.min(90, Math.max(0, promo.value)) / 100));
  }
  if (promo.kind === 'coupon') return Math.min(total, Math.max(0, Math.round(promo.value)));
  // Цены отдельных позиций в чеке не передаются, поэтому третий товар
  // считаем по средней цене позиции. При двух позициях акция не применяется.
  if (promo.kind === 'two_plus_one' && items.length >= 3) return Math.floor(total / items.length);
  return 0;
}

export function promoEffectText(promo: PromoRuntimeInput, savings: number): string {
  if (savings > 0) return `Скидка ${savings.toLocaleString('ru-RU')} ₸`;
  if (promo.kind === 'double_points') return `Бонусы ×${promo.value}`;
  if (promo.kind === 'points' || promo.kind === 'referral') return `+${promo.value.toLocaleString('ru-RU')} бонусов`;
  if (promo.kind === 'gift' || promo.kind === 'birthday') return 'Подарок к покупке';
  if (promo.kind === 'two_plus_one') return 'Третий товар в подарок при 3 позициях';
  return 'Условие акции применится к этому чеку';
}
