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
import { accessibleBrandColor, brandOnDarkColor, contrastTextColor } from '@/lib/site-theme';
import type { CSSProperties } from 'react';

const TEMPLATE_ART: Record<string, string> = {
  tpl_site_coffee: '   ( (\n    ) )\n  ........\n  |      |]\n  \\      /\n    ----',
  tpl_site_barber: '   /\\ /\\\n  (  X  )\n   \\/ \\/',
  tpl_site_beauty: '    .-*-.\n  /  |  \\\n *---+---*\n  \\  |  /\n    -*-',
  tpl_site_flower: '    .-.\n   (   )\n     |\n   \\ | /\n    \\|/',
  tpl_site_retail: ' +---------+\n |  [___]  |\n +---------+',
  tpl_site_repair: ' ---[====]---\n      ||\n     /__\\',
};

const SITE_FONT_CLASS = {
  clean: '[font-family:Inter,ui-sans-serif,system-ui,sans-serif]',
  editorial: 'font-display',
  friendly: 'font-sans',
} as const;

function socialMeta(token: string): { label: string; href: string | null } {
  const trimmed = token.trim();
  const lower = trimmed.toLowerCase();
  const known = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'telegram', label: 'Telegram' },
    { key: 'tiktok', label: 'TikTok' },
    { key: '2gis', label: '2GIS' },
  ].find(({ key }) => lower.includes(key));
  const label = known?.label ?? trimmed.split(':')[0].trim();
  const value = known ? trimmed.replace(new RegExp(`^${known.key}\\s*[:—-]?\\s*`, 'i'), '').trim() : trimmed;
  if (/^https:\/\//i.test(value)) return { label, href: value };
  if (!known || value.toLowerCase() === known.key || value === label) return { label, href: null };
  if (known.key === 'whatsapp') {
    const digits = value.replace(/\D/g, '');
    return { label, href: digits.length >= 10 ? `https://wa.me/${digits}` : null };
  }
  if (known.key === '2gis') return { label, href: null };
  const handle = value.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  if (!/^[\w.]{2,64}$/.test(handle)) return { label, href: null };
  if (known.key === 'telegram') return { label, href: `https://t.me/${handle}` };
  if (known.key === 'tiktok') return { label, href: `https://tiktok.com/@${handle}` };
  return { label, href: `https://instagram.com/${handle}` };
}

function SocialContact({ token }: { token: string }) {
  const { label, href } = socialMeta(token);
  return href ? <a href={href} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-4">{label}</a> : <span>{label}</span>;
}

export default async function BusinessSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) notFound();

  const [loyalty, promos, site, branches, slots] = await Promise.all([
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
    repo.getSiteConfig(business.id),
    repo.listBranches(business.id),
    repo.listBookingSlots(business.id),
  ]);

  if (!site?.published) notFound();
  const activePromos = promos.filter((p) => p.status === 'active' && (!p.placements || p.placements.includes('site')));
  const sections = site.sections.filter((s) => s.enabled);
  const catalog = (site.catalog ?? []).filter((item) => item.active);
  const bookingEnabled = sections.some((section) => section.kind === 'booking');
  const leadEnabled = sections.some((section) => section.kind === 'lead');
  const services = [...new Set([...(catalog.map((item) => item.title)), ...(business.offerings ?? [])])].slice(0, 12);
  const socialTokens = site.socials?.length
    ? site.socials
    : [site.instagram && `Instagram: ${site.instagram}`, site.whatsapp && `WhatsApp: ${site.whatsapp}`, site.telegram && `Telegram: ${site.telegram}`].filter((value): value is string => Boolean(value));
  const templateArt = TEMPLATE_ART[site.templateId] ?? '   /\\\n  /  \\\n /____\\\n | [] |\n_|____|_';
  const readableBrand = accessibleBrandColor(site.primaryColor ?? business.brandColor);
  const heroBrand = site.coverUrl ? brandOnDarkColor(site.primaryColor ?? business.brandColor) : readableBrand;
  const catalogTitle = site.catalogTitle ?? sections.find((section) => section.kind === 'services')?.title ?? (business.typeCode === 'coffee' ? 'Меню' : 'Каталог');
  const primaryCta = bookingEnabled
    ? { href: '#booking', label: 'Записаться' }
    : business.typeCode === 'flower'
      ? { href: '#catalog', label: 'Выбрать букет' }
      : business.typeCode === 'retail'
        ? { href: '#catalog', label: 'Открыть каталог' }
        : { href: `/join/${business.slug}`, label: 'Получить бонусную карту' };
  return (
    <div className={`public-site min-h-dvh bg-canvas sm:px-6 sm:py-6 ${SITE_FONT_CLASS[site.fontStyle ?? 'clean']}`} style={{ '--color-brand': readableBrand } as CSSProperties}>
      <div className="mx-auto max-w-3xl bg-surface sm:border sm:border-line">
      <div className="public-hero border-b bg-cover bg-center px-5 py-10 text-center sm:py-14" style={{ ...(site?.coverUrl ? { backgroundImage: `linear-gradient(rgba(8,12,5,.72),rgba(8,12,5,.92)),url(${site.coverUrl})` } : {}), borderColor: site.primaryColor ?? business.brandColor, boxShadow: `inset 0 5px 0 ${site.primaryColor ?? business.brandColor}` }}>
        <p className="ascii-kicker" style={{ color: heroBrand }}>Локальный бизнес</p>
        {site?.logoUrl ? <div aria-label="Логотип" className="mx-auto my-4 h-20 w-20 border bg-contain bg-center bg-no-repeat sm:my-5 sm:h-24 sm:w-24" style={{ backgroundImage: `url(${site.logoUrl})`, borderColor: heroBrand }} /> : <pre aria-hidden className="my-4 whitespace-pre text-sm leading-tight sm:my-5" style={{ color: heroBrand }}>{templateArt}</pre>}
        <h1 className="text-4xl font-bold uppercase md:text-5xl" style={{ color: heroBrand }}>{business.name}</h1>
        <p className={`mt-1 text-sm uppercase tracking-[.16em] ${site.coverUrl ? 'text-[#eee7da]' : 'text-ink-soft'}`}>{business.city}</p>
        {site?.description ? <p className={`mobile-clamp mx-auto mt-3 max-w-xl text-sm ${site.coverUrl ? 'text-[#eee7da]' : 'text-ink-soft'}`}>{site.description}</p> : null}
        <Link
          href={primaryCta.href}
          className="mt-6 inline-flex min-h-12 w-full max-w-sm items-center justify-center border px-6 py-3 font-semibold uppercase sm:w-auto"
          style={{ backgroundColor: site.primaryColor ?? business.brandColor, borderColor: site.primaryColor ?? business.brandColor, color: contrastTextColor(site.primaryColor ?? business.brandColor) }}
        >
          {primaryCta.label}
        </Link>
        {primaryCta.href !== `/join/${business.slug}` ? <Link href={`/join/${business.slug}`} className="mt-3 block px-3 py-2 text-xs font-semibold uppercase tracking-wide sm:ml-2 sm:inline-block" style={{ color: heroBrand }}>Бонусная карта →</Link> : null}
      </div>

      <nav className="public-jump-nav sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-line bg-surface/95 px-4 py-3 text-sm font-semibold backdrop-blur">
        {catalog.length ? <a href="#catalog">{catalogTitle}</a> : null}
        {activePromos.length ? <a href="#promos">Акции</a> : null}
        {bookingEnabled ? <a href="#booking">Запись</a> : null}
        {leadEnabled ? <a href="#lead">Заявка</a> : null}
        {branches.length ? <a href="#contacts">Адрес</a> : null}
      </nav>

      <div className="mx-auto max-w-2xl space-y-7 px-4 pb-28 pt-6 sm:px-5 sm:py-8">
        <Card className="public-loyalty flex items-center gap-4 p-4">
          <div className="tnum flex h-16 w-16 shrink-0 items-center justify-center border border-brand bg-brand-soft text-xl font-bold text-brand">{Math.round(loyalty.pointsPerCurrency * 100)}%</div>
          <div><h2 className="font-semibold text-ink">Бонусы с каждой покупки</h2><p className="mt-0.5 text-sm text-ink-soft">Награда «{loyalty.rewardTitle}» после {num(loyalty.rewardThreshold)} бонусов.</p></div>
        </Card>

        {catalog.length > 0 ? (
          <section id="catalog" className="scroll-mt-4 space-y-2">
            <h2 className="font-semibold uppercase text-brand">{catalogTitle}</h2>
            <div className="public-card-rail grid gap-2 sm:grid-cols-2">
              {catalog.map((item) => (
                <Card key={item.id} className="flex min-h-28 items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 gap-3">{item.imageUrl ? <div role="img" aria-label={item.title} className="h-12 w-12 shrink-0 border border-line bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} /> : null}<div><p className="font-medium text-ink">{item.title}</p><p className="text-xs uppercase text-brand">{item.category}</p>{item.description ? <p className="mt-1 text-xs text-ink-soft">{item.description}</p> : null}</div></div>
                  <p className="shrink-0 font-semibold text-ink">{num(item.price)} ₸</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {site?.galleryUrls?.length ? <section className="space-y-2"><h2 className="font-semibold uppercase text-brand">Фото</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{site.galleryUrls.map((url, index) => <div key={`${url.slice(0, 24)}_${index}`} role="img" aria-label={`Фото ${index + 1}`} className="aspect-video border border-line bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />)}</div></section> : null}

        {activePromos.length > 0 ? (
          <section id="promos" className="scroll-mt-16 space-y-2">
            <h2 className="font-semibold uppercase text-brand">Акции сейчас</h2>
            <div className="public-card-rail grid gap-2 sm:grid-cols-1">{activePromos.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-2 p-4">
                <div><p className="font-medium text-ink">{p.title}</p>{p.body ? <p className="mobile-clamp mt-1 text-xs text-ink-soft">{p.body}</p> : null}<p className="mt-2 text-xs font-semibold uppercase tracking-wide text-brand">Код: {p.promocode}</p></div>
                <Badge tone="brand">{PROMO_KIND_LABELS[p.kind]}</Badge>
              </Card>
            ))}</div>
          </section>
        ) : null}

        <div className="public-card-rail grid gap-2 sm:grid-cols-1">{sections.filter((section) => !['hero', 'services', 'promos', 'loyalty', 'contacts', 'booking', 'lead'].includes(section.kind)).map((s) => (
          <Card key={s.kind} className="min-h-32">
            <h2 className="font-semibold text-ink">{s.title}</h2>
            <p className="mobile-clamp mt-1 text-sm text-ink-soft">{s.body}</p>
          </Card>
        ))}</div>

        {branches.length > 0 ? (
          <section id="contacts" className="scroll-mt-16 space-y-2">
            <h2 className="font-semibold uppercase text-brand">Где нас найти</h2>
            <div className="public-card-rail grid gap-2 sm:grid-cols-1">{branches.map((b) => (
              <Card key={b.id} className="p-4">
                <p className="font-medium text-ink">{b.title}</p>
                <p className="text-sm text-ink-soft">{b.address}</p>
                <p className="text-sm text-ink-soft">{b.phone}</p>
              </Card>
            ))}</div>
          </section>
        ) : null}

        {bookingEnabled ? <section id="booking" className="scroll-mt-4 space-y-2"><h2 className="font-semibold uppercase text-brand">Онлайн-запись</h2><PublicBookingForm slug={business.slug} services={services.length ? services : ['Консультация']} slots={slots.filter((slot) => slot.taken < slot.capacity).slice(0, 60).map((slot) => ({ at: slot.at, free: slot.capacity - slot.taken }))} /></section> : null}
        {leadEnabled ? <section id="lead" className="scroll-mt-16 space-y-2"><h2 className="font-semibold uppercase text-brand">Оставить заявку</h2><PublicLeadForm slug={business.slug} /></section> : null}

        {site?.workHours || site?.phone || socialTokens.length ? <Card className="text-sm text-ink-soft"><p className="font-semibold text-ink">График и связь</p>{site.workHours ? <p className="mt-1">{site.workHours}</p> : null}{site.phone ? <p>{site.phone}</p> : null}<div className="mt-2 flex flex-wrap gap-3">{socialTokens.map((token, index) => <SocialContact key={`${token}_${index}`} token={token} />)}</div></Card> : null}

        <div className="pt-4 text-center">
          <Link href="/discover" className={btnClass('ghost')}>
            Другие заведения на Localy →
          </Link>
        </div>
      </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-line bg-surface/95 px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden"><a href={primaryCta.href} className="flex min-h-11 items-center justify-center bg-brand px-3 text-center text-sm font-semibold uppercase text-canvas">{primaryCta.label}</a><Link href={`/join/${business.slug}`} className="flex min-h-11 items-center justify-center border border-line px-3 text-center text-sm font-semibold text-ink">Бонусная карта</Link></div>
    </div>
  );
}
