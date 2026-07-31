'use client';

/**
 * Конструктор акции с симулятором прогноза.
 *
 * Вызывающие: src/app/(app)/dashboard/promos/new/page.tsx.
 * Прогноз (новые клиенты, выручка, ROI) — детерминированный, из движка,
 * пересчитывается на каждое изменение. Текст пишет модель через
 * /api/ai/promo-text с фолбэком на шаблон. Владелец видит цифру до того,
 * как потратил деньги — это ключевое отличие Localy.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPromo, forecast } from '@/app/(app)/dashboard/promos/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { kzt, num } from '@/lib/format';
import { PROMO_KIND_LABELS, PROMO_UNIT, type PromoValueMeaning } from '@/lib/promo-labels';
import type { PromoForecast, PromoKind, SegmentCode } from '@/lib/types';

type Segment = { code: SegmentCode; title: string; count: number };

export default function PromoBuilder({
  businessId,
  segments,
  valueMeaning,
}: {
  businessId: string;
  segments: Segment[];
  valueMeaning: Record<PromoKind, PromoValueMeaning>;
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const [kind, setKind] = useState<PromoKind>('discount');
  const [value, setValue] = useState(10);
  const [segment, setSegment] = useState<SegmentCode>(segments[0]?.code ?? 'at_risk');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [textSource, setTextSource] = useState<'ai' | 'template' | null>(null);
  const [aiPending, setAiPending] = useState(false);

  const [fc, setFc] = useState<PromoForecast | null>(null);
  const [fcPending, startForecast] = useTransition();

  const unit = PROMO_UNIT[valueMeaning[kind]];

  // Симулятор: пересчёт прогноза на каждое изменение параметров.
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const endsAt = new Date(now.getTime() + 14 * 86_400_000);
      startForecast(async () => {
        const result = await forecast({
          businessId,
          kind,
          title: title || PROMO_KIND_LABELS[kind],
          value,
          segment,
          startsAt: now.toISOString(),
          endsAt: endsAt.toISOString(),
        });
        setFc(result);
      });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, kind, value, segment]);

  async function generateText() {
    setAiPending(true);
    try {
      const res = await fetch('/api/ai/promo-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, kind, value, segment }),
      });
      const data = (await res.json()) as {
        title?: string;
        body?: string;
        source?: 'ai' | 'template';
      };
      if (data.title) setTitle(data.title);
      if (data.body) setBody(data.body);
      setTextSource(data.source ?? null);
    } catch {
      setTextSource(null);
    } finally {
      setAiPending(false);
    }
  }

  function save() {
    startSaving(async () => {
      const now = new Date();
      const endsAt = new Date(now.getTime() + 14 * 86_400_000);
      const promo = await createPromo({
        businessId,
        kind,
        title: title || PROMO_KIND_LABELS[kind],
        value,
        segment,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      router.push(`/dashboard/promos/${promo.id}`);
    });
  }

  const segmentCount = segments.find((s) => s.code === segment)?.count ?? 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Card className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Тип акции</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as PromoKind)}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-brand"
          >
            {(Object.keys(PROMO_KIND_LABELS) as PromoKind[]).map((k) => (
              <option key={k} value={k}>
                {PROMO_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <TextInput
          label={`Размер (${unit})`}
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => setValue(Number(e.target.value.replace(/\D/g, '')) || 0)}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Кому</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as SegmentCode)}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-brand"
          >
            {segments.map((s) => (
              <option key={s.code} value={s.code}>
                {s.title} ({s.count})
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">Текст для клиента</label>
            <Button variant="secondary" onClick={generateText} disabled={aiPending}>
              {aiPending ? 'Пишем…' : 'Сгенерировать текст'}
            </Button>
          </div>
          <TextInput
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Описание для клиента"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-brand"
          />
          {textSource ? (
            <p className="mt-1 text-xs text-ink-soft">
              {textSource === 'ai' ? 'Текст написан моделью' : 'Текст по шаблону'}
            </p>
          ) : null}
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить и открыть акцию'}
        </Button>
      </Card>

      <Card className="space-y-4 self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Прогноз</h2>
          {fcPending ? <Badge tone="muted">Считаем…</Badge> : null}
        </div>
        <p className="text-sm text-ink-soft">Аудитория: {num(segmentCount)} клиентов</p>

        {fc ? (
          <div className="space-y-3">
            <Metric label="Придут снова" value={num(fc.expectedReturns)} />
            <Metric label="Новые клиенты" value={num(fc.expectedNewCustomers)} />
            <Metric label="Ожидаемая выручка" value={kzt(fc.expectedRevenue)} accent />
            <Metric label="Затраты" value={kzt(fc.expectedCost)} />
            <div className="rounded-xl bg-brand-soft px-4 py-3 text-center">
              <p className="text-xs text-brand-ink">Окупаемость</p>
              <p className="text-2xl font-bold tnum text-brand-ink">{fc.roi}×</p>
            </div>
            <p className="text-xs text-ink-soft">
              Уходит в минус при скидке выше {fc.breakEvenDiscount}%
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Задайте параметры — прогноз появится здесь.</p>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={`tnum font-semibold ${accent ? 'text-ok' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
