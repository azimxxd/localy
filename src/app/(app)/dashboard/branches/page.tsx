/**
 * Филиалы бизнеса.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/branches.
 */

import { Card, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function BranchesPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const branches = await repo.listBranches(business.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Филиалы</h1>
        <p className="text-sm text-ink-soft">Точки «{business.name}»</p>
      </header>

      {branches.length === 0 ? (
        <EmptyState title="Филиалов нет" />
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <Card key={b.id} className="p-4">
              <p className="font-medium text-ink">{b.title}</p>
              <p className="text-sm text-ink-soft">{b.address}</p>
              <p className="text-sm text-ink-soft">{b.phone}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
