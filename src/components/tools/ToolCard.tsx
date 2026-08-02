'use client';

/**
 * Карточка инструмента в каталоге.
 *
 * Вызывающие: src/app/(app)/tools/page.tsx.
 * Показывает название, описание, тип функции; кнопки «Активировать» и
 * «В избранное» — требование положения.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { activateTool, deactivateTool, toggleFavorite } from '@/app/(app)/tools/actions';
import { Badge, Button, Card } from '@/components/ui/kit';
import ToolIcon from '@/components/ui/ToolIcon';
import { CATEGORY_LABELS, TOOL_KIND_LABELS } from '@/lib/tool-labels';
import type { Tool } from '@/lib/types';
import { runtimeFor } from '@/lib/tool-runtime';

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
  const [error, setError] = useState<string | null>(null);
  const runtime = runtimeFor(tool);

  function run(fn: (id: string) => Promise<void>) {
    setError(null);
    start(async () => {
      try { await fn(tool.id); router.refresh(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось изменить инструмент'); }
    });
  }

  return (
    <div data-tool-id={tool.id} className="flex"><Card className="flex flex-1 flex-col">
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
      <p className="mt-1 flex-1 text-sm text-ink-soft">{runtime.outcome}</p>
      <div className="mt-3 flex items-center gap-2">
        <Badge tone="brand">{CATEGORY_LABELS[tool.category]}</Badge>
        <Badge tone="muted">{TOOL_KIND_LABELS[tool.kind]}</Badge>
      </div>
      <div className="mt-3">
        {activated ? <div className="grid grid-cols-[1fr_auto] gap-2">
          <Link href={runtime.href} className="inline-flex items-center justify-center border border-brand bg-brand px-3 py-2.5 text-center text-sm font-semibold uppercase tracking-[0.04em] text-canvas hover:bg-transparent hover:text-brand">{runtime.action}</Link>
          <Button aria-label="Убрать из моих инструментов" title="Убрать из моих" variant="secondary" onClick={() => run(deactivateTool)} disabled={pending}>×</Button>
        </div> : (
          <Button className="w-full" onClick={() => run(activateTool)} disabled={pending}>
            {pending ? 'Добавляем…' : 'Добавить в мои'}
          </Button>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </Card></div>
  );
}
