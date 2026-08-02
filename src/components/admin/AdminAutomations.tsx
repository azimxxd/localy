'use client';

/**
 * Фоновые сценарии: ручной прогон и журнал последних запусков.
 *
 * Вызывающие: src/app/(app)/admin/page.tsx.
 * На стенде планировщика может не быть — кнопка показывает ту же логику,
 * что дергает /api/cron/run по расписанию.
 */

import { useState, useTransition } from 'react';
import { runAutomationsAction } from '@/app/(app)/admin/actions';
import { Badge, Button, Card } from '@/components/ui/kit';
import { dateShort, timeShort } from '@/lib/format';
import type { AutomationKind, AutomationRun } from '@/lib/types';

const KIND_LABELS: Record<AutomationKind, string> = {
  promo_launch: 'Запуск акции',
  promo_finish: 'Завершение акции',
  birthday: 'День рождения',
};

export default function AdminAutomations({ runs }: { runs: AutomationRun[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await runAutomationsAction();
        setMessage(result.length === 0 ? 'Обработчик отработал: делать было нечего' : `Выполнено действий: ${result.length}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Обработчик не отработал');
      }
    });
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ascii-kicker">Автоматизация</p>
          <h2 className="mt-1 font-semibold text-ink">Фоновые сценарии</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Запуск акций по расписанию, закрытие просроченных и поздравления с днём рождения.
            По расписанию это делает POST /api/cron/run с заголовком <code>x-localy-cron-secret</code>.
          </p>
        </div>
        <Button disabled={pending} onClick={run}>{pending ? 'Работаем…' : 'Запустить обработчик'}</Button>
      </div>
      {message ? <p role="status" className="border border-line px-3 py-2 text-sm text-ink">{message}</p> : null}
      {runs.length === 0 ? (
        <p className="text-sm text-ink-soft">Запусков пока не было.</p>
      ) : (
        <ul className="space-y-2 border-t border-line pt-3">
          {runs.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={item.kind === 'birthday' ? 'brand' : 'muted'}>{KIND_LABELS[item.kind]}</Badge>
                <span className="min-w-0 text-ink">{item.detail}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-soft">{dateShort(item.at)}, {timeShort(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
