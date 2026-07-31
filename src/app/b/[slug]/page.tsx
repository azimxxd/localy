/**
 * Публичный сайт бизнеса.
 *
 * Вызывающие: роутер Next, маршрут /b/[slug]. Публичная страница — то, что
 * предприниматель публикует за минуту без программиста.
 * Секции берём из site_config, лояльность и акции — из данных бизнеса.
 */

import { notFound } from 'next/navigation';
import { Badge, Card, btnClass } from '@/components/ui/kit';
import { num } from '@/lib/format';
import { PROMO_KIND_LABELS } from '@/lib/promo-labels';
import { getRepo } from '@/lib/repo';
import Link from 'next/link';

export default async function BusinessSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business) notFound();

  const [loyalty, promos, site, branches] = await Promise.all([
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
    repo.getSiteConfig(business.id),
    repo.listBranches(business.id),
  ]);

  const activePromos = promos.filter((p) => p.status === 'active');
  const sections = (site?.sections ?? []).filter((s) => s.enabled);

  return (
    <div className="min-h-dvh">
      <div className="px-5 py-16 text-center text-white" style={{ background: business.brandColor }}>
        <h1 className="text-3xl font-bold md:text-4xl">{business.name}</h1>
        <p className="mt-2 opacity-90">{business.city}</p>
        <Link
          href="/me"
          className="mt-6 inline-block rounded-xl bg-white/95 px-6 py-3 font-semibold text-ink hover:bg-white"
        >
          Получить бонусную карту
        </Link>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-5 py-8">
        <Card>
          <h2 className="font-semibold text-ink">Бонусная программа</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {Math.round(loyalty.pointsPerCurrency * 100)}% бонусами с каждой покупки. Накопите{' '}
            {num(loyalty.rewardThreshold)} — получите «{loyalty.rewardTitle}».
          </p>
        </Card>

        {activePromos.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-semibold text-ink">Акции сейчас</h2>
            {activePromos.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-2 p-4">
                <p className="font-medium text-ink">{p.title}</p>
                <Badge tone="brand">{PROMO_KIND_LABELS[p.kind]}</Badge>
              </Card>
            ))}
          </section>
        ) : null}

        {sections.map((s) => (
          <Card key={s.kind}>
            <h2 className="font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
          </Card>
        ))}

        {branches.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-semibold text-ink">Где нас найти</h2>
            {branches.map((b) => (
              <Card key={b.id} className="p-4">
                <p className="font-medium text-ink">{b.title}</p>
                <p className="text-sm text-ink-soft">{b.address}</p>
                <p className="text-sm text-ink-soft">{b.phone}</p>
              </Card>
            ))}
          </section>
        ) : null}

        <div className="pt-4 text-center">
          <Link href="/discover" className={btnClass('ghost')}>
            Другие заведения на Localy →
          </Link>
        </div>
      </div>
    </div>
  );
}
