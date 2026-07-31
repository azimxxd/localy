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

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push',
};

export default async function CampaignsPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();

  const [campaigns, segments, promos] = await Promise.all([
    repo.listCampaigns(business.id),
    repo.listSegments(business.id),
    repo.listPromos(business.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Рассылки</h1>
        <p className="text-sm text-ink-soft">Текст пишет ИИ, отправка симулируется</p>
      </header>

      <CampaignBuilder
        businessId={business.id}
        segments={segments
          .filter((s) => s.count > 0)
          .map((s) => ({ code: s.code, title: s.title, count: s.count }))}
        promos={promos.map((p) => ({ id: p.id, title: p.title }))}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-ink-soft">История</h2>
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
              </div>
              <div className="shrink-0 text-right text-xs text-ink-soft">
                <p className="tnum text-ink">{num(c.audienceSize)}</p>
                <p>{c.sentAt ? dateShort(c.sentAt) : 'черновик'}</p>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
