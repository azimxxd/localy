'use client';

/**
 * Админка: CRUD маркетинговых шаблонов.
 *
 * Вызывающие: src/app/(app)/admin/page.tsx.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from '@/app/(app)/admin/actions';
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
        {templates.map((t) => <TemplateRow key={t.id} template={t} pending={pending} remove={remove} save={(title, body) => start(async () => { await updateTemplateAction(t.id, { title, body }); router.refresh(); })} />)}
      </div>
    </div>
  );
}

function TemplateRow({ template, pending, remove, save }: { template: Template; pending: boolean; remove: (id: string) => void; save: (title: string, body: string) => void }) {
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(template.title); const [body, setBody] = useState(template.body);
  return <Card className="p-4">{editing ? <div className="space-y-2"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /><textarea rows={3} className="w-full border border-line px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} /><div className="flex gap-2"><Button disabled={pending} onClick={() => { save(title, body); setEditing(false); }}>Сохранить</Button><Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button></div></div> : <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-ink">{template.title}</p><Badge tone="muted">{TEMPLATE_KIND_LABELS[template.kind]}</Badge><Badge tone="muted">{CATEGORY_LABELS[template.category]}</Badge></div><p className="mt-1 text-xs text-ink-soft">{template.body}</p></div><div className="flex gap-2"><button onClick={() => setEditing(true)} className="text-xs text-brand">Изменить</button><button onClick={() => remove(template.id)} disabled={pending} className="text-xs text-danger">Удалить</button></div></div>}</Card>;
}
