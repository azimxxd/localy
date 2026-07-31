'use client';

/**
 * Кнопка запуска акции.
 *
 * Вызывающие: src/app/(app)/dashboard/promos/[id]/page.tsx.
 * launchPromo переводит акцию в active и рассылает событие sent согласившимся
 * клиентам. Воронка дальше наполняется рассылкой (simulateSend).
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { launchPromo } from '@/app/(app)/dashboard/promos/actions';
import { Button } from '@/components/ui/kit';

export default function LaunchButton({ promoId }: { promoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      onClick={() =>
        start(async () => {
          await launchPromo(promoId);
          router.refresh();
        })
      }
      disabled={pending}
    >
      {pending ? 'Запускаем…' : 'Запустить акцию'}
    </Button>
  );
}
