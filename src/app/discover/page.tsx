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
  const published = (await Promise.all(businesses.map(async (business) => ({ business, site: await repo.getSiteConfig(business.id) })))).filter(({ business, site }) => business.active !== false && site?.published).map(({ business }) => business);
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
        {published.map((b) => (
          <Link key={b.id} href={`/b/${b.slug}`}>
            <Card className="flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center text-2xl font-semibold" style={{ backgroundColor: `${b.brandColor}18`, color: b.brandColor, border: `1px solid ${b.brandColor}55` }}>{b.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-ink">{b.name}</p><p className="text-sm text-ink-soft">{b.city}</p></div>
              <Badge tone="muted">{typeTitle(b.typeCode)}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
