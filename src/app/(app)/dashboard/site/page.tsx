import Link from 'next/link';
import SiteEditor from '@/components/site/SiteEditor';
import { btnClass } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';

export default async function SiteBuilderPage() {
  await requireSession(['owner', 'admin']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [stored, templates, loyalty] = await Promise.all([
    repo.getSiteConfig(business.id),
    repo.listTemplates(business.typeCode),
    repo.getLoyaltyConfig(business.id),
  ]);
  const initial = stored ?? {
    businessId: business.id,
    templateId: `tpl_site_${business.typeCode}`,
    sections: [],
    published: false,
    catalog: [],
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div><p className="ascii-kicker">Конструктор сайта</p><h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">Сайт бизнеса</h1><p className="mt-1 text-sm text-ink-soft">Сначала настройте основу. Каталог и контакты можно раскрыть ниже.</p></div>
        <Link href={`/b/${business.slug}`} target="_blank" className={btnClass('secondary')}>Открыть опубликованный сайт ↗</Link>
      </header>
      <SiteEditor businessId={business.id} businessName={business.name} businessCity={business.city} loyalty={loyalty} initial={initial} templates={templates} />
    </div>
  );
}
