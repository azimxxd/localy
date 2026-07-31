/**
 * Карточка клиента: все поля спеки + объяснение активности + история.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/crm/[customerId].
 * Активность объясняем человеческим языком («обычно раз в 6–7 дней,
 * последний визит 11 дней назад») — это и есть смысл движка на витрине.
 */

import Link from 'next/link';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { ACTIVITY_LABELS, ACTIVITY_TONE, explainActivity, LEVEL_LABELS } from '@/lib/engine';
import { feedKindLabel } from '@/lib/feed';
import { dateShort, kzt, num, percent, plural, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function CustomerCardPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const profile = await repo.getCustomerProfile(business.id, customerId);
  if (!profile) {
    return <EmptyState title="Клиент не найден" hint="Возможно, он не состоит в этом заведении" />;
  }
  const history = await repo.listTransactionsForCustomer(business.id, customerId);

  const { customer, membership } = profile;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/crm" className="text-sm text-ink-soft hover:text-brand">
        ← К списку клиентов
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{customer.name}</h1>
          <p className="text-sm text-ink-soft">{customer.phone}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="brand">{LEVEL_LABELS[profile.level]}</Badge>
          <Badge tone={ACTIVITY_TONE[profile.activity]}>{ACTIVITY_LABELS[profile.activity]}</Badge>
        </div>
      </header>

      <Card>
        <p className="text-ink">{explainActivity(profile)}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Вероятность визита в ближайшие 7 дней — {percent(profile.visitProbability7d)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Визитов" value={num(membership.visits)} />
        <Stat label="Средний чек" value={kzt(profile.avgCheck)} />
        <Stat label="Бонусов" value={num(membership.points)} />
        <Stat
          label="До награды"
          value={profile.visitsToReward > 0 ? num(profile.visitsToReward) : '—'}
          sub={
            profile.visitsToReward > 0
              ? plural(profile.visitsToReward, ['визит', 'визита', 'визитов'])
              : 'награда доступна'
          }
        />
      </div>

      {membership.favoriteItems.length > 0 ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">Обычно берёт</h2>
          <div className="flex flex-wrap gap-2">
            {membership.favoriteItems.map((item) => (
              <Badge key={item} tone="muted">
                {item}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-ink">История</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Пока нет операций.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    {feedKindLabel(t.kind)}
                    {t.items.length ? ` · ${t.items.join(', ')}` : ''}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {dateShort(t.createdAt)}, {timeShort(t.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  {t.amount > 0 ? <p className="tnum">{kzt(t.amount)}</p> : null}
                  <p className={`text-xs tnum ${t.pointsDelta >= 0 ? 'text-ok' : 'text-danger'}`}>
                    {t.pointsDelta >= 0 ? '+' : '−'}
                    {num(Math.abs(t.pointsDelta))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
