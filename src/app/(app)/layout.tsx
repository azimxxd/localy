/**
 * Каркас кабинета владельца: боковая навигация + область страницы.
 *
 * Вызывающие: роутер Next для всех маршрутов группы (app) — /dashboard, /tools.
 * /pos и /me намеренно вне группы: у кассира и клиента нет этой навигации.
 */

import Sidebar from '@/components/shell/Sidebar';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const repo = await getRepo();
  const [businesses, active] = await Promise.all([repo.listBusinesses(), getActiveBusiness()]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
        activeId={active.id}
      />
      <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
