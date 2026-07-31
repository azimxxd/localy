'use client';

/**
 * Админка: CRUD инструментов каталога.
 *
 * Вызывающие: src/app/(app)/admin/page.tsx.
 * Категории и типы приходят пропсами — админ добавляет и удаляет инструменты,
 * серверный список пересобирается через revalidatePath + router.refresh.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createToolAction, deleteToolAction } from '@/app/(app)/admin/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import ToolIcon from '@/components/ui/ToolIcon';
import { CATEGORY_LABELS, TOOL_KIND_LABELS } from '@/lib/tool-labels';
import type { Tool, ToolCategory, ToolKind } from '@/lib/types';

export default function AdminTools({ tools }: { tools: Tool[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ToolCategory>('retention');
  const [kind, setKind] = useState<ToolKind>('module');
  const [impact, setImpact] = useState(3);

  function add() {
    if (!title.trim()) return;
    start(async () => {
      await createToolAction({
        title: title.trim(),
        description: description.trim() || 'Без описания',
        category,
        kind,
        forTypes: [],
        impact,
        icon: '🧩',
      });
      setTitle('');
      setDescription('');
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteToolAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-semibold text-ink">Добавить инструмент</h3>
        <TextInput label="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextInput
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
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
              onChange={(e) => setKind(e.target.value as ToolKind)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
            >
              {(Object.keys(TOOL_KIND_LABELS) as ToolKind[]).map((k) => (
                <option key={k} value={k}>
                  {TOOL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            label="Эффект 1–5"
            inputMode="numeric"
            value={String(impact)}
            onChange={(e) => setImpact(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
        <Button onClick={add} disabled={pending || !title.trim()}>
          Добавить
        </Button>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-ink-soft">
                <th className="px-4 py-3 font-medium">Инструмент</th>
                <th className="px-4 py-3 font-medium">Категория</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                        <ToolIcon name={t.icon} size={15} />
                      </span>
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="muted">{CATEGORY_LABELS[t.category]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{TOOL_KIND_LABELS[t.kind]}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(t.id)}
                      disabled={pending}
                      className="text-xs text-danger hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
