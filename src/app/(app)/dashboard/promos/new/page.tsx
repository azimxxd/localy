/**
 * Страница конструктора акции.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/promos/new.
 * Значения сегментов и смысл размера акции берём на сервере из движка и
 * отдаём конструктору пропсами — клиент не дублирует эту логику.
 */

import Link from 'next/link';
import PromoBuilder from '@/components/promos/PromoBuilder';
import { getActiveBusiness } from '@/lib/demo';
import { PROMO_VALUE_MEANING } from '@/lib/engine';
import { getRepo } from '@/lib/repo';

export default async function NewPromoPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const segments = await repo.listSegments(business.id);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/dashboard/promos" className="text-sm text-ink-soft hover:text-brand">
        ← К списку акций
      </Link>
      <h1 className="text-2xl font-bold text-ink">Новая акция</h1>

      <PromoBuilder
        businessId={business.id}
        segments={segments
          .filter((s) => s.count > 0)
          .map((s) => ({ code: s.code, title: s.title, count: s.count }))}
        valueMeaning={PROMO_VALUE_MEANING}
      />
    </div>
  );
}
