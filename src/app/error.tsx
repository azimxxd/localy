'use client';

/**
 * Общая граница ошибок для публичных экранов: главная, /b/[slug], /join, /me,
 * /pos, /login, /onboarding, /discover.
 *
 * У кабинета своя граница — src/app/(app)/error.tsx. Без этой на показе
 * вылезал системный экран Next «This page couldn't load».
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, Card, btnClass } from '@/components/ui/kit';

export default function PublicError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="text-center">
        <p className="ascii-kicker">Ошибка загрузки</p>
        <h1 className="mt-2 text-2xl font-semibold">Страница не открылась</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Попробуйте ещё раз. Если повторится, сообщите код {error.digest ?? 'без кода'}.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => unstable_retry()}>Попробовать снова</Button>
          <Link href="/" className={btnClass('secondary')}>На главную</Link>
        </div>
      </Card>
    </div>
  );
}
