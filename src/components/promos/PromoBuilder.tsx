'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createPromo, forecast } from '@/app/(app)/dashboard/promos/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import { kzt, num } from '@/lib/format';
import {
  PROMO_GOAL_DESCRIPTIONS,
  PROMO_GOAL_LABELS,
  PROMO_KIND_LABELS,
  PROMO_PLACEMENT_LABELS,
  PROMO_UNIT,
  type PromoValueMeaning,
} from '@/lib/promo-labels';
import type { Branch, NotificationChannel, PromoForecast, PromoGoal, PromoKind, PromoPlacement, SegmentCode } from '@/lib/types';

type Segment = { code: SegmentCode; title: string; description: string; count: number };
type GoalConfig = {
  audience: 'public' | 'segment';
  kinds: PromoKind[];
  segments: SegmentCode[];
  defaultKind: PromoKind;
  defaultSegment: SegmentCode;
  defaultValue: number;
  placements: PromoPlacement[];
};

const GOAL_ORDER = Object.keys(PROMO_GOAL_LABELS) as PromoGoal[];
const GOAL_CONFIG: Record<PromoGoal, GoalConfig> = {
  new_customers: { audience: 'public', kinds: ['discount', 'coupon', 'gift', 'two_plus_one'], segments: [], defaultKind: 'discount', defaultSegment: 'new', defaultValue: 15, placements: ['site', 'qr_landing', 'cashier'] },
  return_customers: { audience: 'segment', kinds: ['winback', 'return_reward', 'birthday', 'discount', 'gift'], segments: ['at_risk', 'lapsed', 'declining', 'no_booking', 'birthday_soon'], defaultKind: 'winback', defaultSegment: 'at_risk', defaultValue: 15, placements: ['client_app', 'cashier'] },
  increase_frequency: { audience: 'segment', kinds: ['double_points', 'return_reward', 'discount', 'points'], segments: ['returning', 'habit_forming', 'declining', 'regular'], defaultKind: 'double_points', defaultSegment: 'habit_forming', defaultValue: 2, placements: ['client_app', 'cashier'] },
  increase_check: { audience: 'segment', kinds: ['two_plus_one', 'item_promo', 'points', 'gift'], segments: ['regular', 'loyal', 'returning', 'high_check'], defaultKind: 'two_plus_one', defaultSegment: 'regular', defaultValue: 25, placements: ['client_app', 'cashier'] },
  sell_item: { audience: 'segment', kinds: ['item_promo', 'two_plus_one', 'discount', 'gift'], segments: ['item_buyers', 'regular', 'loyal', 'promo_lovers'], defaultKind: 'item_promo', defaultSegment: 'item_buyers', defaultValue: 15, placements: ['site', 'client_app', 'cashier'] },
  activate_points: { audience: 'segment', kinds: ['points', 'double_points', 'gift'], segments: ['expiring_points', 'high_points', 'loyal'], defaultKind: 'points', defaultSegment: 'expiring_points', defaultValue: 500, placements: ['client_app', 'cashier'] },
  referrals: { audience: 'segment', kinds: ['referral'], segments: ['loyal', 'regular', 'promo_lovers'], defaultKind: 'referral', defaultSegment: 'loyal', defaultValue: 500, placements: ['client_app', 'qr_landing', 'cashier'] },
  fill_quiet_time: { audience: 'segment', kinds: ['discount', 'double_points', 'gift', 'coupon'], segments: ['regular', 'loyal', 'returning', 'promo_lovers'], defaultKind: 'discount', defaultSegment: 'regular', defaultValue: 15, placements: ['site', 'client_app', 'cashier'] },
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = { telegram: 'Telegram', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Внутри Localy' };

export default function PromoBuilder({ businessId, segments, valueMeaning, branches, initialGoal = 'return_customers', initialKind, initialSegment }: { businessId: string; segments: Segment[]; valueMeaning: Record<PromoKind, PromoValueMeaning>; branches: Branch[]; initialGoal?: PromoGoal; initialKind?: PromoKind; initialSegment?: SegmentCode }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [fcPending, startForecast] = useTransition();
  const [goal, setGoal] = useState<PromoGoal>(initialGoal);
  const initial = GOAL_CONFIG[initialGoal];
  const resolvedInitialSegment = initialSegment && (initial.audience === 'public' || initial.segments.includes(initialSegment)) ? initialSegment : initial.segments.map((code) => segments.find((item) => item.code === code && item.count > 0)).find(Boolean)?.code ?? initial.defaultSegment;
  const resolvedInitialKind = initialKind && initial.kinds.includes(initialKind) ? initialKind : initial.defaultKind;
  const [kind, setKind] = useState<PromoKind>(resolvedInitialKind);
  const [value, setValue] = useState(initial.defaultValue);
  const [segment, setSegment] = useState<SegmentCode>(resolvedInitialSegment);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [branchId, setBranchId] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [placements, setPlacements] = useState<PromoPlacement[]>(initial.placements);
  const [durationDays, setDurationDays] = useState(14);
  const [textSource, setTextSource] = useState<'ai' | 'template' | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [fc, setFc] = useState<PromoForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = GOAL_CONFIG[goal];
  const unit = PROMO_UNIT[valueMeaning[kind]];
  const availableSegments = useMemo(() => config.segments.map((code) => segments.find((item) => item.code === code)).filter((item): item is Segment => Boolean(item)), [config.segments, segments]);
  const selectedSegment = segments.find((item) => item.code === segment);
  const placementOptions = (config.audience === 'public' ? ['site', 'qr_landing', 'cashier'] : ['client_app', 'site', 'cashier', 'qr_landing']) as PromoPlacement[];
  const audienceReady = config.audience === 'public' || (selectedSegment?.count ?? 0) > 0;

  function changeGoal(nextGoal: PromoGoal) {
    const next = GOAL_CONFIG[nextGoal];
    const firstAvailable = next.segments.map((code) => segments.find((item) => item.code === code && item.count > 0)).find(Boolean);
    setGoal(nextGoal);
    setKind(next.defaultKind);
    setValue(next.defaultValue);
    setSegment(firstAvailable?.code ?? next.defaultSegment);
    setPlacements(next.placements);
    setChannel(next.audience === 'public' ? 'push' : 'telegram');
    setTitle('');
    setBody('');
    setTextSource(null);
    setError(null);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date();
      const input = { businessId, kind, title: title || PROMO_KIND_LABELS[kind], value, segment, goal, branchId: branchId || null, channel, placements, body, startsAt: now.toISOString(), endsAt: new Date(now.getTime() + durationDays * 86_400_000).toISOString() };
      startForecast(async () => {
        try {
          const result = await forecast(input);
          setFc(result.forecast);
          setError(result.error);
        } catch (cause) {
          setFc(null);
          setError(cause instanceof Error ? cause.message : 'Не удалось рассчитать прогноз');
        }
      });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, kind, value, segment, goal, branchId, channel, placements, body, durationDays]);

  async function generateText() {
    setAiPending(true); setError(null);
    try {
      const response = await fetch('/api/ai/promo-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, kind, value, segment, goal }) });
      const data = await response.json() as { title?: string; body?: string; source?: 'ai' | 'template'; error?: string };
      if (!response.ok) throw new Error(data.error || 'Не удалось создать текст');
      if (data.title) setTitle(data.title);
      if (data.body) setBody(data.body);
      setTextSource(data.source ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать текст'); }
    finally { setAiPending(false); }
  }

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        const now = new Date();
        const promo = await createPromo({ businessId, kind, title: title || PROMO_KIND_LABELS[kind], value, segment, goal, branchId: branchId || null, channel, placements, body, startsAt: now.toISOString(), endsAt: new Date(now.getTime() + durationDays * 86_400_000).toISOString() });
        router.push(`/dashboard/promos/${promo.id}`);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить акцию'); }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Card className="space-y-4">
          <p className="ascii-kicker">1 · Цель и аудитория</p>
          <label className="block"><span className="mb-1 block text-sm font-medium">Что хотите изменить?</span><select aria-label="Цель акции" value={goal} onChange={(event) => changeGoal(event.target.value as PromoGoal)} className="w-full border border-line bg-surface px-3.5 py-2.5">{GOAL_ORDER.map((code) => <option key={code} value={code}>{PROMO_GOAL_LABELS[code]}</option>)}</select></label>
          <p className="border-l-2 border-brand px-3 text-sm text-ink-soft">{PROMO_GOAL_DESCRIPTIONS[goal]}</p>
          {config.audience === 'public' ? (
            <div className="border border-brand bg-brand-soft p-4"><p className="font-semibold text-brand-ink">Без выбора CRM-сегмента</p><p className="mt-1 text-sm text-ink-soft">Новых людей ещё нет в базе. Localy оценит публичный охват по сроку и местам показа.</p></div>
          ) : (
            <label className="block"><span className="mb-1 block text-sm font-medium">Кому из текущей базы?</span><select aria-label="Сегмент акции" value={segment} onChange={(event) => setSegment(event.target.value as SegmentCode)} className="w-full border border-line bg-surface px-3.5 py-2.5">{availableSegments.map((item) => <option key={item.code} value={item.code} disabled={item.count === 0}>{item.title} · {item.count}</option>)}</select>{selectedSegment?.count ? <span className="mt-1 block text-xs text-ink-soft">{selectedSegment.description}</span> : <span className="mt-1 block text-xs text-warn">В подходящих сегментах пока нет клиентов.</span>}</label>
          )}
        </Card>

        <Card className="space-y-4">
          <p className="ascii-kicker">2 · Предложение</p>
          <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium">Механика</span><select aria-label="Механика акции" value={kind} onChange={(event) => setKind(event.target.value as PromoKind)} className="w-full border border-line bg-surface px-3.5 py-2.5">{config.kinds.map((code) => <option key={code} value={code}>{PROMO_KIND_LABELS[code]}</option>)}</select></label><TextInput label={`Размер (${unit})`} inputMode="numeric" value={String(value)} onChange={(event) => setValue(Number(event.target.value.replace(/\D/g, '')) || 0)} /></div>
          <div className="grid gap-3 sm:grid-cols-3"><label><span className="mb-1 block text-sm font-medium">Срок</span><select aria-label="Срок акции" className="w-full border border-line px-3 py-2.5" value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))}><option value={7}>7 дней</option><option value={14}>14 дней</option><option value={30}>30 дней</option></select></label><label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Где действует?</span><select aria-label="Филиал акции" className="w-full border border-line px-3 py-2.5" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}</select></label></div>
        </Card>

        <Card className="space-y-4">
          <p className="ascii-kicker">3 · Показ и применение</p>
          <fieldset><legend className="mb-2 text-sm font-medium">Где люди увидят или смогут применить акцию?</legend><div className="grid gap-2 sm:grid-cols-2">{placementOptions.map((code) => <label key={code} className="flex items-start gap-2 border border-line p-3 text-sm"><input type="checkbox" checked={placements.includes(code)} disabled={code === 'cashier'} onChange={(event) => setPlacements((current) => event.target.checked ? [...new Set([...current, code])] : current.filter((item) => item !== code))} /><span>{PROMO_PLACEMENT_LABELS[code]}{code === 'cashier' ? <small className="mt-1 block text-ink-soft">Обязательно для применения и учёта результата.</small> : null}</span></label>)}</div></fieldset>
          {config.audience === 'segment' ? <label className="block"><span className="mb-1 block text-sm font-medium">Канал будущей рассылки</span><select aria-label="Канал акции" value={channel} onChange={(event) => setChannel(event.target.value as NotificationChannel)} className="w-full border border-line px-3 py-2.5">{Object.entries(CHANNEL_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><span className="mt-1 block text-xs text-ink-soft">Канал используется при создании связанной рассылки; сама акция её не отправляет.</span></label> : null}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3"><div><p className="ascii-kicker">4 · Текст</p><p className="mt-1 text-sm text-ink-soft">Это увидит клиент.</p></div><Button variant="secondary" onClick={generateText} disabled={aiPending}>{aiPending ? 'Пишем…' : 'Сгенерировать'}</Button></div>
          <TextInput label="Заголовок" placeholder={PROMO_KIND_LABELS[kind]} value={title} onChange={(event) => setTitle(event.target.value)} />
          <label><span className="mb-1 block text-sm font-medium">Описание и условия</span><textarea placeholder="Кто может воспользоваться и до какого числа" value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="w-full border border-line bg-surface px-3.5 py-2.5" /></label>
          {textSource ? <p className="text-xs text-ink-soft">{textSource === 'ai' ? 'Текст написан моделью' : 'Текст собран по шаблону'}</p> : null}
        </Card>

        {error ? <p role="alert" className="border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p> : null}
        <Button className="w-full" onClick={save} disabled={saving || !fc || !audienceReady || placements.length === 0}>{saving ? 'Сохраняем…' : 'Сохранить черновик акции'}</Button>
      </div>

      <Card className="space-y-4 self-start lg:sticky lg:top-6">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Прогноз до запуска</h2>{fcPending ? <Badge tone="muted">Считаем…</Badge> : null}</div>
        <div className="border border-line p-3"><p className="text-xs uppercase text-ink-soft">{config.audience === 'public' ? 'Оценочный публичный охват' : 'Размер CRM-сегмента'}</p><p className="tnum text-2xl font-semibold text-brand">{num(fc?.estimatedAudience ?? (config.audience === 'segment' ? selectedSegment?.count ?? 0 : 0))}</p><p className="text-xs text-ink-soft">{config.audience === 'public' ? 'Это модель, а не уже известные клиенты.' : selectedSegment?.title}</p></div>
        {fc ? <div className="space-y-3"><Metric label="Новые клиенты" value={num(fc.expectedNewCustomers)} /><Metric label="Повторные визиты" value={num(fc.expectedReturns)} /><Metric label="Ожидаемая выручка" value={kzt(fc.expectedRevenue)} accent /><Metric label="Стоимость предложения" value={kzt(fc.expectedCost)} /><div className="bg-brand-soft px-4 py-3 text-center"><p className="text-xs text-brand-ink">Прогноз ROI</p><p className="tnum text-2xl font-bold text-brand-ink">{fc.roi}×</p></div><p className="text-xs text-ink-soft">Модель считает отклик, средний чек, стоимость скидки/бонуса и валовую маржу. Факт появится после запуска.</p></div> : <p className="text-sm text-ink-soft">Задайте корректные параметры.</p>}
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-soft">{label}</span><span className={`tnum font-semibold ${accent ? 'text-ok' : 'text-ink'}`}>{value}</span></div>;
}
