'use client';

/**
 * Карточка инструмента в каталоге.
 *
 * Вызывающие: src/app/(app)/tools/page.tsx.
 * Показывает название, описание, тип функции; кнопки «Активировать» и
 * «В избранное» — требование положения.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { activateTool, deactivateTool, toggleFavorite } from '@/app/(app)/tools/actions';
import { Badge, Button, Card } from '@/components/ui/kit';
import ToolIcon from '@/components/ui/ToolIcon';
import { CATEGORY_LABELS, TOOL_KIND_LABELS } from '@/lib/tool-labels';
import type { Tool } from '@/lib/types';

export default function ToolCard({
  tool,
  activated,
  favorite,
}: {
  tool: Tool;
  activated: boolean;
  favorite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: (id: string) => Promise<void>) {
    start(async () => {
      await fn(tool.id);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <ToolIcon name={tool.icon} size={20} />
        </span>
        <button
          onClick={() => run(toggleFavorite)}
          disabled={pending}
          aria-label="В избранное"
          className={`text-lg leading-none ${favorite ? 'text-warn' : 'text-line hover:text-ink-soft'}`}
        >
          {favorite ? '★' : '☆'}
        </button>
      </div>
      <h3 className="font-semibold text-ink">{tool.title}</h3>
      <p className="mt-1 flex-1 text-sm text-ink-soft">{tool.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <Badge tone="brand">{CATEGORY_LABELS[tool.category]}</Badge>
        <Badge tone="muted">{TOOL_KIND_LABELS[tool.kind]}</Badge>
      </div>
      <div className="mt-3">
        {activated ? (
          <Button variant="secondary" className="w-full" onClick={() => run(deactivateTool)} disabled={pending}>
            Активирован — отключить
          </Button>
        ) : (
          <Button className="w-full" onClick={() => run(activateTool)} disabled={pending}>
            Активировать
          </Button>
        )}
      </div>
    </Card>
  );
}
