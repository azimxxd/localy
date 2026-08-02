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
import { requireSession } from '@/lib/auth';
import { PROMO_GOAL_LABELS, PROMO_KIND_LABELS } from '@/lib/promo-labels';
import type { PromoGoal, PromoKind, SegmentCode } from '@/lib/types';

export default async function NewPromoPage({ searchParams }: { searchParams: Promise<{ goal?: string; kind?: string; segment?: string }> }) {
  await requireSession(['owner', 'admin', 'marketer']);
  const query = await searchParams;
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [segments, branches] = await Promise.all([repo.listSegments(business.id), repo.listBranches(business.id)]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/dashboard/promos" className="text-sm text-ink-soft hover:text-brand">
        ← К списку акций
      </Link>
      <h1 className="text-2xl font-bold text-ink">Новая акция</h1>

      <PromoBuilder
        businessId={business.id}
        segments={segments
          .map((s) => ({ code: s.code, title: s.title, description: s.description, count: s.count }))}
        valueMeaning={PROMO_VALUE_MEANING}
        branches={branches}
        initialGoal={query.goal && query.goal in PROMO_GOAL_LABELS ? query.goal as PromoGoal : undefined}
        initialKind={query.kind && query.kind in PROMO_KIND_LABELS ? query.kind as PromoKind : undefined}
        initialSegment={query.segment as SegmentCode | undefined}
      />
    </div>
  );
}
