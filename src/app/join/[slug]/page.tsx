import { notFound } from 'next/navigation';
import JoinForm from '@/components/join/JoinForm';
import { Badge, Card } from '@/components/ui/kit';
import { num } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function JoinBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = await getRepo();
  const business = await repo.getBusinessBySlug(slug);
  if (!business || business.active === false) notFound();
  await repo.incrementBusinessQrStat(business.id, 'scan');
  const [loyalty, promos] = await Promise.all([
    repo.getLoyaltyConfig(business.id),
    repo.listPromos(business.id),
  ]);
  const activePromo = promos.find((promo) => promo.status === 'active' && (!promo.placements || promo.placements.includes('qr_landing')));

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <header className="border px-5 py-8 text-center" style={{ borderColor: business.brandColor }}>
          <p className="ascii-kicker">+-- JOIN / LOCALY --+</p>
          <pre aria-hidden className="my-4 text-sm leading-tight text-brand">{'  [ QR ]\n  /____\\\n  | +  |\n  \\____/'}</pre>
          <h1 className="mt-2 text-3xl font-bold uppercase text-ink">{business.name}</h1>
          <p className="mt-1 text-ink-soft">&gt; {business.city}</p>
        </header>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold text-ink">Стартовый бонус</h2><p className="mt-1 text-sm text-ink-soft">Один аккаунт и один QR для всех заведений Localy.</p></div>
            <Badge tone="success">+{num(loyalty.startBonus ?? 0)}</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{Math.round(loyalty.pointsPerCurrency * 100)}% с покупки вернётся бонусами. Награда: «{loyalty.rewardTitle}».</p>
        </Card>
        {activePromo ? <Card className="border-brand/30"><Badge tone="brand">Доступная акция</Badge><p className="mt-2 font-semibold text-ink">{activePromo.title}</p><p className="mt-1 text-sm text-ink-soft">Промокод появится в вашем кабинете после регистрации.</p></Card> : null}
        <Card><h2 className="mb-3 text-lg font-semibold text-ink">Присоединиться</h2><JoinForm slug={slug} /></Card>
        <p className="text-center text-xs text-ink-soft">Localy хранит бонусы каждого бизнеса отдельно. {business.name} не увидит ваши покупки в других заведениях.</p>
      </div>
    </main>
  );
}
