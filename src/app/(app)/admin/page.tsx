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
import ToolIcon from '@/components/ui/ToolIcon';
import { CATEGORY_LABELS } from '@/lib/tool-labels';
import { getRepo } from '@/lib/repo';
import type { ToolCategory } from '@/lib/types';

export default async function AdminPage() {
  const repo = await getRepo();
  const [tools, templates, businessTypes] = await Promise.all([
    repo.listTools(),
    repo.listTemplates(),
    repo.listBusinessTypes(),
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
          <div className="flex flex-wrap gap-2">
            {businessTypes.map((bt) => (
              <Badge key={bt.id} tone="muted">
                <ToolIcon name={bt.icon} size={13} />
                {bt.title}
              </Badge>
            ))}
          </div>
        </Card>
      </div>

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
