/**
 * Карточка клиента: все поля спеки + объяснение активности + история.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/crm/[customerId].
 * Активность объясняем человеческим языком («обычно раз в 6–7 дней,
 * последний визит 11 дней назад») — это и есть смысл движка на витрине.
 */

import Link from 'next/link';
import { Badge, Card, EmptyState, Stat, btnClass } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { ACTIVITY_LABELS, ACTIVITY_TONE, explainActivity, LEVEL_LABELS } from '@/lib/engine';
import { feedKindLabel } from '@/lib/feed';
import { dateShort, kzt, num, percent, plural, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import CustomerEditor from '@/components/crm/CustomerEditor';
import { requireSession } from '@/lib/auth';

export default async function CustomerCardPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const session = await requireSession(['owner', 'admin', 'marketer', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const profile = await repo.getCustomerProfile(business.id, customerId);
  if (!profile) {
    return <EmptyState title="Клиент не найден" hint="Возможно, он не состоит в этом заведении" />;
  }
  const [history, branches, staff, promos, referrals, referralCode] = await Promise.all([
    repo.listTransactionsForCustomer(business.id, customerId),
    repo.listBranches(business.id),
    repo.listStaff(business.id),
    repo.listPromos(business.id),
    repo.listReferrals(business.id, customerId),
    repo.getReferralCode(customerId),
  ]);

  const { customer, membership } = profile;
  const invited = referrals.filter((item) => item.referrerId === customerId);
  const invitedBy = referrals.find((item) => item.invitedId === customerId);
  const invitedByCustomer = invitedBy ? await repo.getCustomer(invitedBy.referrerId) : null;

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

      <Card className="space-y-1">
        <p className="ascii-kicker">Рефералы</p>
        <p className="text-sm text-ink">
          Код приглашения — <strong className="tnum">{referralCode}</strong>. Привёл клиентов: {invited.length}
          {invited.length > 0 ? ` · награда начислена ${invited.filter((item) => item.rewardedAt).length}` : ''}
        </p>
        {invitedByCustomer ? (
          <p className="text-sm text-ink-soft">
            Пришёл по приглашению: {invitedByCustomer.name}
            {invitedBy?.rewardedAt ? ' · награда начислена обоим' : ' · награда после первой покупки'}
          </p>
        ) : null}
      </Card>

      <Card>
        <p className="text-ink">{explainActivity(profile)}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Вероятность визита в ближайшие 7 дней — {percent(profile.visitProbability7d)}
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/promos/new" className={btnClass('primary')}>Создать предложение</Link>
        <Link href="/dashboard/campaigns" className={btnClass('secondary')}>Открыть рассылки</Link>
      </div>

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

      <Card>
        <div className="grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div><p className="text-xs text-ink-soft">В Localy с</p><p className="font-medium text-ink">{dateShort(customer.createdAt)}</p></div>
          <div><p className="text-xs text-ink-soft">В этом бизнесе с</p><p className="font-medium text-ink">{dateShort(membership.firstSeen)}</p></div>
          <div><p className="text-xs text-ink-soft">Всего потрачено</p><p className="font-medium text-ink">{kzt(membership.totalSpent)}</p></div>
          <div><p className="text-xs text-ink-soft">Источник</p><p className="font-medium text-ink">{membership.source ?? 'QR на кассе'}</p></div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">Согласие: {membership.consentChannels.length ? membership.consentChannels.join(', ') : 'не дано'}</p>
      </Card>

      {session.role !== 'marketer' ? <CustomerEditor customer={customer} membership={membership} canDelete={session.role === 'owner' || session.role === 'admin'} /> : null}

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
                    {' · '}{branches.find((branch) => branch.id === t.branchId)?.title ?? 'Основная точка'}
                    {' · '}{staff.find((employee) => employee.id === t.staffId)?.name ?? 'Система'}
                  </p>
                  {t.status === 'pending_confirmation' ? <Badge tone="warning" className="mt-1">Ожидает подтверждения</Badge> : null}
                  {t.promoId ? <p className="mt-1 text-xs text-brand">Акция: {promos.find((promo) => promo.id === t.promoId)?.title ?? t.promoId}</p> : null}
                  {t.rewardTitle ? <p className="mt-1 text-xs text-ok">Награда: {t.rewardTitle}</p> : null}
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
