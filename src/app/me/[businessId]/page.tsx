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

export default async function MeBusinessPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const repo = await getRepo();

  const [business, membership] = await Promise.all([
    repo.getBusiness(businessId),
    repo.getMembership(businessId, DEMO_CUSTOMER_ID),
  ]);
  if (!business || !membership) notFound();

  const [loyalty, history, promos] = await Promise.all([
    repo.getLoyaltyConfig(businessId),
    repo.listTransactionsForCustomer(businessId, DEMO_CUSTOMER_ID),
    repo.listPromos(businessId),
  ]);

  const toReward = Math.max(0, loyalty.rewardThreshold - membership.points);
  const progress = Math.min(1, membership.points / loyalty.rewardThreshold);
  const offers = promos.filter((p) => p.status === 'active');

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
          {toReward > 0 ? `Ещё ${num(toReward)} до «${loyalty.rewardTitle}»` : `Награда доступна: ${loyalty.rewardTitle}`}
        </p>
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-ink-soft">История</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Пока пусто.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {history.slice(0, 20).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {feedKindLabel(t.kind)}
                      {t.items.length ? ` · ${t.items.join(', ')}` : ''}
                    </p>
                    <p className="text-xs text-ink-soft">{dateShort(t.createdAt)}</p>
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
