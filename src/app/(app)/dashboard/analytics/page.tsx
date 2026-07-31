/**
 * Аналитика продаж.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/analytics.
 * Требование положения: новые клиенты, повторные покупки, эффективность акции.
 */

import { WeekdayChart } from '@/components/analytics/AnalyticsCharts';
import { Card, EmptyState, Stat } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { WEEKDAY_SHORT, kzt, num, percent } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function AnalyticsPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [stats, promos] = await Promise.all([
    repo.getBusinessStats(business.id),
    repo.listPromos(business.id),
  ]);

  const finished = promos.filter((p) => p.status === 'finished');
  const effectiveness = await Promise.all(
    finished.map(async (p) => ({ promo: p, funnel: await repo.getPromoFunnel(p.id) })),
  );

  const weekday = stats.byWeekday
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => ({ name: WEEKDAY_SHORT[d.weekday], visits: d.visits }));

  const repeatShare =
    stats.newCustomers + stats.returningCustomers > 0
      ? stats.returningCustomers / (stats.newCustomers + stats.returningCustomers)
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Аналитика продаж</h1>
        <p className="text-sm text-ink-soft">{business.name}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Новые клиенты" value={num(stats.newCustomers)} />
        <Stat label="Повторные покупки" value={num(stats.returningCustomers)} sub={percent(repeatShare)} />
        <Stat label="Выручка" value={kzt(stats.revenue)} />
        <Stat label="Идентифицировано" value={percent(stats.identifiedShare)} sub="покупок по картам" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Визиты по дням недели</h2>
          <WeekdayChart data={weekday} />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-ink">Что покупают чаще</h2>
          {stats.topItems.length === 0 ? (
            <p className="text-sm text-ink-soft">Нет данных.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topItems.slice(0, 6).map((it) => (
                <li key={it.title} className="flex items-center justify-between text-sm">
                  <span className="truncate text-ink">{it.title}</span>
                  <span className="tnum text-ink-soft">{num(it.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Эффективность акций</h2>
        {effectiveness.length === 0 ? (
          <EmptyState title="Завершённых акций пока нет" hint="Запустите акцию — результат появится здесь" />
        ) : (
          <ul className="divide-y divide-line">
            {effectiveness.map(({ promo, funnel }) => (
              <li key={promo.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{promo.title}</p>
                  <p className="text-xs text-ink-soft">
                    {num(funnel.sent)} получили → {num(funnel.redeemed)} использовали
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-semibold text-ok">{kzt(funnel.revenue)}</p>
                  {promo.forecast ? (
                    <p className="text-xs text-ink-soft">ROI {promo.forecast.roi}×</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
