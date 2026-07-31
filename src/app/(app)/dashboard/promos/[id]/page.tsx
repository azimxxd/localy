/**
 * Итог акции: прогноз до запуска, воронка после.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/promos/[id].
 * Воронка — не «отправлено сообщений», а деньги:
 * получили → открыли → пришли → использовали → выручка.
 */

import Link from 'next/link';
import LaunchButton from '@/components/promos/LaunchButton';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/kit';
import { SEGMENT_META } from '@/lib/engine';
import { kzt, num, percent } from '@/lib/format';
import { PROMO_KIND_LABELS, PROMO_STATUS_LABELS } from '@/lib/promo-labels';
import { getRepo } from '@/lib/repo';

export default async function PromoResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepo();
  const promo = await repo.getPromo(id);
  if (!promo) {
    return <EmptyState title="Акция не найдена" />;
  }

  const hasRun = promo.status === 'active' || promo.status === 'finished';
  const funnel = hasRun ? await repo.getPromoFunnel(id) : null;

  const stages = funnel
    ? [
        { label: 'Получили', value: funnel.sent },
        { label: 'Открыли', value: funnel.opened },
        { label: 'Пришли', value: funnel.visited },
        { label: 'Использовали', value: funnel.redeemed },
      ]
    : [];
  const max = funnel ? Math.max(1, funnel.sent) : 1;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/promos" className="text-sm text-ink-soft hover:text-brand">
        ← К списку акций
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{promo.title}</h1>
          <p className="text-sm text-ink-soft">
            {PROMO_KIND_LABELS[promo.kind]} · {SEGMENT_META[promo.segment].title} ·{' '}
            {num(promo.audienceSize)} чел
          </p>
        </div>
        <Badge tone={promo.status === 'active' ? 'success' : 'brand'}>
          {PROMO_STATUS_LABELS[promo.status]}
        </Badge>
      </header>

      {funnel ? (
        <>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Воронка</h2>
            {stages.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-soft">{s.label}</span>
                  <span className="tnum font-medium text-ink">
                    {num(s.value)} · {percent(s.value / max)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((s.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
          <Stat label="Выручка с акции" value={kzt(funnel.revenue)} />
        </>
      ) : promo.forecast ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Прогноз до запуска</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Придут снова" value={num(promo.forecast.expectedReturns)} />
            <Stat label="Новые клиенты" value={num(promo.forecast.expectedNewCustomers)} />
            <Stat label="Ожидаемая выручка" value={kzt(promo.forecast.expectedRevenue)} />
            <Stat label="Окупаемость" value={`${promo.forecast.roi}×`} />
          </div>
          <p className="text-sm text-ink-soft">
            Акция ещё не запущена — показан прогноз. После запуска здесь появится воронка.
          </p>
          <LaunchButton promoId={promo.id} />
        </Card>
      ) : (
        <EmptyState title="Нет данных по акции" />
      )}
    </div>
  );
}
