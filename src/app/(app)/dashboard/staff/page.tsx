/**
 * Сотрудники и роли + аудит действий.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/staff.
 * Пять ролей из спеки; журнал показывает, кто что провёл — основа для
 * контроля подозрительных списаний.
 */

import { Card, EmptyState } from '@/components/ui/kit';
import StaffManager from '@/components/staff/StaffManager';
import { getActiveBusiness } from '@/lib/demo';
import { dateShort, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { requireSession } from '@/lib/auth';

export default async function StaffPage() {
  const session = await requireSession(['owner', 'admin']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [staff, log, branches] = await Promise.all([
    repo.listStaff(business.id),
    repo.listActivityLog(business.id, 20),
    repo.listBranches(business.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="ascii-kicker">Команда</p><h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">Сотрудники</h1>
        <p className="mt-1 text-sm text-ink-soft">Доступы, роли и филиалы</p>
      </header>
      <StaffManager businessId={business.id} staff={staff} branches={branches} viewerRole={session.role as 'owner' | 'admin'} />

      <details className="ascii-details border border-line bg-surface p-4">
        <summary className="text-sm font-semibold uppercase text-ink">Журнал действий ({log.length})</summary>
        {log.length === 0 ? (
          <EmptyState title="Записей нет" />
        ) : (
          <Card className="mt-4 p-0">
            <ul className="divide-y divide-line">
              {log.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{e.type}</p>
                    <p className="truncate text-xs text-ink-soft">{e.actorName}</p>
                  </div>
                  <p className="shrink-0 text-xs text-ink-soft">
                    {dateShort(e.at)}, {timeShort(e.at)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </details>
    </div>
  );
}
