'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { duplicatePromoAction, launchPromoNowAction, updatePromoAction } from '@/app/(app)/dashboard/promos/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { PROMO_PLACEMENT_LABELS } from '@/lib/promo-labels';
import type { Branch, NotificationChannel, Promo, PromoPlacement, PromoStatus } from '@/lib/types';

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  telegram: 'Telegram', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Внутри Localy',
};
const PLACEMENTS = Object.keys(PROMO_PLACEMENT_LABELS) as PromoPlacement[];

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function PromoActions({ promo, branches }: { promo: Promo; branches: Branch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState(promo.title);
  const [body, setBody] = useState(promo.body ?? '');
  const [value, setValue] = useState(String(promo.value));
  const [startsAt, setStartsAt] = useState(localDateTime(promo.startsAt));
  const [endsAt, setEndsAt] = useState(localDateTime(promo.endsAt));
  const [branchId, setBranchId] = useState(promo.branchId ?? '');
  const [channel, setChannel] = useState<NotificationChannel>(promo.channel ?? 'telegram');
  const [placements, setPlacements] = useState<PromoPlacement[]>(promo.placements ?? ['cashier']);
  const mechanicsEditable = promo.status === 'draft' || promo.status === 'scheduled';

  function run(action: () => Promise<void | Promo>, success: string, after?: (result: Promo) => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(success);
        if (result && after) after(result);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие');
      }
    });
  }

  function status(next: PromoStatus) {
    run(() => updatePromoAction(promo.id, { status: next }), next === 'paused' ? 'Акция приостановлена' : next === 'finished' ? 'Акция завершена' : 'Акция снова активна');
  }

  function save() {
    const copyPatch = { title, body };
    if (!mechanicsEditable) return run(() => updatePromoAction(promo.id, copyPatch), 'Текст акции сохранён');
    return run(() => updatePromoAction(promo.id, {
      ...copyPatch,
      value: Number(value),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      branchId: branchId || null,
      channel,
      placements,
    }), 'Изменения и прогноз сохранены');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setEditing((current) => !current)}>{editing ? 'Закрыть редактор' : 'Редактировать'}</Button>
        {promo.status === 'scheduled' ? <Button disabled={pending} onClick={() => run(() => launchPromoNowAction(promo.id), 'Акция запущена сейчас')}>Запустить сейчас</Button> : null}
        {promo.status === 'active' ? <Button variant="secondary" disabled={pending} onClick={() => status('paused')}>Приостановить</Button> : null}
        {promo.status === 'paused' ? <Button disabled={pending} onClick={() => status('active')}>Продолжить</Button> : null}
        {promo.status !== 'finished' ? <Button variant="ghost" disabled={pending} onClick={() => status('finished')}>Завершить</Button> : null}
        <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicatePromoAction(promo.id), 'Копия создана', (copy) => router.push(`/dashboard/promos/${copy.id}`))}>Дублировать</Button>
      </div>

      {editing ? (
        <Card className="space-y-4">
          <div><h2 className="font-semibold">Редактор акции</h2><p className="mt-1 text-xs text-ink-soft">Цель и аудитория зафиксированы. Чтобы поменять их без искажения аналитики, создайте копию акции.</p></div>
          <TextInput label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="block text-sm"><span className="mb-1 block font-medium">Описание и условия</span><textarea rows={3} className="w-full border border-line bg-canvas px-3 py-2" value={body} onChange={(event) => setBody(event.target.value)} /></label>
          {mechanicsEditable ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextInput label="Размер предложения" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))} />
                <TextInput label="Начало" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                <TextInput label="Окончание" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block font-medium">Филиал</span><select className="w-full border border-line bg-canvas px-3 py-2.5" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}</select></label>
                {promo.audienceMode !== 'public' && promo.goal !== 'new_customers' ? <label className="text-sm"><span className="mb-1 block font-medium">Канал будущей рассылки</span><select className="w-full border border-line bg-canvas px-3 py-2.5" value={channel} onChange={(event) => setChannel(event.target.value as NotificationChannel)}>{Object.entries(CHANNEL_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label> : null}
              </div>
              <fieldset><legend className="mb-2 text-sm font-medium">Показ и применение</legend><div className="grid gap-2 sm:grid-cols-2">{PLACEMENTS.map((placement) => <label key={placement} className="flex gap-2 border border-line p-3 text-sm"><input type="checkbox" checked={placements.includes(placement)} disabled={placement === 'cashier'} onChange={(event) => setPlacements((current) => event.target.checked ? [...new Set([...current, placement])] : current.filter((item) => item !== placement))} /><span>{PROMO_PLACEMENT_LABELS[placement]}</span></label>)}</div></fieldset>
              <p className="text-xs text-ink-soft">После изменения механики Localy заново считает аудиторию, стоимость и ROI.</p>
            </>
          ) : <p className="border border-line bg-canvas px-3 py-2 text-sm text-ink-soft">Акция уже запускалась: сейчас можно исправить только название и описание. Механику меняйте в копии.</p>}
          <Button disabled={pending} onClick={save}>{pending ? 'Сохраняем…' : 'Сохранить'}</Button>
        </Card>
      ) : null}
      {message ? <p role="status" className="border border-line px-3 py-2 text-sm">{message}</p> : null}
    </div>
  );
}
