'use client';

import { useState, useTransition } from 'react';
import { updateRecommendationSettingAction } from '@/app/(app)/admin/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import type { RecommendationRuleSetting } from '@/lib/types';

export default function AdminRecommendationRules({ settings }: { settings: RecommendationRuleSetting[] }) {
  return (
    <details className="ascii-details border border-line bg-surface p-4">
      <summary className="font-semibold uppercase">Правила рекомендаций ({settings.length})</summary>
      <p className="mt-2 text-sm text-ink-soft">Включайте сигналы, меняйте их приоритет и целевое действие.</p>
      <div className="mt-4 grid gap-3 border-t border-line pt-3 md:grid-cols-2">
        {settings.map((setting) => <RuleEditor key={setting.id} setting={setting} />)}
      </div>
    </details>
  );
}

function RuleEditor({ setting }: { setting: RecommendationRuleSetting }) {
  const [actionText, setActionText] = useState(setting.actionText);
  const [priority, setPriority] = useState(String(setting.priority));
  const [active, setActive] = useState(setting.active);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="font-medium text-ink">{setting.label}</h3><p className="text-xs text-ink-soft">{setting.id}</p></div>
        <label className="flex items-center gap-2 text-xs uppercase text-ink-soft"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> активно</label>
      </div>
      <TextInput label="Действие" value={actionText} onChange={(event) => setActionText(event.target.value)} />
      <TextInput label="Приоритет 1–5" inputMode="numeric" value={priority} onChange={(event) => setPriority(event.target.value.replace(/\D/g, '').slice(0, 1))} />
      {message ? <p role="status" className="text-xs text-brand">{message}</p> : null}
      <Button disabled={pending} onClick={() => startTransition(async () => { try { await updateRecommendationSettingAction(setting.id, { actionText, priority: Number(priority), active }); setMessage('Сохранено'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить'); } })}>{pending ? 'Сохраняем…' : 'Сохранить'}</Button>
    </Card>
  );
}
