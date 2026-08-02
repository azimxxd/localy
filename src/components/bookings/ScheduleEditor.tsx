'use client';

/**
 * Расписание онлайн-записи: рабочие дни, часы, длина слота и вместимость.
 *
 * Вызывающие: src/app/(app)/dashboard/bookings/page.tsx.
 * Из этих настроек считаются свободные слоты на публичном сайте — своей
 * копии сетки здесь нет.
 */

import { useState, useTransition } from 'react';
import { updateScheduleAction } from '@/app/(app)/dashboard/bookings/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import { cn } from '@/lib/cn';
import type { BookingSchedule } from '@/lib/types';

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

export default function ScheduleEditor({ schedule, freeSlots }: { schedule: BookingSchedule; freeSlots: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [value, setValue] = useState(schedule);

  function patch<K extends keyof BookingSchedule>(key: K, next: BookingSchedule[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateScheduleAction({
          businessId: value.businessId,
          weekdays: value.weekdays,
          openTime: value.openTime,
          closeTime: value.closeTime,
          slotMinutes: Number(value.slotMinutes),
          capacity: Number(value.capacity),
          leadHours: Number(value.leadHours),
          horizonDays: Number(value.horizonDays),
        });
        setMessage('Расписание сохранено');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Не удалось сохранить расписание');
      }
    });
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="ascii-kicker">Расписание</p>
        <h2 className="mt-1 font-semibold text-ink">Когда клиенты могут записаться</h2>
        <p className="mt-1 text-sm text-ink-soft">Сейчас на сайте свободно {freeSlots} слотов на ближайшие {value.horizonDays} дней.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const active = value.weekdays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              onClick={() => patch('weekdays', active ? value.weekdays.filter((item) => item !== day.value) : [...value.weekdays, day.value].sort())}
              className={cn('min-h-11 border px-4 text-sm font-semibold uppercase', active ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-soft')}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Начало дня" type="time" value={value.openTime} onChange={(event) => patch('openTime', event.target.value)} />
        <TextInput label="Конец дня" type="time" value={value.closeTime} onChange={(event) => patch('closeTime', event.target.value)} />
        <TextInput label="Длина слота, мин" inputMode="numeric" value={String(value.slotMinutes)} onChange={(event) => patch('slotMinutes', Number(event.target.value.replace(/\D/g, '')) || 0)} />
        <TextInput label="Клиентов в слоте" inputMode="numeric" value={String(value.capacity)} onChange={(event) => patch('capacity', Number(event.target.value.replace(/\D/g, '')) || 0)} />
        <TextInput label="Буфер до записи, ч" inputMode="numeric" value={String(value.leadHours)} onChange={(event) => patch('leadHours', Number(event.target.value.replace(/\D/g, '')) || 0)} hint="Ближайшая запись не раньше чем через столько часов" />
        <TextInput label="Открыто дней вперёд" inputMode="numeric" value={String(value.horizonDays)} onChange={(event) => patch('horizonDays', Number(event.target.value.replace(/\D/g, '')) || 0)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} onClick={save}>{pending ? 'Сохраняем…' : 'Сохранить расписание'}</Button>
        {message ? <p role="status" className="text-sm text-ink-soft">{message}</p> : null}
      </div>
    </Card>
  );
}
