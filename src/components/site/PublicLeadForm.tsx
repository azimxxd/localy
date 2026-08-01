'use client';

import { useActionState } from 'react';
import { createPublicLead } from '@/app/b/[slug]/actions';
import { Button, TextInput } from '@/components/ui/kit';

export default function PublicLeadForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createPublicLead.bind(null, slug), {});
  return <form action={action} className="space-y-3 border border-line bg-canvas p-4"><div className="grid gap-3 sm:grid-cols-2"><TextInput name="name" label="Имя" required autoComplete="name" /><TextInput name="phone" label="Телефон" required type="tel" autoComplete="tel" /></div><label className="block text-sm"><span className="mb-1 block font-medium">Чем помочь?</span><textarea name="message" required minLength={3} maxLength={500} rows={3} className="w-full border border-line px-3 py-2" placeholder="Например: нужен заказ к пятнице" /></label>{state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}{state.success ? <p role="status" className="border border-brand bg-brand-soft p-3 text-sm text-ink">{state.success}</p> : <Button type="submit" disabled={pending}>{pending ? 'Отправляем…' : 'Отправить заявку'}</Button>}</form>;
}
