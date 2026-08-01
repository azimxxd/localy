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
import { daysAgoLabel, num } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { SegmentCode } from '@/lib/types';
import AddCustomer from '@/components/crm/AddCustomer';
import type { ActivityState, LoyaltyLevel } from '@/lib/types';
import { requireSession } from '@/lib/auth';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; q?: string; activity?: string; level?: string; minPoints?: string; minDays?: string; consent?: string; sort?: string }>;
}) {
  await requireSession(['owner', 'admin', 'marketer', 'manager']);
  const { segment, q, activity, level, minPoints, minDays, consent, sort } = await searchParams;
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [segments, profiles] = await Promise.all([
    repo.listSegments(business.id),
    repo.listCustomerProfiles(business.id, {
      segment: segment as SegmentCode | undefined,
      search: q,
      activity: activity as ActivityState | undefined,
      level: level as LoyaltyLevel | undefined,
      minPoints: minPoints ? Number(minPoints) : undefined,
      minDaysSince: minDays ? Number(minDays) : undefined,
      consent: consent as 'yes' | 'no' | undefined,
      sort: sort as 'last_seen' | 'points' | 'spent' | 'visits' | undefined,
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ascii-kicker">Клиенты</p>
          <h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">Клиенты</h1>
          <p className="text-sm text-ink-soft">
            {num(profiles.length)} в выборке
            {activeSegment ? ` · сегмент «${activeSegment.title}»` : ''}
          </p>
        </div>
        <div className="relative flex items-end gap-2">
          <div className="w-64"><CrmSearch /></div>
          <AddCustomer businessId={business.id} />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-y border-line py-3">
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
      {activeSegment ? <div className="flex justify-end"><Link href={`/dashboard/campaigns?segment=${activeSegment.code}`} className="border border-brand bg-brand px-4 py-2 text-sm font-semibold text-canvas">[ Рассылка для сегмента ]</Link></div> : null}

      <details className="ascii-details border border-line bg-surface p-4">
        <summary className="text-sm font-semibold uppercase tracking-wide text-ink">Точные фильтры</summary>
      <form className="mt-4 grid gap-2 border-t border-line pt-4 md:grid-cols-6">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        {segment ? <input type="hidden" name="segment" value={segment} /> : null}
        <select name="activity" defaultValue={activity ?? ''} className="rounded-xl border border-line px-3 py-2 text-sm"><option value="">Любая активность</option><option value="active">Активные</option><option value="declining">Снижается</option><option value="at_risk">Под риском</option><option value="lapsed">Давно не были</option></select>
        <select name="level" defaultValue={level ?? ''} className="rounded-xl border border-line px-3 py-2 text-sm"><option value="">Любой уровень</option><option value="new">Новые</option><option value="returning">Вернувшиеся</option><option value="habit_forming">Формируют привычку</option><option value="regular">Постоянные</option><option value="loyal">Лояльные</option></select>
        <input name="minDays" type="number" min="0" defaultValue={minDays} placeholder="Не были, дней от" className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input name="minPoints" type="number" min="0" defaultValue={minPoints} placeholder="Бонусов от" className="rounded-xl border border-line px-3 py-2 text-sm" />
        <select name="consent" defaultValue={consent ?? ''} className="rounded-xl border border-line px-3 py-2 text-sm"><option value="">Любое согласие</option><option value="yes">Согласие есть</option><option value="no">Без согласия</option></select>
        <select name="sort" defaultValue={sort ?? 'last_seen'} className="rounded-xl border border-line px-3 py-2 text-sm"><option value="last_seen">Свежие визиты</option><option value="points">Больше бонусов</option><option value="spent">Больше трат</option><option value="visits">Больше визитов</option></select>
        <button className="border border-brand bg-brand px-3 py-2 text-sm font-semibold text-canvas md:col-span-6">[ Применить фильтры ]</button>
      </form>
      </details>

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
                  <th className="px-4 py-3 font-medium">Последний визит</th>
                  <th className="px-4 py-3 text-right font-medium">Бонусы</th>
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
                    <td className="px-4 py-3 text-ink-soft">{daysAgoLabel(p.daysSinceLastVisit)}</td>
                    <td className="px-4 py-3 text-right tnum text-brand">{num(p.membership.points)}</td>
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
