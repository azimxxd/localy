'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, Card, btnClass } from '@/components/ui/kit';

export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mx-auto max-w-xl py-12"><Card className="text-center"><p className="ascii-kicker">Ошибка загрузки</p><h1 className="mt-2 text-2xl font-semibold">Не удалось открыть этот раздел</h1><p className="mt-2 text-sm text-ink-soft">Попробуйте загрузить данные ещё раз. Если ошибка повторится, сообщите код {error.digest ?? 'без кода'}.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Button onClick={() => unstable_retry()}>Попробовать снова</Button><Link href="/dashboard" className={btnClass('secondary')}>Вернуться в обзор</Link></div></Card></div>;
}
