/**
 * Настройка бонусной программы.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/loyalty.
 */

import LoyaltyForm from '@/components/loyalty/LoyaltyForm';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import { requireSession } from '@/lib/auth';

export default async function LoyaltyPage() {
  await requireSession(['owner', 'admin']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const config = await repo.getLoyaltyConfig(business.id);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Лояльность</h1>
        <p className="text-sm text-ink-soft">Начисление, лимит списания, награды и сгорание</p>
      </header>
      <LoyaltyForm config={config} />
    </div>
  );
}
