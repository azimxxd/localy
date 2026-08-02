import { notFound } from 'next/navigation';
import JoinForm from '@/components/join/JoinForm';
import { Card } from '@/components/ui/kit';
import { num } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function JoinBusinessPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { slug } = await params;
  const { ref } = await searchParams;
  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) notFound();
  await repo.incrementBusinessQrStat(business.id, 'scan');
  const [loyalty, promos] = await Promise.all([
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
  ]);
  const activePromo = promos.find((promo) => promo.status === 'active' && (!promo.placements || promo.placements.includes('qr_landing')));
  const referralCode = (ref ?? '').trim().toUpperCase().slice(0, 12);
  const referrer = referralCode ? await repo.findCustomerByReferralCode(referralCode) : null;
  const referrerName = referrer?.name ?? null;

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <header className="border px-5 py-6 text-center" style={{ borderColor: business.brandColor, boxShadow: `inset 0 4px 0 ${business.brandColor}` }}>
          <p className="ascii-kicker">Клуб гостей Localy</p>
          <h1 className="mt-4 text-4xl font-bold uppercase text-ink">{business.name}</h1>
          <p className="mt-1 text-sm uppercase tracking-[.14em] text-ink-soft">{business.city}</p>
        </header>
        <Card className="grid grid-cols-3 gap-2 p-3 text-center">
          <div className="border-r border-line px-1"><p className="tnum text-xl font-bold text-brand">+{num(loyalty.startBonus ?? 0)}</p><p className="text-xs text-ink-soft">на старте</p></div>
          <div className="border-r border-line px-1"><p className="tnum text-xl font-bold text-brand">{Math.round(loyalty.pointsPerCurrency * 100)}%</p><p className="text-xs text-ink-soft">с покупки</p></div>
          <div className="px-1"><p className="text-xl font-bold text-brand">1 QR</p><p className="text-xs text-ink-soft">везде</p></div>
          <p className="col-span-3 border-t border-line pt-2 text-xs text-ink-soft">Награда: «{loyalty.rewardTitle}»</p>
        </Card>
        {activePromo ? <Card className="flex items-center justify-between gap-3 border-brand/30 p-4"><div><p className="text-xs uppercase tracking-wide text-brand">Акция после регистрации</p><p className="font-semibold text-ink">{activePromo.title}</p></div><span className="text-xl text-brand">→</span></Card> : null}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-ink">Присоединиться</h2>
          {referrerName ? <p className="mb-3 border border-brand bg-brand-soft px-3 py-2 text-sm text-ink">Вас пригласил {referrerName}. После первой покупки бонусы получите оба.</p> : null}
          <JoinForm slug={slug} referralCode={referralCode} />
        </Card>
        <p className="text-center text-xs text-ink-soft">Баланс каждого заведения хранится отдельно.</p>
      </div>
    </main>
  );
}
