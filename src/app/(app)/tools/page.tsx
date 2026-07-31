/**
 * Каталог инструментов.
 *
 * Вызывающие: роутер Next, маршрут /tools.
 * Требование положения: карточки с типом функции, фильтры по пяти категориям,
 * избранное, «Активировать». Фильтр живёт в URL.
 */

import Link from 'next/link';
import ToolCard from '@/components/tools/ToolCard';
import { Badge, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { CATEGORY_LABELS } from '@/lib/tool-labels';
import { getRepo } from '@/lib/repo';
import type { ToolCategory } from '@/lib/types';

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; fav?: string }>;
}) {
  const { category, fav } = await searchParams;
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [tools, businessTools] = await Promise.all([
    repo.listTools({ categories: category ? [category as ToolCategory] : undefined }),
    repo.listBusinessTools(business.id),
  ]);

  const state = new Map(businessTools.map((bt) => [bt.toolId, bt]));
  const favOnly = fav === '1';
  const visible = favOnly ? tools.filter((t) => state.get(t.id)?.isFavorite) : tools;

  const chip = (params: { category?: string; fav?: string }) => {
    const p = new URLSearchParams();
    if (params.category) p.set('category', params.category);
    if (params.fav) p.set('fav', params.fav);
    const s = p.toString();
    return s ? `/tools?${s}` : '/tools';
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Каталог инструментов</h1>
        <p className="text-sm text-ink-soft">Активируйте нужное для «{business.name}»</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href={chip({ fav: favOnly ? '1' : undefined })}>
          <Badge tone={category ? 'muted' : 'brand'}>Все</Badge>
        </Link>
        {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((c) => (
          <Link key={c} href={chip({ category: c, fav: favOnly ? '1' : undefined })}>
            <Badge tone={c === category ? 'brand' : 'muted'}>{CATEGORY_LABELS[c]}</Badge>
          </Link>
        ))}
        <Link href={chip({ category, fav: favOnly ? undefined : '1' })} className="ml-auto">
          <Badge tone={favOnly ? 'warning' : 'muted'}>★ Избранное</Badge>
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Инструментов нет" hint="Смените фильтр" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <ToolCard
              key={t.id}
              tool={t}
              activated={!!state.get(t.id)?.activatedAt}
              favorite={!!state.get(t.id)?.isFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
