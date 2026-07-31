/**
 * Каркас кабинета владельца: боковая навигация + область страницы.
 *
 * Вызывающие: роутер Next для всех маршрутов группы (app) — /dashboard, /tools.
 * /pos и /me намеренно вне группы: у кассира и клиента нет этой навигации.
 */

import Sidebar from '@/components/shell/Sidebar';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(['owner', 'admin', 'marketer', 'manager', 'platform_admin']);
  const repo = await getRepo();
  const [allBusinesses, active] = await Promise.all([repo.listBusinesses(), getActiveBusiness()]);
  const businesses =
    session.role === 'platform_admin'
      ? allBusinesses
      : allBusinesses.filter((business) => business.id === session.businessId);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
        activeId={active.id}
        role={session.role}
        userName={session.name}
      />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:py-7">{children}</main>
    </div>
  );
}
