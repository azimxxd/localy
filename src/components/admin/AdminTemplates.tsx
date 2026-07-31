'use client';

/**
 * Админка: CRUD маркетинговых шаблонов.
 *
 * Вызывающие: src/app/(app)/admin/page.tsx.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createTemplateAction, deleteTemplateAction } from '@/app/(app)/admin/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { CATEGORY_LABELS, TEMPLATE_KIND_LABELS } from '@/lib/tool-labels';
import type { Template, ToolCategory } from '@/lib/types';

export default function AdminTemplates({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<ToolCategory>('marketing');
  const [kind, setKind] = useState<Template['kind']>('promo');

  function add() {
    if (!title.trim()) return;
    start(async () => {
      await createTemplateAction({
        title: title.trim(),
        body: body.trim() || 'Текст шаблона',
        category,
        kind,
        businessTypes: [],
      });
      setTitle('');
      setBody('');
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteTemplateAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-semibold text-ink">Добавить шаблон</h3>
        <TextInput label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Текст</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Категория</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ToolCategory)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
            >
              {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Тип</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Template['kind'])}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
            >
              {(Object.keys(TEMPLATE_KIND_LABELS) as Template['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {TEMPLATE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button onClick={add} disabled={pending || !title.trim()}>
          Добавить
        </Button>
      </Card>

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">{t.title}</p>
                <Badge tone="muted">{TEMPLATE_KIND_LABELS[t.kind]}</Badge>
                <Badge tone="muted">{CATEGORY_LABELS[t.category]}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-ink-soft">{t.body}</p>
            </div>
            <button
              onClick={() => remove(t.id)}
              disabled={pending}
              className="shrink-0 text-xs text-danger hover:underline"
            >
              Удалить
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
