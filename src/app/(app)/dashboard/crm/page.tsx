/**
 * CRM: клиентская база с сегментами и поиском.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/crm.
 * Сегменты система собирает сама (движок), владелец не листает списки вручную.
 * Фильтр сегмента и поиск живут в URL — серверный ре-рендер отдаёт срез.
 */

import Link from 'next/link';
import CrmSearch from '@/components/crm/CrmSearch';
import { Badge, Card, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { ACTIVITY_LABELS, ACTIVITY_TONE, LEVEL_LABELS } from '@/lib/engine';
import { daysAgoLabel, kzt, num } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { SegmentCode } from '@/lib/types';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; q?: string }>;
}) {
  const { segment, q } = await searchParams;
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [segments, profiles] = await Promise.all([
    repo.listSegments(business.id),
    repo.listCustomerProfiles(business.id, {
      segment: segment as SegmentCode | undefined,
      search: q,
    }),
  ]);

  const activeSegment = segments.find((s) => s.code === segment);
  const qs = (code?: string) => {
    const p = new URLSearchParams();
    if (code) p.set('segment', code);
    if (q) p.set('q', q);
    const str = p.toString();
    return str ? `/dashboard/crm?${str}` : '/dashboard/crm';
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Клиенты</h1>
          <p className="text-sm text-ink-soft">
            {num(profiles.length)} в выборке
            {activeSegment ? ` · сегмент «${activeSegment.title}»` : ''}
          </p>
        </div>
        <div className="w-64">
          <CrmSearch />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href={qs()}>
          <Badge tone={segment ? 'muted' : 'brand'}>Все</Badge>
        </Link>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <Link key={s.code} href={qs(s.code)}>
              <Badge tone={s.code === segment ? 'brand' : 'muted'}>
                {s.title} · {num(s.count)}
              </Badge>
            </Link>
          ))}
      </div>

      {profiles.length === 0 ? (
        <EmptyState title="Никого не нашлось" hint="Смените сегмент или уточните поиск" />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-ink-soft">
                  <th className="px-4 py-3 font-medium">Клиент</th>
                  <th className="px-4 py-3 font-medium">Уровень</th>
                  <th className="px-4 py-3 font-medium">Активность</th>
                  <th className="px-4 py-3 text-right font-medium">Визитов</th>
                  <th className="px-4 py-3 font-medium">Последний визит</th>
                  <th className="px-4 py-3 text-right font-medium">Бонусы</th>
                  <th className="px-4 py-3 text-right font-medium">Средний чек</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.customer.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/crm/${p.customer.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {p.customer.name}
                      </Link>
                      <p className="text-xs text-ink-soft">{p.customer.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{LEVEL_LABELS[p.level]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ACTIVITY_TONE[p.activity]}>{ACTIVITY_LABELS[p.activity]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tnum">{num(p.membership.visits)}</td>
                    <td className="px-4 py-3 text-ink-soft">{daysAgoLabel(p.daysSinceLastVisit)}</td>
                    <td className="px-4 py-3 text-right tnum text-brand">{num(p.membership.points)}</td>
                    <td className="px-4 py-3 text-right tnum">{kzt(p.avgCheck)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
