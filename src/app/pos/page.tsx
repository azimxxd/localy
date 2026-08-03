/**
 * Экран кассы.
 *
 * Вызывающие: роутер Next, маршрут /pos. Вне группы (app): у кассира нет
 * навигации владельца — только терминал.
 */

import PosTerminal from '@/components/pos/PosTerminal';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import { requireSession } from '@/lib/auth';

export default async function PosPage() {
  const session = await requireSession(['owner', 'admin', 'manager', 'cashier']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [staff, loyalty, promos] = await Promise.all([
    repo.listStaff(business.id),
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
  ]);
  const cashier = staff.find((item) => item.id === session.staffId) ?? staff.find((s) => s.role === 'cashier') ?? staff[0];

  return (
    <PosTerminal
      businessId={business.id}
      businessName={business.name}
      staffId={session.staffId ?? cashier?.id ?? 'stf_demo'}
      canOpenCrm={session.role !== 'cashier'}
      pointsPerCurrency={loyalty.pointsPerCurrency}
      promos={promos.filter((promo) => promo.status === 'active' && (!promo.placements || promo.placements.includes('cashier')) && (!promo.branchId || promo.branchId === cashier?.branchId)).map((promo) => ({ id: promo.id, title: promo.title, promocode: promo.promocode }))}
    />
  );
}
