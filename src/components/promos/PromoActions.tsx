'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { duplicatePromoAction, launchPromoNowAction, updatePromoAction } from '@/app/(app)/dashboard/promos/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import type { Promo, PromoStatus } from '@/lib/types';

export default function PromoActions({ promo }: { promo: Promo }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [editing, setEditing] = useState(false); const [message, setMessage] = useState<string | null>(null); const [title, setTitle] = useState(promo.title); const [body, setBody] = useState(promo.body ?? ''); const [value, setValue] = useState(String(promo.value));
  function run(action: () => Promise<void | Promo>, success: string, after?: (result: Promo) => void) { setMessage(null); startTransition(async () => { try { const result = await action(); setMessage(success); if (result && after) after(result); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие'); } }); }
  function status(next: PromoStatus) { run(() => updatePromoAction(promo.id, { status: next }), next === 'paused' ? 'Акция приостановлена' : next === 'finished' ? 'Акция завершена' : 'Акция снова активна'); }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Закрыть редактор' : 'Редактировать'}</Button>{promo.status === 'scheduled' ? <Button disabled={pending} onClick={() => run(() => launchPromoNowAction(promo.id), 'Акция запущена сейчас')}>Запустить сейчас</Button> : null}{promo.status === 'active' ? <Button variant="secondary" disabled={pending} onClick={() => status('paused')}>Приостановить</Button> : null}{promo.status === 'paused' ? <Button disabled={pending} onClick={() => status('active')}>Продолжить</Button> : null}{promo.status !== 'finished' ? <Button variant="ghost" disabled={pending} onClick={() => status('finished')}>Завершить</Button> : null}<Button variant="ghost" disabled={pending} onClick={() => run(() => duplicatePromoAction(promo.id), 'Копия создана', (copy) => router.push(`/dashboard/promos/${copy.id}`))}>Дублировать</Button></div>
    {editing ? <Card className="space-y-3"><h2 className="font-semibold">+-- Редактор акции --+</h2><TextInput label="Название" value={title} onChange={(e) => setTitle(e.target.value)} /><TextInput label="Размер предложения" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /><label className="block text-sm"><span className="mb-1 block font-medium">Описание</span><textarea rows={3} className="w-full border border-line px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} /></label><Button disabled={pending} onClick={() => run(() => updatePromoAction(promo.id, { title, body, value: Number(value) }), 'Изменения сохранены')}>Сохранить</Button></Card> : null}
    {message ? <p role="status" className="border border-line px-3 py-2 text-sm">{message}</p> : null}</div>;
}
