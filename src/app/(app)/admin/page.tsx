/**
 * Админ-панель платформы.
 *
 * Вызывающие: роутер Next, маршрут /admin.
 * Требование положения: CRUD инструментов и шаблонов, управление категориями
 * и типами бизнеса, аналитика использования (на /admin/stats).
 *
 * Категории и типы бизнеса — фиксированные справочники (перечисления в
 * контракте), поэтому показываем их списком: добавление новых значений
 * enum — задача уровня схемы, не рантайма. Отмечено честно.
 */

import Link from 'next/link';
import AdminTemplates from '@/components/admin/AdminTemplates';
import AdminTools from '@/components/admin/AdminTools';
import { Badge, Card, btnClass } from '@/components/ui/kit';
import { CATEGORY_LABELS } from '@/lib/tool-labels';
import { getRepo } from '@/lib/repo';
import type { ToolCategory } from '@/lib/types';
import { requireSession } from '@/lib/auth';
import AdminPlatformManager from '@/components/admin/AdminPlatformManager';
import AdminBusinessTypes from '@/components/admin/AdminBusinessTypes';
import AdminRecommendationRules from '@/components/admin/AdminRecommendationRules';

export default async function AdminPage() {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  const [tools, templates, businessTypes, businesses, users, plans, recommendationSettings] = await Promise.all([
    repo.listTools(),
    repo.listTemplates(),
    repo.listBusinessTypes(),
    repo.listBusinesses(),
    repo.listUsers(),
    repo.listPlans(),
    repo.listRecommendationSettings(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Админ платформы</h1>
          <p className="text-sm text-ink-soft">Инструменты, шаблоны, справочники</p>
        </div>
        <Link href="/admin/stats" className={btnClass('secondary')}>
          Аналитика платформы
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-ink">Категории инструментов</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((c) => (
              <Badge key={c} tone="brand">
                {CATEGORY_LABELS[c]}
              </Badge>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-ink">Типы бизнеса</h2>
          <AdminBusinessTypes types={businessTypes} />
        </Card>
      </div>

      <AdminPlatformManager businesses={businesses} users={users} plans={plans} />

      <AdminRecommendationRules settings={recommendationSettings} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Инструменты каталога ({tools.length})</h2>
        <AdminTools tools={tools} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Шаблоны ({templates.length})</h2>
        <AdminTemplates templates={templates} />
      </section>
    </div>
  );
}
