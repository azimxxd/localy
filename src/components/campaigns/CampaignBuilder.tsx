'use client';

/**
 * Конструктор рассылки.
 *
 * Вызывающие: src/app/(app)/dashboard/campaigns/page.tsx.
 * Текст пишет модель через /api/ai/campaign-text (фолбэк на шаблон).
 * Плейсхолдер {name} подставляется при отправке — не по вызову модели на
 * каждого. Антиспам: клиент получает не больше MAX_CAMPAIGNS_PER_MONTH в месяц.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { sendCampaign } from '@/app/(app)/dashboard/campaigns/actions';
import { Badge, Button, Card } from '@/components/ui/kit';
import { num } from '@/lib/format';
import { MAX_CAMPAIGNS_PER_MONTH, type NotificationChannel, type SegmentCode } from '@/lib/types';

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  telegram: 'Telegram',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push',
};

type Segment = { code: SegmentCode; title: string; count: number };
type PromoOption = { id: string; title: string };

export default function CampaignBuilder({
  businessId,
  segments,
  promos,
}: {
  businessId: string;
  segments: Segment[];
  promos: PromoOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [segment, setSegment] = useState<SegmentCode>(segments[0]?.code ?? 'at_risk');
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [promoId, setPromoId] = useState<string>('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState<'ai' | 'template' | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const audience = segments.find((s) => s.code === segment)?.count ?? 0;

  async function generate() {
    setAiPending(true);
    try {
      const res = await fetch('/api/ai/campaign-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, segment, channel, promoId: promoId || undefined }),
      });
      const data = (await res.json()) as { body?: string; source?: 'ai' | 'template' };
      if (data.body) setBody(data.body);
      setSource(data.source ?? null);
    } catch {
      setSource(null);
    } finally {
      setAiPending(false);
    }
  }

  function send() {
    start(async () => {
      const sent = await sendCampaign({
        businessId,
        promoId: promoId || null,
        channel,
        audienceSegment: segment,
        body: body || 'Напоминание о заведении',
      });
      setDone(sent.audienceSize);
      setBody('');
      setSource(null);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Новая рассылка</h2>

      {done !== null ? (
        <div className="rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
          Отправлено на {num(done)} клиентов (симуляция). Воронка обновлена.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Кому</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as SegmentCode)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
          >
            {segments.map((s) => (
              <option key={s.code} value={s.code}>
                {s.title} ({s.count})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Канал</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
          >
            {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Привязать акцию (необязательно)</span>
        <select
          value={promoId}
          onChange={(e) => setPromoId(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">Без акции — напоминание</option>
          {promos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Текст</span>
          <Button variant="secondary" onClick={generate} disabled={aiPending}>
            {aiPending ? 'Пишем…' : 'Сгенерировать текст'}
          </Button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="{name}, ..."
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand"
        />
        {source ? (
          <p className="mt-1 text-xs text-ink-soft">
            {source === 'ai' ? 'Текст написан моделью' : 'Текст по шаблону'} · {'{name}'} подставится
            при отправке
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-soft">
          Аудитория {num(audience)} · лимит {MAX_CAMPAIGNS_PER_MONTH}/мес на клиента
        </span>
        <Button onClick={send} disabled={pending || audience === 0}>
          {pending ? 'Отправляем…' : 'Отправить'}
        </Button>
      </div>

      {audience === 0 ? <Badge tone="muted">В сегменте нет получателей</Badge> : null}
    </Card>
  );
}
