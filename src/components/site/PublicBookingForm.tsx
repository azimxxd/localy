'use client';

/**
 * Публичная запись: клиент выбирает свободный слот, а не любое время.
 *
 * Вызывающие: src/app/b/[slug]/page.tsx.
 * Слоты приходят с сервера — форма их не считает. Занятость перепроверяется
 * при отправке: между рендером и сабмитом слот могли занять.
 */

import { useActionState } from 'react';
import { createPublicBooking } from '@/app/b/[slug]/actions';
import { Button, TextInput } from '@/components/ui/kit';
import { dateShort, timeShort } from '@/lib/format';

export default function PublicBookingForm({ slug, services, slots }: { slug: string; services: string[]; slots: { at: string; free: number }[] }) {
  const [state, action, pending] = useActionState(createPublicBooking.bind(null, slug), {});
  return (
    <form action={action} className="space-y-3 border border-line bg-canvas p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="name" label="Имя" required autoComplete="name" />
        <TextInput name="phone" label="Телефон" required type="tel" autoComplete="tel" />
        <label className="text-sm">
          <span className="mb-1 block font-medium">Услуга</span>
          <select name="service" required className="w-full border border-line px-3 py-2.5">
            <option value="">Выберите</option>
            {services.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Свободное время</span>
          <select name="at" required disabled={slots.length === 0} className="w-full border border-line px-3 py-2.5">
            {slots.length === 0 ? <option value="">Свободных слотов нет</option> : <option value="">Выберите время</option>}
            {slots.map((slot) => (
              <option key={slot.at} value={slot.at}>
                {dateShort(slot.at)}, {timeShort(slot.at)}{slot.free > 1 ? ` · свободно ${slot.free}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {slots.length === 0 ? <p className="text-sm text-ink-soft">Ближайшие дни расписаны. Загляните позже или напишите нам.</p> : null}
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? (
        <p role="status" className="border border-brand bg-brand-soft p-3 text-sm text-ink">{state.success}</p>
      ) : (
        <Button type="submit" disabled={pending || slots.length === 0}>{pending ? 'Отправляем…' : 'Записаться'}</Button>
      )}
    </form>
  );
}
