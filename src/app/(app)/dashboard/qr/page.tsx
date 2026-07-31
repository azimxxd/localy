import { headers } from 'next/headers';
import BusinessQrCard from '@/components/qr/BusinessQrCard';
import { Stat } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { num, percent } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function BusinessQrPage() {
  await requireSession(['owner', 'admin', 'manager']);
  const business = await getActiveBusiness();
  const stats = await (await getRepo()).getBusinessQrStats(business.id);
  const host = (await headers()).get('host') ?? '127.0.0.1:3000';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${host}`;
  const value = `${baseUrl}/join/${business.slug}`;
  const conversion = stats.scans > 0 ? stats.registrations / stats.scans : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><h1 className="text-2xl font-bold text-ink">QR-код бизнеса</h1><p className="text-sm text-ink-soft">Приводит нового клиента на регистрацию. Универсальный QR клиента появится после вступления.</p></header>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <BusinessQrCard value={value} businessName={business.name} color={business.brandColor} />
        <div className="space-y-3"><Stat label="Сканирований" value={num(stats.scans)} sub="Открытий страницы регистрации" /><Stat label="Регистраций" value={num(stats.registrations)} sub="Новых участников программы" /><Stat label="Конверсия QR" value={percent(conversion)} sub="От сканирования до регистрации" /><div className="rounded-card border border-line bg-surface p-4 text-sm text-ink-soft"><p className="font-semibold text-ink">Где разместить</p><ul className="mt-2 list-disc space-y-1 pl-5"><li>на кассе и столах;</li><li>на двери и упаковке;</li><li>в Instagram и рекламных материалах;</li><li>на чеке после покупки.</li></ul></div></div>
      </div>
    </div>
  );
}
