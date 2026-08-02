/**
 * Список акций бизнеса.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/promos.
 */

import Link from 'next/link';
import { Badge, Card, EmptyState, btnClass } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { SEGMENT_META } from '@/lib/engine';
import { dateShort, num } from '@/lib/format';
import { PROMO_GOAL_LABELS, PROMO_KIND_LABELS, PROMO_STATUS_LABELS } from '@/lib/promo-labels';
import { getRepo } from '@/lib/repo';
import type { PromoStatus } from '@/lib/types';
import { requireSession } from '@/lib/auth';

const STATUS_TONE: Record<PromoStatus, 'brand' | 'success' | 'warning' | 'muted'> = {
  draft: 'muted',
  scheduled: 'warning',
  active: 'success',
  paused: 'warning',
  finished: 'brand',
};

export default async function PromosPage() {
  await requireSession(['owner', 'admin', 'marketer', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const promos = await repo.listPromos(business.id);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Акции</h1>
          <p className="text-sm text-ink-soft">Прогноз до запуска, воронка после</p>
        </div>
        <Link href="/dashboard/promos/new" className={btnClass('primary')}>
          Новая акция
        </Link>
      </header>

      {promos.length === 0 ? (
        <EmptyState title="Пока нет акций" hint="Создайте первую — с прогнозом эффекта" />
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <Link key={p.id} href={`/dashboard/promos/${p.id}`} className="block">
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{p.title}</p>
                    <Badge tone={STATUS_TONE[p.status]}>{PROMO_STATUS_LABELS[p.status]}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {p.goal ? PROMO_GOAL_LABELS[p.goal] : PROMO_KIND_LABELS[p.kind]} · {p.audienceMode === 'public' || p.goal === 'new_customers' ? `публичный охват ≈ ${num(p.audienceSize)}` : `${SEGMENT_META[p.segment].title} · ${num(p.audienceSize)} чел`} · с {dateShort(p.startsAt)}
                  </p>
                </div>
                {p.forecast ? (
                  <div className="shrink-0 text-right">
                    <p className="tnum font-semibold text-brand">{p.forecast.roi}×</p>
                    <p className="text-xs text-ink-soft">прогноз ROI</p>
                  </div>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
