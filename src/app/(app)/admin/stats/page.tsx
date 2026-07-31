/**
 * Аналитика использования платформы.
 *
 * Вызывающие: роутер Next, маршрут /admin/stats.
 * Требование положения: активные бизнесы, популярные инструменты, всего
 * клиентов.
 */

import Link from 'next/link';
import { Card, EmptyState, Stat } from '@/components/ui/kit';
import { num } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function AdminStatsPage() {
  const repo = await getRepo();
  const [stats, businessTypes] = await Promise.all([
    repo.getPlatformStats(),
    repo.listBusinessTypes(),
  ]);

  const typeTitle = (code: string) =>
    businessTypes.find((bt) => bt.code === code)?.title ?? code;
  const maxType = Math.max(1, ...stats.businessesByType.map((b) => b.count));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-brand">
        ← В админ-панель
      </Link>
      <h1 className="text-2xl font-bold text-ink">Аналитика платформы</h1>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Активные бизнесы" value={num(stats.activeBusinesses)} />
        <Stat label="Всего клиентов" value={num(stats.totalCustomers)} />
        <Stat label="Всего операций" value={num(stats.totalTransactions)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-ink">Популярные инструменты</h2>
          {stats.popularTools.length === 0 ? (
            <EmptyState title="Нет активаций" />
          ) : (
            <ul className="space-y-2">
              {stats.popularTools.map((t) => (
                <li key={t.toolId} className="flex items-center justify-between text-sm">
                  <span className="truncate text-ink">{t.title}</span>
                  <span className="tnum font-medium text-brand">{num(t.activations)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-ink">Бизнесы по типам</h2>
          <div className="space-y-2">
            {stats.businessesByType.map((b) => (
              <div key={b.typeCode}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-soft">{typeTitle(b.typeCode)}</span>
                  <span className="tnum text-ink">{num(b.count)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((b.count / maxType) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
