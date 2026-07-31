'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addCustomerToBusiness } from '@/app/(app)/dashboard/crm/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';

export default function AddCustomer({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button onClick={() => setOpen(true)}>Добавить клиента</Button>;
  return (
    <Card className="absolute right-0 top-12 z-20 w-80 space-y-3 shadow-xl">
      <div className="flex items-center justify-between"><p className="font-semibold text-ink">Новый клиент</p><button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft">Закрыть</button></div>
      <TextInput label="Имя" value={name} onChange={(event) => setName(event.target.value)} />
      <TextInput label="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button className="w-full" disabled={pending} onClick={() => startTransition(async () => {
        try { const result = await addCustomerToBusiness({ businessId, name, phone }); router.push(`/dashboard/crm/${result.customerId}`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка'); }
      })}>{pending ? 'Добавляем…' : 'Добавить в CRM'}</Button>
    </Card>
  );
}
