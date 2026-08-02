/**
 * Обзор владельца: метрики, рекомендации, живая лента.
 *
 * Вызывающие: роутер Next, маршрут /dashboard.
 * Рекомендации — правила движка, не LLM: «42 клиента не приходили дольше
 * обычного → создайте предложение на повторное посещение».
 */

import Link from 'next/link';
import LiveFeed from '@/components/dashboard/LiveFeed';
import { Badge, Card, EmptyState, Stat, btnClass } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { applyRecommendationSettings, recommend } from '@/lib/engine';
import { recentFeed } from '@/lib/feed';
import { kzt, num, percent } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { RecommendationAction } from '@/lib/types';

/** Куда ведёт кнопка рекомендации. */
const REC_HREF: Record<RecommendationAction, string> = {
  create_promo: '/dashboard/promos/new',
  schedule_promo: '/dashboard/promos/new',
  send_campaign: '/dashboard/campaigns',
  activate_tool: '/tools',
  adjust_loyalty: '/dashboard/loyalty',
};

export default async function DashboardPage() {
  await requireSession(['owner', 'admin', 'marketer', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [stats, feed, segments, promos, loyalty, recommendationSettings] = await Promise.all([
    repo.getBusinessStats(business.id),
    recentFeed(repo, business.id),
    repo.listSegments(business.id),
    repo.listPromos(business.id),
    repo.getLoyaltyConfig(business.id),
    repo.listRecommendationSettings(),
  ]);

  const recommendations = applyRecommendationSettings(
    recommend({ segments, stats, promos, loyalty }),
    recommendationSettings,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="ascii-kicker">Обзор</p>
          <h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">{business.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {business.city} · данные за 30 дней
          </p>
        </div>
        <Badge tone="success">система в норме</Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Всего клиентов" value={num(stats.totalCustomers)} sub={`+${num(stats.newCustomers)} новых`} />
        <Stat label="Выручка" value={kzt(stats.revenue)} />
        <Stat label="Визитов" value={num(stats.visits)} />
        <Stat
          label="Нужно вернуть"
          value={num(stats.atRiskCustomers)}
          sub="клиентов давно не было"
        />
      </div>

      <Card className="space-y-4">
        <div>
          <p className="ascii-kicker">Быстрый старт</p>
          <h2 className="mt-1 font-semibold text-ink">Что хотите сделать?</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Link href="/dashboard/promos/new" className={btnClass('primary', 'min-h-14 px-3 text-center')}>Создать акцию</Link>
          <Link href="/pos" className={btnClass('secondary', 'min-h-14 px-3 text-center')}>Открыть кассу</Link>
          <Link href="/dashboard/crm" className={btnClass('secondary', 'min-h-14 px-3 text-center')}>Добавить клиента</Link>
          <Link href={`/b/${business.slug}`} className={btnClass('secondary', 'min-h-14 px-3 text-center')}>Открыть сайт</Link>
        </div>
        <details className="ascii-details border-t border-line pt-3 text-sm">
          <summary className="text-ink-soft hover:text-brand">Ещё действия и показатели</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/loyalty" className={btnClass('ghost')}>Настроить лояльность</Link>
            <Link href="/dashboard/campaigns" className={btnClass('ghost')}>Отправить предложение</Link>
          </div>
          <dl className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-ink-soft">Средний чек</dt><dd className="tnum text-brand">{kzt(stats.avgCheck)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Повторные визиты</dt><dd className="tnum text-brand">{num(stats.repeatVisits)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Активные клиенты</dt><dd className="tnum text-brand">{num(stats.activeCustomers)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Покупки с QR</dt><dd className="tnum text-brand">{percent(stats.identifiedShare)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Начислено бонусов</dt><dd className="tnum text-brand">{num(stats.pointsAccrued)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Списано бонусов</dt><dd className="tnum text-brand">{num(stats.pointsRedeemed)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Бонусов на счетах</dt><dd className="tnum text-brand">{num(stats.pointsUnspent)}</dd></div>
            <div><dt className="text-xs text-ink-soft">Эффективность акции</dt><dd className="tnum text-brand">{percent(stats.activePromoConversion)}</dd></div>
          </dl>
        </details>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.7fr)]">
        <Card>
          <p className="ascii-kicker">Следующий шаг</p>
          <h2 className="mb-3 mt-1 text-lg font-semibold text-ink">Что можно улучшить</h2>
          {recommendations.length === 0 ? (
            <EmptyState title="Всё под контролем" hint="Тревожных сигналов нет" />
          ) : (
            <ul className="space-y-3">
              {recommendations.slice(0, 3).map((rec) => (
                <li key={rec.id} className="border-l-2 border-brand bg-canvas p-3">
                  <p className="font-medium text-ink">{rec.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{rec.action}</p>
                  <Link
                    href={REC_HREF[rec.actionKind]}
                    className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    Сделать →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/recommendations" className="mt-4 inline-block text-sm text-brand hover:underline">[ Все рекомендации ] →</Link>
        </Card>
        <LiveFeed businessId={business.id} initial={feed} />
      </div>
    </div>
  );
}
