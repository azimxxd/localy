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
import PublicBookingForm from '@/components/site/PublicBookingForm';
import PublicLeadForm from '@/components/site/PublicLeadForm';

const TEMPLATE_ART: Record<string, string> = {
  tpl_site_coffee: '   ( (\n    ) )\n  ........\n  |      |]\n  \\      /\n    ----',
  tpl_site_barber: '   /\\ /\\\n  (  X  )\n   \\/ \\/',
  tpl_site_beauty: '    .-*-.\n  /  |  \\\n *---+---*\n  \\  |  /\n    -*-',
  tpl_site_flower: '    .-.\n   (   )\n     |\n   \\ | /\n    \\|/',
  tpl_site_retail: ' +---------+\n |  [___]  |\n +---------+',
  tpl_site_repair: ' ---[====]---\n      ||\n     /__\\',
};

export default async function BusinessSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) notFound();

  const [loyalty, promos, site, branches] = await Promise.all([
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
    repo.getSiteConfig(business.id),
    repo.listBranches(business.id),
  ]);

  const activePromos = promos.filter((p) => p.status === 'active' && (!p.placements || p.placements.includes('site')));
  const sections = (site?.sections ?? []).filter((s) => s.enabled);
  if (site && !site.published) notFound();
  const catalog = (site?.catalog ?? []).filter((item) => item.active);
  const bookingEnabled = sections.some((section) => section.kind === 'booking');
  const leadEnabled = sections.some((section) => section.kind === 'lead');
  const services = [...new Set([...(catalog.map((item) => item.title)), ...(business.offerings ?? [])])].slice(0, 12);
  const templateArt = TEMPLATE_ART[site?.templateId ?? ''] ?? '   /\\\n  /  \\\n /____\\\n | [] |\n_|____|_';
  const primaryCta = bookingEnabled
    ? { href: '#booking', label: 'Записаться' }
    : business.typeCode === 'flower'
      ? { href: '#catalog', label: 'Выбрать букет' }
      : business.typeCode === 'retail'
        ? { href: '#catalog', label: 'Открыть каталог' }
        : { href: `/join/${business.slug}`, label: 'Получить бонусную карту' };
  return (
    <div className="min-h-dvh bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl border border-line bg-surface">
      <div className="border-b border-brand bg-cover bg-center px-5 py-14 text-center" style={site?.coverUrl ? { backgroundImage: `linear-gradient(rgba(8,12,5,.84),rgba(8,12,5,.94)),url(${site.coverUrl})` } : undefined}>
        <p className="ascii-kicker">Локальный бизнес</p>
        {site?.logoUrl ? <div aria-label="Логотип" className="mx-auto my-5 h-24 w-24 border border-brand bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${site.logoUrl})` }} /> : <pre aria-hidden className="my-5 whitespace-pre text-sm leading-tight text-brand">{templateArt}</pre>}
        <h1 className="text-3xl font-bold uppercase text-brand md:text-4xl">{business.name}</h1>
        <p className="mt-2 text-ink-soft">{business.city}</p>
        {site?.description ? <p className="mx-auto mt-3 max-w-xl text-sm text-ink-soft">{site.description}</p> : null}
        <Link
          href={primaryCta.href}
          className="mt-6 inline-block border border-brand bg-brand px-6 py-3 font-semibold uppercase text-canvas hover:bg-transparent hover:text-brand"
        >
          {primaryCta.label}
        </Link>
        {primaryCta.href !== `/join/${business.slug}` ? <Link href={`/join/${business.slug}`} className="ml-2 mt-3 inline-block px-3 py-2 text-xs text-brand hover:underline">[ Бонусная карта ]</Link> : null}
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-5 py-8">
        <Card>
          <h2 className="font-semibold text-ink">Бонусная программа</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {Math.round(loyalty.pointsPerCurrency * 100)}% бонусами с каждой покупки. Накопите{' '}
            {num(loyalty.rewardThreshold)} — получите «{loyalty.rewardTitle}».
          </p>
        </Card>

        {catalog.length > 0 ? (
          <section id="catalog" className="scroll-mt-4 space-y-2">
            <h2 className="font-semibold uppercase text-brand">{business.typeCode === 'coffee' ? 'Меню' : 'Каталог'}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.map((item) => (
                <Card key={item.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 gap-3">{item.imageUrl ? <div role="img" aria-label={item.title} className="h-12 w-12 shrink-0 border border-line bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} /> : null}<div><p className="font-medium text-ink">{item.title}</p><p className="text-xs uppercase text-brand">{item.category}</p>{item.description ? <p className="mt-1 text-xs text-ink-soft">{item.description}</p> : null}</div></div>
                  <p className="shrink-0 font-semibold text-ink">{num(item.price)} ₸</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {site?.galleryUrls?.length ? <section className="space-y-2"><h2 className="font-semibold uppercase text-brand">Фото</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{site.galleryUrls.map((url, index) => <div key={`${url.slice(0, 24)}_${index}`} role="img" aria-label={`Фото ${index + 1}`} className="aspect-video border border-line bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />)}</div></section> : null}

        {activePromos.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-semibold uppercase text-brand">Акции сейчас</h2>
            {activePromos.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-2 p-4">
                <div><p className="font-medium text-ink">{p.title}</p>{p.body ? <p className="mt-1 text-xs text-ink-soft">{p.body}</p> : null}<p className="mt-1 text-xs text-brand">Промокод: {p.promocode}</p></div>
                <Badge tone="brand">{PROMO_KIND_LABELS[p.kind]}</Badge>
              </Card>
            ))}
          </section>
        ) : null}

        {sections.filter((section) => section.kind !== 'booking' && section.kind !== 'lead').map((s) => (
          <Card key={s.kind}>
            <h2 className="font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
          </Card>
        ))}

        {branches.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-semibold uppercase text-brand">Где нас найти</h2>
            {branches.map((b) => (
              <Card key={b.id} className="p-4">
                <p className="font-medium text-ink">{b.title}</p>
                <p className="text-sm text-ink-soft">{b.address}</p>
                <p className="text-sm text-ink-soft">{b.phone}</p>
              </Card>
            ))}
          </section>
        ) : null}

        {bookingEnabled ? <section id="booking" className="scroll-mt-4 space-y-2"><h2 className="font-semibold uppercase text-brand">Онлайн-запись</h2><PublicBookingForm slug={business.slug} services={services.length ? services : ['Консультация']} /></section> : null}
        {leadEnabled ? <section className="space-y-2"><h2 className="font-semibold uppercase text-brand">Оставить заявку</h2><PublicLeadForm slug={business.slug} /></section> : null}

        {site?.workHours || site?.phone ? <Card className="text-sm text-ink-soft"><p className="font-semibold text-ink">График и связь</p>{site.workHours ? <p className="mt-1">{site.workHours}</p> : null}{site.phone ? <p>{site.phone}</p> : null}<div className="mt-2 flex flex-wrap gap-3">{site.telegram ? <span>Telegram</span> : null}{site.whatsapp ? <span>WhatsApp</span> : null}{site.instagram ? <span>Instagram</span> : null}</div></Card> : null}

        <div className="pt-4 text-center">
          <Link href="/discover" className={btnClass('ghost')}>
            Другие заведения на Localy →
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
