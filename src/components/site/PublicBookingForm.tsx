'use client';

import { useActionState } from 'react';
import { createPublicBooking } from '@/app/b/[slug]/actions';
import { Button, TextInput } from '@/components/ui/kit';

export default function PublicBookingForm({ slug, services }: { slug: string; services: string[] }) {
  const [state, action, pending] = useActionState(createPublicBooking.bind(null, slug), {});
  return <form action={action} className="space-y-3 border border-line bg-canvas p-4"><div className="grid gap-3 sm:grid-cols-2"><TextInput name="name" label="Имя" required autoComplete="name" /><TextInput name="phone" label="Телефон" required type="tel" autoComplete="tel" /><label className="text-sm"><span className="mb-1 block font-medium">Услуга</span><select name="service" required className="w-full border border-line px-3 py-2.5"><option value="">Выберите</option>{services.map((service) => <option key={service} value={service}>{service}</option>)}</select></label><TextInput name="at" label="Дата и время" required type="datetime-local" /></div>{state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}{state.success ? <p role="status" className="border border-brand bg-brand-soft p-3 text-sm text-ink">{state.success}</p> : <Button type="submit" disabled={pending}>{pending ? 'Отправляем…' : 'Записаться'}</Button>}</form>;
}
