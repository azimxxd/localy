/**
 * Экран кассы.
 *
 * Вызывающие: роутер Next, маршрут /pos. Вне группы (app): у кассира нет
 * навигации владельца — только терминал.
 */

import PosTerminal from '@/components/pos/PosTerminal';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function PosPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [staff, loyalty] = await Promise.all([
    repo.listStaff(business.id),
    repo.getLoyaltyConfig(business.id),
  ]);
  const cashier = staff.find((s) => s.role === 'cashier') ?? staff[0];

  return (
    <PosTerminal
      businessId={business.id}
      businessName={business.name}
      staffId={cashier?.id ?? 'stf_demo'}
      pointsPerCurrency={loyalty.pointsPerCurrency}
    />
  );
}
