'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adjustCustomerPoints, removeCustomerFromCrm, updateCustomerCard } from '@/app/(app)/dashboard/crm/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import type { Customer, Membership, NotificationChannel } from '@/lib/types';

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'push', label: 'Localy' },
];

export default function CustomerEditor({ customer, membership, canDelete }: { customer: Customer; membership: Membership; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [birthday, setBirthday] = useState(customer.birthday ?? '');
  const [source, setSource] = useState(membership.source ?? 'QR на кассе');
  const [notes, setNotes] = useState(membership.notes ?? '');
  const [channels, setChannels] = useState<NotificationChannel[]>(membership.consentChannels);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = (task: () => Promise<void>, success: string) => {
    setMessage(null);
    startTransition(async () => {
      try { await task(); setMessage(success); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Ошибка'); }
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <div><h2 className="font-semibold text-ink">Контакты и заметки</h2><p className="text-xs text-ink-soft">Доступны только сотрудникам этого бизнеса.</p></div>
        <TextInput label="Имя" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput label="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <TextInput label="Дата рождения" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
        <TextInput label="Источник регистрации" value={source} onChange={(event) => setSource(event.target.value)} />
        <label className="block"><span className="mb-1 block text-sm font-medium text-ink">Внутренняя заметка</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-xl border border-line px-3 py-2 text-sm" /></label>
        <div><p className="mb-2 text-sm font-medium text-ink">Согласие на уведомления</p><div className="flex flex-wrap gap-2">{CHANNELS.map((channel) => <label key={channel.value} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft"><input type="checkbox" checked={channels.includes(channel.value)} onChange={(event) => setChannels((current) => event.target.checked ? [...current, channel.value] : current.filter((value) => value !== channel.value))} className="accent-brand" />{channel.label}</label>)}</div></div>
        <Button disabled={pending} onClick={() => run(() => updateCustomerCard({ businessId: membership.businessId, customerId: customer.id, name, phone, birthday: birthday || null, source, notes, consentChannels: channels }), 'Карточка сохранена')}>Сохранить карточку</Button>
      </Card>
      <Card className="space-y-3">
        <div><h2 className="font-semibold text-ink">Ручная корректировка</h2><p className="text-xs text-ink-soft">Положительное число начисляет, отрицательное списывает. Действие попадёт в аудит.</p></div>
        <TextInput label="Изменение бонусов" type="number" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="Например, 200 или -100" />
        <TextInput label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Компенсация за задержку" />
        <Button variant="secondary" disabled={pending || !delta} onClick={() => run(async () => { await adjustCustomerPoints({ businessId: membership.businessId, customerId: customer.id, delta: Number(delta), note: reason }); setDelta(''); setReason(''); }, 'Баланс обновлён')}>Провести корректировку</Button>
        {message ? <p role="status" className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink-soft">{message}</p> : null}
        {canDelete ? <details className="ascii-details border-t border-line pt-3"><summary className="text-xs uppercase text-danger">Удалить из CRM</summary><p className="mt-2 text-xs text-ink-soft">Глобальный аккаунт Localy и аудит операций сохранятся.</p>{confirmRemove ? <div className="mt-2 flex gap-2"><Button variant="ghost" onClick={() => setConfirmRemove(false)}>Отмена</Button><Button variant="danger" disabled={pending} onClick={() => startTransition(async () => { try { await removeCustomerFromCrm({ businessId: membership.businessId, customerId: customer.id }); router.push('/dashboard/crm'); router.refresh(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Ошибка'); } })}>Подтвердить</Button></div> : <Button className="mt-2" variant="danger" onClick={() => setConfirmRemove(true)}>Удалить из CRM</Button>}</details> : null}
      </Card>
    </div>
  );
}
