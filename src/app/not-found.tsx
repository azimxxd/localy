/**
 * 404 для всего приложения: неверный slug бизнеса, удалённый инструмент,
 * опечатка в адресе. Системная страница Next выглядела чужой на показе.
 */

import Link from 'next/link';
import { Card, btnClass } from '@/components/ui/kit';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card className="text-center">
        <p className="ascii-kicker">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Такой страницы нет</h1>
        <p className="mt-2 text-sm text-ink-soft">Возможно, бизнес сменил адрес или ссылка устарела.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className={btnClass('primary')}>На главную</Link>
          <Link href="/discover" className={btnClass('secondary')}>Каталог заведений</Link>
        </div>
      </Card>
    </div>
  );
}
