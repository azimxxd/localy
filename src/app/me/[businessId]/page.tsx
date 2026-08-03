/**
 * Витрина клиента по конкретному заведению.
 *
 * Вызывающие: роутер Next, маршрут /me/[businessId] (карточки со страницы /me).
 * Баланс, прогресс до награды, персональные предложения, история именно
 * в этом бизнесе — балансы раздельные, это ядро продукта.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui/kit';
import { DEMO_CUSTOMER_ID } from '@/lib/demo';
import { feedKindLabel } from '@/lib/feed';
import { dateShort, kzt, num } from '@/lib/format';
import { PROMO_KIND_LABELS } from '@/lib/promo-labels';
import { getRepo } from '@/lib/repo';
import { getCustomerSessionId } from '@/lib/auth';
import ConsentPreferences from '@/components/me/ConsentPreferences';

export const dynamic = 'force-dynamic';

export default async function MeBusinessPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const nowMs = new Date().getTime();
  const { businessId } = await params;
  const repo = await getRepo();
  const sessionCustomerId = await getCustomerSessionId();
  const customerId = sessionCustomerId ?? DEMO_CUSTOMER_ID;

  const [business, membership] = await Promise.all([
    repo.getBusiness(businessId),
    repo.getMembership(businessId, customerId),
  ]);
  if (!business || !membership) notFound();

  const [loyalty, history, promos] = await Promise.all([
    repo.getLoyaltyConfig(businessId),
    repo.listTransactionsForCustomer(businessId, customerId),
    repo.listPromos(businessId),
  ]);

  const toReward = Math.max(0, loyalty.rewardThreshold - membership.points);
  const rewardEvery = loyalty.rewardEveryVisits ?? 6;
  const rewardAvailable = Math.floor(membership.visits / rewardEvery) > (membership.claimedVisitRewards ?? 0);
  const visitProgress = rewardAvailable ? rewardEvery : membership.visits % rewardEvery;
  const progress = Math.min(1, visitProgress / rewardEvery);
  const expiryDaysLeft = loyalty.expiryDays === null ? null : Math.max(0, loyalty.expiryDays - Math.floor((nowMs - new Date(membership.lastSeen).getTime()) / 86_400_000));
  const offers = promos.filter((p) => p.status === 'active' && (!p.placements || p.placements.includes('client_app')));
  const recentHistory = history.slice(0, 6);

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-6">
      <Link href="/me" className="text-sm text-ink-soft hover:text-brand">
        ← Все заведения
      </Link>

      <header>
        <h1 className="text-xl font-bold text-ink">{business.name}</h1>
        <p className="text-sm text-ink-soft">{business.city}</p>
      </header>

      <Card className="text-center">
        <p className="text-3xl font-bold tnum text-brand">{num(membership.points)}</p>
        <p className="text-sm text-ink-soft">бонусов</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {visitProgress >= rewardEvery ? `Награда доступна: ${loyalty.rewardTitle}` : `${visitProgress} из ${rewardEvery} посещений · ещё ${rewardEvery - visitProgress} до награды`}
        </p>
        <p className="mt-2 text-xs text-ink-soft">До бонусной награды осталось: {num(toReward)} бонусов</p>
        {expiryDaysLeft !== null && membership.points > 0 ? <p className="mt-1 text-xs text-warn">{expiryDaysLeft > 0 ? `До сгорания бонусов: ${expiryDaysLeft} дн.` : 'Срок бонусов истёк.'}</p> : null}
      </Card>

      {offers.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-ink-soft">Для вас</h2>
          {offers.map((p) => (
            <Card key={p.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">{p.title}</p>
                <Badge tone="brand">{PROMO_KIND_LABELS[p.kind]}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">Промокод: {p.promocode}</p>
            </Card>
          ))}
        </section>
      ) : null}

      {sessionCustomerId ? <ConsentPreferences businessId={businessId} initial={membership.consentChannels} /> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-ink-soft">Последние покупки</h2>
        {recentHistory.length === 0 ? (
          <p className="text-sm text-ink-soft">Пока пусто.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {recentHistory.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {feedKindLabel(t.kind)}
                      {t.items.length ? ` · ${t.items.join(', ')}` : ''}
                    </p>
                    <p className="text-xs text-ink-soft">{dateShort(t.createdAt)}</p>
                    {t.status === 'pending_confirmation' ? <Badge tone="warning" className="mt-1">Ожидает подтверждения</Badge> : null}
                  </div>
                  <div className="text-right">
                    {t.amount > 0 ? <p className="text-sm tnum">{kzt(t.amount)}</p> : null}
                    <p className={`text-xs tnum ${t.pointsDelta >= 0 ? 'text-ok' : 'text-danger'}`}>
                      {t.pointsDelta >= 0 ? '+' : '−'}
                      {num(Math.abs(t.pointsDelta))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
