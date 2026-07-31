/**
 * Обзор владельца: метрики, рекомендации, живая лента.
 *
 * Вызывающие: роутер Next, маршрут /dashboard.
 * Рекомендации — правила движка, не LLM: «42 клиента не приходили дольше
 * обычного → создайте предложение на повторное посещение».
 */

import Link from 'next/link';
import LiveFeed from '@/components/dashboard/LiveFeed';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { recommend } from '@/lib/engine';
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
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [stats, feed, segments, promos, loyalty] = await Promise.all([
    repo.getBusinessStats(business.id),
    recentFeed(repo, business.id),
    repo.listSegments(business.id),
    repo.listPromos(business.id),
    repo.getLoyaltyConfig(business.id),
  ]);

  const recommendations = recommend({ segments, stats, promos, loyalty });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{business.name}</h1>
          <p className="text-sm text-ink-soft">
            {business.city} · тариф {business.plan}
          </p>
        </div>
        <Badge tone="brand">Обзор за всё время</Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Выручка" value={kzt(stats.revenue)} />
        <Stat label="Визитов" value={num(stats.visits)} />
        <Stat label="Средний чек" value={kzt(stats.avgCheck)} />
        <Stat
          label="Под риском ухода"
          value={percent(stats.atRiskShare)}
          sub={`${num(stats.activeCustomers)} активных клиентов`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <LiveFeed businessId={business.id} initial={feed} />

        <Card>
          <h2 className="mb-3 text-lg font-semibold text-ink">Рекомендации</h2>
          {recommendations.length === 0 ? (
            <EmptyState title="Всё под контролем" hint="Тревожных сигналов нет" />
          ) : (
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.id} className="rounded-xl border border-line p-3">
                  <p className="font-medium text-ink">{rec.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{rec.action}</p>
                  <Link
                    href={REC_HREF[rec.actionKind]}
                    className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    Перейти →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
