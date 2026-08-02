'use client';

/**
 * Сброс демо-данных перед показом.
 *
 * Вызывающие: src/app/(app)/admin/page.tsx — отдельным блоком под шапкой.
 * Держим наверху и с якорем #demo-reset: на презентации кнопку ищут за
 * секунды, а не листая справочники платформы.
 */

import { useState, useTransition } from 'react';
import { resetDemoAction } from '@/app/(app)/admin/actions';
import { Button, Card } from '@/components/ui/kit';

export default function AdminDemoReset() {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function reset() {
    setMessage(null);
    startTransition(async () => {
      try {
        await resetDemoAction();
        setConfirm(false);
        setMessage('Демо-данные восстановлены. Можно начинать показ.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Сброс не выполнен');
      }
    });
  }

  return (
    <section id="demo-reset" className="scroll-mt-4">
    <Card className="border-danger">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ascii-kicker text-danger">Перед показом</p>
          <h2 className="mt-1 font-semibold text-danger">Сброс демо-данных</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Вернёт согласованный seed: бизнесы, клиентов, покупки, бонусы, акции, рассылки, тарифы и
            пользователей. Всё, что наделали на репетиции, исчезнет.
          </p>
        </div>
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Отмена
            </Button>
            <Button variant="danger" disabled={pending} onClick={reset}>
              {pending ? 'Сбрасываем…' : 'Да, сбросить'}
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Сбросить демо
          </Button>
        )}
      </div>
      {message ? (
        <p role="status" className="mt-3 border border-line px-3 py-2 text-sm text-ink">
          {message}
        </p>
      ) : null}
    </Card>
    </section>
  );
}
