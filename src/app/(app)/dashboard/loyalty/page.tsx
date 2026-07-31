/**
 * Настройка бонусной программы.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/loyalty.
 */

import LoyaltyForm from '@/components/loyalty/LoyaltyForm';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function LoyaltyPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const config = await repo.getLoyaltyConfig(business.id);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Лояльность</h1>
        <p className="text-sm text-ink-soft">Начисление, награда и сгорание бонусов</p>
      </header>
      <LoyaltyForm config={config} />
    </div>
  );
}
