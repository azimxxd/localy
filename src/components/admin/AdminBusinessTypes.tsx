'use client';

import { useState, useTransition } from 'react';
import { updateBusinessTypeAction } from '@/app/(app)/admin/actions';
import { Button, TextInput } from '@/components/ui/kit';
import type { BusinessType } from '@/lib/types';

type EditableType = Pick<
  BusinessType,
  'title' | 'icon' | 'defaultRepeatVisitDays' | 'activityThresholds'
>;

export default function AdminBusinessTypes({ types }: { types: BusinessType[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save(type: BusinessType, patch: EditableType) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateBusinessTypeAction(type.id, patch);
        setMessage('Категория и правила активности обновлены');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Ошибка');
      }
    });
  }

  return (
    <div className="space-y-3">
      {types.map((type) => (
        <TypeRow key={type.id} type={type} pending={pending} save={(patch) => save(type, patch)} />
      ))}
      {message ? <p role="status" className="text-xs text-brand">{message}</p> : null}
    </div>
  );
}

function TypeRow({ type, pending, save }: { type: BusinessType; pending: boolean; save: (patch: EditableType) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(type.title);
  const [icon, setIcon] = useState(type.icon);
  const [cycle, setCycle] = useState(String(type.defaultRepeatVisitDays));
  const [declining, setDeclining] = useState(String(type.activityThresholds.declining));
  const [risk, setRisk] = useState(String(type.activityThresholds.atRisk));
  const [lapsed, setLapsed] = useState(String(type.activityThresholds.lapsed));

  return (
    <div className="border-b border-line pb-3">
      {editing ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput aria-label="Название категории" value={title} onChange={(event) => setTitle(event.target.value)} />
            <TextInput aria-label="Код иконки" value={icon} onChange={(event) => setIcon(event.target.value)} />
          </div>
          <p className="text-xs text-ink-soft">Если истории клиента мало, статусы считаются от цикла ниши. Пороги — множители этого цикла.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TextInput label="Цикл, дней" type="number" value={cycle} onChange={(event) => setCycle(event.target.value)} />
            <TextInput label="Снижение ×" type="number" step="0.1" value={declining} onChange={(event) => setDeclining(event.target.value)} />
            <TextInput label="Риск ×" type="number" step="0.1" value={risk} onChange={(event) => setRisk(event.target.value)} />
            <TextInput label="Ушёл ×" type="number" step="0.1" value={lapsed} onChange={(event) => setLapsed(event.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() => {
                save({
                  title,
                  icon,
                  defaultRepeatVisitDays: Number(cycle),
                  activityThresholds: { declining: Number(declining), atRisk: Number(risk), lapsed: Number(lapsed) },
                });
                setEditing(false);
              }}
            >
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            {type.title}
            <small className="ml-2 text-ink-soft">
              {type.code} · цикл {type.defaultRepeatVisitDays} дн. · {type.activityThresholds.declining}/{type.activityThresholds.atRisk}/{type.activityThresholds.lapsed}×
            </small>
          </span>
          <Button variant="ghost" onClick={() => setEditing(true)}>Изменить</Button>
        </div>
      )}
    </div>
  );
}
