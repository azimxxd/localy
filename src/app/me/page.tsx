/**
 * Кабинет клиента: один QR на все заведения, раздельные балансы.
 *
 * Вызывающие: роутер Next, маршрут /me. Вне группы (app) — у клиента нет
 * навигации владельца. Это витрина, готовая стать Telegram Mini App.
 *
 * Показываем ядро продукта: один человек, один QR, отдельный баланс и
 * прогресс до награды в каждом бизнесе.
 */

import Link from 'next/link';
import ClientQr from '@/components/me/ClientQr';
import PendingPurchase from '@/components/me/PendingPurchase';
import ReferralSystem from '@/components/me/ReferralSystem';
import { Card } from '@/components/ui/kit';
import { DEMO_CUSTOMER_ID } from '@/lib/demo';
import { kzt, num, plural } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { getCustomerSessionId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const nowMs = new Date().getTime();
  const repo = await getRepo();
  const sessionCustomerId = await getCustomerSessionId();
  const publicDemoEnabled = process.env.NODE_ENV !== 'production' || process.env.LOCALY_ENABLE_PUBLIC_DEMO === 'true';
  if (!sessionCustomerId && !publicDemoEnabled) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink">Войдите по номеру телефона</h1>
        <p className="text-ink-soft">Выберите заведение и подтвердите номер кодом из SMS — после этого откроется ваш универсальный QR.</p>
        <Link href="/discover" className="inline-flex border border-brand bg-brand px-5 py-3 text-surface">Выбрать заведение</Link>
      </div>
    );
  }
  const customerId = sessionCustomerId ?? DEMO_CUSTOMER_ID;
  const existingCustomer = await repo.getCustomer(customerId);
  const customer = existingCustomer ? await repo.rotateQrToken(customerId) : null;
  if (!customer) {
    return <p className="p-6 text-ink-soft">Демо-клиент не найден.</p>;
  }

  const memberships = await repo.listMembershipsForCustomer(customer.id);
  const referralCode = await repo.getReferralCode(customer.id);
  const cards = await Promise.all(
    memberships.map(async ({ business, membership }) => {
      const [loyalty, transactions] = await Promise.all([
        repo.getLoyaltyConfig(business.id),
        repo.listTransactionsForCustomer(business.id, customer.id),
      ]);
      const rewardEvery = loyalty.rewardEveryVisits ?? 6;
      const rewardAvailable = Math.floor(membership.visits / rewardEvery) > (membership.claimedVisitRewards ?? 0);
      const visitProgress = rewardAvailable ? rewardEvery : membership.visits % rewardEvery;
      const visitsLeft = Math.max(0, rewardEvery - visitProgress);
      const progress = Math.min(1, visitProgress / rewardEvery);
      const expiryDaysLeft = loyalty.expiryDays === null ? null : Math.max(0, loyalty.expiryDays - Math.floor((nowMs - new Date(membership.lastSeen).getTime()) / 86_400_000));
      const pending = transactions.filter((transaction) => transaction.status === 'pending_confirmation');
      return { business, membership, loyalty, progress, pending, visitProgress, visitsLeft, rewardEvery, expiryDaysLeft };
    }),
  );

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="text-center">
        <h1 className="text-xl font-bold text-ink">{customer.name}</h1>
        <p className="text-sm text-ink-soft">Ваш QR действует во всех заведениях Localy</p>
      </header>

      <ClientQr customerId={customer.id} initialToken={customer.qrToken} brandColor="#0f172a" rotatable={Boolean(sessionCustomerId)} />

      {sessionCustomerId ? cards.flatMap(({ business, pending }) => pending.map((transaction) => (
        <PendingPurchase
          key={transaction.id}
          id={transaction.id}
          businessName={business.name}
          amount={transaction.amount}
          redeemPoints={transaction.redeemedPoints ?? 0}
        />
      ))) : null}

      {cards.length > 0 ? (
        <ReferralSystem
          referralCode={referralCode}
          businesses={cards.map(({ business }) => ({
            id: business.id,
            name: business.name,
            slug: business.slug,
          }))}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Мои заведения ({cards.length})
        </h2>
        {cards.map(({ business, membership, loyalty, progress, visitProgress, visitsLeft, rewardEvery, expiryDaysLeft }) => (
          <Link key={business.id} href={`/me/${business.id}`} className="block">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{business.name}</p>
                <span className="tnum font-semibold text-brand">{num(membership.points)}</span>
              </div>
              <p className="text-xs text-ink-soft">
                {num(membership.visits)}{' '}
                {plural(membership.visits, ['визит', 'визита', 'визитов'])} · потрачено{' '}
                {kzt(membership.totalSpent)}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {visitProgress >= rewardEvery
                  ? `Награда доступна: ${loyalty.rewardTitle}`
                  : `${visitProgress} из ${rewardEvery} посещений. Осталось ещё ${visitsLeft} до награды.`}
              </p>
              {expiryDaysLeft !== null && membership.points > 0 ? <p className="mt-1 text-xs text-warn">{expiryDaysLeft > 0 ? `Бонусы сгорят через ${expiryDaysLeft} дн.` : 'Срок бонусов истёк — уточните баланс у бизнеса.'}</p> : null}
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
