'use client';

/**
 * Кнопка запуска акции.
 *
 * Вызывающие: src/app/(app)/dashboard/promos/[id]/page.tsx.
 * launchPromo переводит акцию в active и рассылает событие sent согласившимся
 * клиентам. Воронка дальше наполняется рассылкой (simulateSend).
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { launchPromo } from '@/app/(app)/dashboard/promos/actions';
import { Button } from '@/components/ui/kit';

export default function LaunchButton({ promoId }: { promoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await launchPromo(promoId);
              router.refresh();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Не удалось запустить акцию');
            }
          })
        }
        disabled={pending}
      >
        {pending ? 'Запускаем…' : 'Запустить акцию'}
      </Button>
      {error ? <p role="alert" className="mt-2 border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
