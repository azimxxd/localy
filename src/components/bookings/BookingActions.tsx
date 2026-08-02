'use client';

/**
 * Действия по записи: подтвердить, выполнить, перенести, отменить.
 *
 * Вызывающие: src/app/(app)/dashboard/bookings/page.tsx.
 * Слоты для переноса грузим по клику, а не заранее: на странице их столько же,
 * сколько записей, и тянуть сетку для каждой карточки бессмысленно.
 */

import { useState, useTransition } from 'react';
import {
  cancelBookingAction,
  listSlotsAction,
  rescheduleBookingAction,
  updateBookingStatus,
} from '@/app/(app)/dashboard/bookings/actions';
import { Button, TextInput } from '@/components/ui/kit';
import { dateShort, timeShort } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

type Mode = null | 'cancel' | 'reschedule';

export default function BookingActions({ businessId, bookingId, status }: { businessId: string; bookingId: string; status: BookingStatus }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [slots, setSlots] = useState<{ at: string; free: number }[]>([]);
  const [slot, setSlot] = useState('');

  function run(action: () => Promise<void>) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMode(null);
        setReason('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Ошибка');
      }
    });
  }

  function openReschedule() {
    setMessage(null);
    setMode('reschedule');
    startTransition(async () => {
      try {
        const available = await listSlotsAction({ businessId, bookingId });
        setSlots(available);
        setSlot(available[0]?.at ?? '');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Не удалось получить слоты');
      }
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {status === 'pending' ? <Button disabled={pending} onClick={() => run(() => updateBookingStatus({ businessId, bookingId, status: 'confirmed' }))}>Подтвердить</Button> : null}
        {status === 'confirmed' ? <Button disabled={pending} onClick={() => run(() => updateBookingStatus({ businessId, bookingId, status: 'done' }))}>Выполнено</Button> : null}
        {status !== 'done' && status !== 'cancelled' ? <Button variant="secondary" disabled={pending} onClick={openReschedule}>Перенести</Button> : null}
        {status !== 'done' && status !== 'cancelled' ? <Button variant="ghost" disabled={pending} onClick={() => { setMode('cancel'); setMessage(null); }}>Отменить</Button> : null}
      </div>

      {mode === 'cancel' ? (
        <div className="mt-3 space-y-2 border border-line p-3">
          <TextInput label="Причина отмены" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Клиент перенёс планы" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>Назад</Button>
            <Button variant="danger" disabled={pending || reason.trim().length < 3} onClick={() => run(() => cancelBookingAction({ businessId, bookingId, reason }))}>
              {pending ? 'Отменяем…' : 'Отменить запись'}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'reschedule' ? (
        <div className="mt-3 space-y-2 border border-line p-3">
          {slots.length === 0 ? (
            <p className="text-sm text-ink-soft">{pending ? 'Ищем свободные слоты…' : 'Свободных слотов в расписании нет. Расширьте расписание записи.'}</p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Новое время</span>
              <select value={slot} onChange={(event) => setSlot(event.target.value)} className="w-full border border-line bg-surface px-3 py-2.5">
                {slots.map((item) => (
                  <option key={item.at} value={item.at}>
                    {dateShort(item.at)}, {timeShort(item.at)} · свободно {item.free}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>Назад</Button>
            <Button disabled={pending || !slot} onClick={() => run(() => rescheduleBookingAction({ businessId, bookingId, at: slot }))}>
              {pending ? 'Переносим…' : 'Перенести'}
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p role="alert" className="mt-2 text-xs text-danger">{message}</p> : null}
    </div>
  );
}
