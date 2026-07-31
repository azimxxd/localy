/**
 * Каталог подключённых заведений.
 *
 * Вызывающие: роутер Next, маршрут /discover.
 * Сетевой эффект: клиент видит все заведения платформы, один QR работает
 * в каждом. Публичная страница.
 */

import Link from 'next/link';
import { Badge, Card } from '@/components/ui/kit';
import { getRepo } from '@/lib/repo';

export default async function DiscoverPage() {
  const repo = await getRepo();
  const [businesses, types] = await Promise.all([
    repo.listBusinesses(),
    repo.listBusinessTypes(),
  ]);
  const typeTitle = (code: string) => types.find((t) => t.code === code)?.title ?? code;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <header className="text-center">
        <Link href="/" className="text-xl font-bold text-brand">
          Localy
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-ink">Заведения на платформе</h1>
        <p className="mt-1 text-sm text-ink-soft">Один QR — бонусы в каждом из них</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => (
          <Link key={b.id} href={`/b/${b.slug}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{b.name}</p>
                <Badge tone="muted">{typeTitle(b.typeCode)}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">{b.city}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
