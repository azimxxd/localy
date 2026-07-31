/**
 * Рассылки: список отправленных + конструктор.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/campaigns.
 */

import CampaignBuilder from '@/components/campaigns/CampaignBuilder';
import { Badge, Card, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { SEGMENT_META } from '@/lib/engine';
import { dateShort, num } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { requireSession } from '@/lib/auth';
import { MAX_CAMPAIGNS_PER_MONTH, type NotificationChannel, type SegmentCode } from '@/lib/types';

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push',
};

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ segment?: string }> }) {
  await requireSession(['owner', 'admin', 'marketer']);
  const { segment } = await searchParams;
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [campaigns, segments, promos, profiles] = await Promise.all([
    repo.listCampaigns(business.id),
    repo.listSegments(business.id),
    repo.listPromos(business.id),
    repo.listCustomerProfiles(business.id),
  ]);
  const channels: NotificationChannel[] = ['telegram', 'email', 'sms', 'whatsapp', 'push'];
  const recentByCustomer = Object.fromEntries(await Promise.all(profiles.map(async (profile) => [profile.customer.id, await repo.countRecentCampaigns(business.id, profile.customer.id)] as const)));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="ascii-kicker">~/localy/campaigns</p>
        <h1 className="mt-1 text-2xl font-bold uppercase text-ink">+-- Рассылки --+</h1>
        <p className="mt-1 text-sm text-ink-soft">Выберите аудиторию, проверьте текст и отправьте.</p>
      </header>

      <CampaignBuilder
        businessId={business.id}
        segments={segments
          .filter((s) => s.count > 0)
          .map((s) => ({
            code: s.code,
            title: s.title,
            count: s.count,
            consented: Object.fromEntries(channels.map((channel) => [channel, profiles.filter((profile) => s.customerIds.includes(profile.customer.id) && profile.membership.consentChannels.includes(channel)).length])) as Record<NotificationChannel, number>,
            eligible: Object.fromEntries(channels.map((channel) => [
              channel,
              profiles.filter((profile) => s.customerIds.includes(profile.customer.id) && profile.membership.consentChannels.includes(channel) && (recentByCustomer[profile.customer.id] ?? 0) < MAX_CAMPAIGNS_PER_MONTH).length,
            ])) as Record<NotificationChannel, number>,
          }))}
        promos={promos.map((p) => ({ id: p.id, title: p.title }))}
        initialSegment={segment as SegmentCode | undefined}
      />

      <details className="ascii-details border border-line bg-surface p-4">
        <summary className="text-sm font-semibold uppercase tracking-wide text-ink">История рассылок ({campaigns.length})</summary>
        <section className="mt-4 space-y-2 border-t border-line pt-4">
        {campaigns.length === 0 ? (
          <EmptyState title="Рассылок пока нет" />
        ) : (
          campaigns.map((c) => (
            <Card key={c.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{CHANNEL_LABELS[c.channel] ?? c.channel}</Badge>
                  <span className="text-sm text-ink-soft">
                    {SEGMENT_META[c.audienceSegment].title}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-ink">{c.body}</p>
                {c.sentAt ? <p className="mt-1 text-xs text-ink-soft">{num(c.audienceSize)} получили → {num(c.opened ?? 0)} открыли → {num(c.clicked ?? 0)} перешли → {num(c.visited ?? 0)} вернулись{c.promoId ? ` → ${num(c.redeemed ?? 0)} использовали` : ''}</p> : null}
              </div>
              <div className="shrink-0 text-right text-xs text-ink-soft">
                <p className="tnum text-ink">{num(c.audienceSize)}</p>
                <p>{c.sentAt ? dateShort(c.sentAt) : 'черновик'}</p>
              </div>
            </Card>
          ))
        )}
        </section>
      </details>
    </div>
  );
}
