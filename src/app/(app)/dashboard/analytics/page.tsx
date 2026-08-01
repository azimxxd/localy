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
import Link from 'next/link';
import { requireSession } from '@/lib/auth';

function change(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'новые данны' : 'без изменений';
  const value = Math.round(((current - previous) / previous) * 100);
  return `${value >= 0 ? '+' : ''}${value}% к прошлому периоду`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireSession(['owner', 'admin', 'marketer']);
  const requestedDays = Number((await searchParams).days ?? 30);
  const days = [7, 30, 90, 180].includes(requestedDays) ? requestedDays : 30;
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - days * 86_400_000);

  const [stats, previous, promos, qrStats, log] = await Promise.all([
    repo.getBusinessStats(business.id, { from: from.toISOString(), to: to.toISOString() }),
    repo.getBusinessStats(business.id, { from: previousFrom.toISOString(), to: previousTo.toISOString() }),
    repo.listPromos(business.id),
    repo.getBusinessQrStats(business.id),
    repo.listActivityLog(business.id, 100),
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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="ascii-kicker">Аналитика</p><h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">Аналитика</h1><p className="mt-1 text-sm text-ink-soft">Главное за выбранный период</p></div>
        <div className="flex gap-1">{[7, 30, 90, 180].map((value) => <Link key={value} href={`/dashboard/analytics?days=${value}`} className={`border px-3 py-2 text-sm ${days === value ? 'border-brand bg-brand text-canvas' : 'border-line bg-surface text-ink-soft'}`}>[ {value} дн. ]</Link>)}</div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Новые клиенты" value={num(stats.newCustomers)} sub={change(stats.newCustomers, previous.newCustomers)} />
        <Stat label="Вернулись снова" value={num(stats.returningCustomers)} sub={`${percent(repeatShare)} клиентов`} />
        <Stat label="Выручка" value={kzt(stats.revenue)} sub={change(stats.revenue, previous.revenue)} />
        <Stat label="Средний чек" value={kzt(stats.avgCheck)} sub={change(stats.avgCheck, previous.avgCheck)} />
      </div>

      <details className="ascii-details border border-line bg-surface p-4">
        <summary className="text-sm font-semibold uppercase tracking-wide text-ink">Дополнительные показатели</summary>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-ink-soft">Визиты</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.visits)}</dd><p className="text-xs text-ink-soft">{change(stats.visits, previous.visits)}</p></div>
          <div><dt className="text-xs text-ink-soft">Под риском</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.atRiskCustomers)}</dd><p className="text-xs text-ink-soft">{percent(stats.atRiskShare)}</p></div>
          <div><dt className="text-xs text-ink-soft">Покупки по QR</dt><dd className="tnum mt-1 text-lg text-brand">{percent(stats.identifiedShare)}</dd></div>
          <div><dt className="text-xs text-ink-soft">Регистрации по QR</dt><dd className="tnum mt-1 text-lg text-brand">{percent(qrStats.scans ? qrStats.registrations / qrStats.scans : 0)}</dd><p className="text-xs text-ink-soft">{num(qrStats.registrations)} из {num(qrStats.scans)}</p></div>
          <div><dt className="text-xs text-ink-soft">Начислено бонусов</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.pointsAccrued)}</dd></div>
          <div><dt className="text-xs text-ink-soft">Списано бонусов</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.pointsRedeemed)}</dd></div>
          <div><dt className="text-xs text-ink-soft">Осталось на счетах</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.pointsUnspent)}</dd></div>
          <div><dt className="text-xs text-ink-soft">Активные клиенты</dt><dd className="tnum mt-1 text-lg text-brand">{num(stats.activeCustomers)}</dd></div>
        </dl>
      </details>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="ascii-kicker">Ритм недели</p>
          <h2 className="mb-1 mt-1 font-semibold text-ink">Когда приходит больше людей</h2>
          <p className="mb-3 text-xs text-ink-soft">Один столбец — один день. Выше значит больше визитов.</p>
          <WeekdayChart data={weekday} />
        </Card>

        <Card>
          <p className="ascii-kicker">Топ позиций</p>
          <h2 className="mb-3 mt-1 font-semibold text-ink">Что покупают чаще</h2>
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

      <details className="ascii-details border border-line bg-surface p-5">
        <summary className="font-semibold uppercase tracking-wide text-ink">Результаты завершённых акций</summary>
        <div className="mt-4 border-t border-line pt-3">
        {effectiveness.length === 0 ? (
          <EmptyState title="Завершённых акций пока нет" hint="Запустите акцию — результат появится здесь" />
        ) : (
          <ul className="divide-y divide-line">
            {effectiveness.map(({ promo, funnel }) => (
              <li key={promo.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{promo.title}</p>
                  <p className="text-xs text-ink-soft">{num(funnel.sent)} получили → {num(funnel.opened)} открыли → {num(funnel.clicked)} перешли → {num(funnel.visited)} вернулись → {num(funnel.redeemed)} использовали</p>
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
        </div>
      </details>

      <details className="ascii-details border border-line bg-surface p-5">
        <summary className="font-semibold uppercase tracking-wide text-ink">Служебный журнал сотрудников</summary>
        <div className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">{Object.entries(log.reduce<Record<string, number>>((acc, entry) => { acc[entry.actorName] = (acc[entry.actorName] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => <div key={name} className="flex justify-between border-b border-line px-2 py-2 text-sm"><span className="text-ink">{name}</span><span className="tnum text-ink-soft">{count} действий</span></div>)}</div>
      </details>
    </div>
  );
}
