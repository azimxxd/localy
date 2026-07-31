'use client';

import { useState, useTransition } from 'react';
import { createBranchAction, updateBranchAction } from '@/app/(app)/dashboard/branches/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import type { Branch } from '@/lib/types';

export default function BranchManager({ businessId, branches, editable }: { businessId: string; branches: Branch[]; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  function run(action: () => Promise<void>, success: string) { setMessage(null); startTransition(async () => { try { await action(); setMessage(success); setOpen(false); setTitle(''); setAddress(''); setPhone(''); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить'); } }); }
  return <div className="space-y-4">
    {editable ? <div className="flex justify-end"><Button onClick={() => setOpen((value) => !value)}>{open ? 'Закрыть' : 'Добавить филиал'}</Button></div> : <p className="text-sm text-ink-soft">Редактировать филиалы может владелец или администратор.</p>}
    {open ? <Card className="space-y-3"><h2 className="font-semibold">+-- Новый филиал --+</h2><div className="grid gap-3 md:grid-cols-2"><TextInput label="Название" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Точка на Абая" /><TextInput label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} /><div className="md:col-span-2"><TextInput label="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} /></div></div><Button disabled={pending} onClick={() => run(() => createBranchAction({ businessId, title, address, phone }), 'Филиал добавлен')}>Сохранить</Button></Card> : null}
    {message ? <p role="status" className="border border-line px-3 py-2 text-sm">{message}</p> : null}
    <div className="space-y-3">{branches.map((branch) => <BranchRow key={branch.id} businessId={businessId} branch={branch} pending={pending} run={run} editable={editable} />)}</div>
  </div>;
}

function BranchRow({ businessId, branch, pending, run, editable }: { businessId: string; branch: Branch; pending: boolean; run: (action: () => Promise<void>, success: string) => void; editable: boolean }) {
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(branch.title); const [address, setAddress] = useState(branch.address); const [phone, setPhone] = useState(branch.phone);
  return <Card className="p-4">{editing ? <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_1fr_auto]"><TextInput aria-label="Название" value={title} onChange={(e) => setTitle(e.target.value)} /><TextInput aria-label="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} /><TextInput aria-label="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} /><Button disabled={pending} onClick={() => run(() => updateBranchAction({ businessId, branchId: branch.id, title, address, phone }), 'Филиал обновлён')}>Готово</Button></div> : <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-ink">{branch.title}</p><p className="text-sm text-ink-soft">{branch.address}</p><p className="text-sm text-ink-soft">{branch.phone || 'Телефон не указан'}</p></div>{editable ? <Button variant="secondary" onClick={() => setEditing(true)}>Изменить</Button> : null}</div>}</Card>;
}
