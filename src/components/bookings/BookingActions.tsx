'use client';

import { useState, useTransition } from 'react';
import { updateBookingStatus } from '@/app/(app)/dashboard/bookings/actions';
import { Button } from '@/components/ui/kit';
import type { BookingStatus } from '@/lib/types';

export default function BookingActions({ businessId, bookingId, status }: { businessId: string; bookingId: string; status: BookingStatus }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  function set(next: BookingStatus) { setMessage(null); startTransition(async () => { try { await updateBookingStatus({ businessId, bookingId, status: next }); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ошибка'); } }); }
  return <div className="mt-3"><div className="flex flex-wrap gap-2">{status === 'pending' ? <Button disabled={pending} onClick={() => set('confirmed')}>Подтвердить</Button> : null}{status === 'confirmed' ? <Button disabled={pending} onClick={() => set('done')}>Выполнено</Button> : null}{status !== 'done' && status !== 'cancelled' ? <Button variant="ghost" disabled={pending} onClick={() => set('cancelled')}>Отменить</Button> : null}</div>{message ? <p className="mt-2 text-xs text-danger">{message}</p> : null}</div>;
}
