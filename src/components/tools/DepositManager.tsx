'use client';

import { useState, useTransition } from 'react';
import { createDepositAction, redeemDepositAction } from '@/app/(app)/tools/[id]/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { kzt } from '@/lib/format';
import type { Deposit } from '@/lib/types';

const KIND_LABELS: Record<Deposit['kind'], string> = { certificate: 'Подарочный сертификат', subscription: 'Абонемент', deposit: 'Депозит' };

export default function DepositManager({ customers, deposits }: { customers: { id: string; name: string; phone: string }[]; deposits: (Deposit & { customerName: string })[] }) {
  const [pending, start] = useTransition();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [kind, setKind] = useState<Deposit['kind']>('certificate');
  const [title, setTitle] = useState('Подарочный сертификат');
  const [balance, setBalance] = useState('10000');
  const [redeem, setRedeem] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<void>, success: string) {
    setMessage(null);
    start(async () => { try { await action(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие'); } });
  }

  return <div className="space-y-5">
    <Card className="space-y-3"><h2 className="font-semibold">Выпустить</h2><div className="grid gap-3 md:grid-cols-2"><label className="text-sm"><span className="mb-1 block font-medium">Клиент</span><select aria-label="Клиент сертификата" value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full border border-line bg-canvas px-3 py-2.5">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label><label className="text-sm"><span className="mb-1 block font-medium">Тип</span><select aria-label="Тип сертификата" value={kind} onChange={(event) => setKind(event.target.value as Deposit['kind'])} className="w-full border border-line bg-canvas px-3 py-2.5">{Object.entries(KIND_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><TextInput label="Название" value={title} onChange={(event) => setTitle(event.target.value)} /><TextInput label="Номинал или баланс, ₸" inputMode="numeric" value={balance} onChange={(event) => setBalance(event.target.value.replace(/\D/g, ''))} /></div><Button disabled={pending || !customerId} onClick={() => run(() => createDepositAction({ customerId, kind, title, balance: Number(balance) }), 'Выпущено и сохранено')}>{pending ? 'Сохраняем…' : 'Выпустить'}</Button></Card>
    {message ? <p role="status" className="border border-line px-3 py-2 text-sm">{message}</p> : null}
    <div className="space-y-3"><h2 className="font-semibold">Действующие сертификаты и абонементы</h2>{deposits.length === 0 ? <p className="text-sm text-ink-soft">Пока ничего не выпущено.</p> : deposits.map((deposit) => <Card key={deposit.id} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-semibold">{deposit.title ?? KIND_LABELS[deposit.kind]}</p><p className="text-sm text-ink-soft">{deposit.customerName} · {KIND_LABELS[deposit.kind]}</p><p className="tnum mt-1 text-xl text-brand">{kzt(deposit.balance)}</p></div><div className="flex gap-2"><TextInput aria-label={`Списание ${deposit.id}`} className="w-32" placeholder="Сумма" inputMode="numeric" value={redeem[deposit.id] ?? ''} onChange={(event) => setRedeem((current) => ({ ...current, [deposit.id]: event.target.value.replace(/\D/g, '') }))} /><Button variant="secondary" disabled={pending || deposit.balance <= 0} onClick={() => run(() => redeemDepositAction(deposit.id, Number(redeem[deposit.id])), 'Списание сохранено')}>Списать</Button></div></Card>)}</div>
  </div>;
}
