/**
 * Сотрудники и роли + аудит действий.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/staff.
 * Пять ролей из спеки; журнал показывает, кто что провёл — основа для
 * контроля подозрительных списаний.
 */

import { Badge, Card, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { dateShort, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { StaffRole } from '@/lib/types';

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  marketer: 'Маркетолог',
  cashier: 'Кассир',
  manager: 'Управляющий',
};

export default async function StaffPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [staff, log] = await Promise.all([
    repo.listStaff(business.id),
    repo.listActivityLog(business.id, 20),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Сотрудники</h1>
        <p className="text-sm text-ink-soft">Роли и журнал действий</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {staff.map((s) => (
          <Card key={s.id} className="flex items-center justify-between gap-2 p-4">
            <div>
              <p className="font-medium text-ink">{s.name}</p>
              <p className="text-xs text-ink-soft">PIN {s.pin}</p>
            </div>
            <Badge tone={s.role === 'owner' ? 'brand' : 'muted'}>{ROLE_LABELS[s.role]}</Badge>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-ink-soft">Журнал действий</h2>
        {log.length === 0 ? (
          <EmptyState title="Записей нет" />
        ) : (
          <Card className="p-0">
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
      </section>
    </div>
  );
}
