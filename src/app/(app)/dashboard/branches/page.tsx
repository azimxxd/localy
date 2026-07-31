/**
 * Филиалы бизнеса.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/branches.
 */

import { EmptyState } from '@/components/ui/kit';
import BranchManager from '@/components/branches/BranchManager';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function BranchesPage() {
  const session = await requireSession(['owner', 'admin', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const branches = await repo.listBranches(business.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="ascii-kicker">~/localy/branches</p><h1 className="mt-1 text-2xl font-bold uppercase text-ink">+-- Филиалы --+</h1>
        <p className="mt-1 text-sm text-ink-soft">Точки «{business.name}»</p>
      </header>

      {branches.length === 0 ? (
        <EmptyState title="Филиалов нет" />
      ) : (
        <BranchManager businessId={business.id} branches={branches} editable={session.role === 'owner' || session.role === 'admin'} />
      )}
    </div>
  );
}
