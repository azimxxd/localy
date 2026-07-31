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
import { Card } from '@/components/ui/kit';
import { DEMO_CUSTOMER_ID } from '@/lib/demo';
import { kzt, num, plural } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function MePage() {
  const repo = await getRepo();
  const customer = await repo.getCustomer(DEMO_CUSTOMER_ID);
  if (!customer) {
    return <p className="p-6 text-ink-soft">Демо-клиент не найден.</p>;
  }

  const memberships = await repo.listMembershipsForCustomer(customer.id);
  const cards = await Promise.all(
    memberships.map(async ({ business, membership }) => {
      const loyalty = await repo.getLoyaltyConfig(business.id);
      const toReward = Math.max(0, loyalty.rewardThreshold - membership.points);
      const progress = Math.min(1, membership.points / loyalty.rewardThreshold);
      return { business, membership, loyalty, toReward, progress };
    }),
  );

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header className="text-center">
        <h1 className="text-xl font-bold text-ink">{customer.name}</h1>
        <p className="text-sm text-ink-soft">Ваш QR действует во всех заведениях Localy</p>
      </header>

      <ClientQr customerId={customer.id} initialToken={customer.qrToken} brandColor="#0f172a" />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Мои заведения ({cards.length})
        </h2>
        {cards.map(({ business, membership, loyalty, toReward, progress }) => (
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
                {toReward > 0
                  ? `Ещё ${num(toReward)} бонусов до «${loyalty.rewardTitle}»`
                  : `Награда доступна: ${loyalty.rewardTitle}`}
              </p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
