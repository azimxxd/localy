'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { BookingStatus } from '@/lib/types';

async function assertBooking(businessId: string, bookingId: string) {
  await requireBusinessAccess(businessId, ['owner', 'admin', 'manager']);
  const repo = await getRepo();
  if (!(await repo.listBookings(businessId)).some((item) => item.id === bookingId)) throw new Error('Запись не найдена');
  return repo;
}

export async function updateBookingStatus(input: { businessId: string; bookingId: string; status: BookingStatus }): Promise<void> {
  const repo = await assertBooking(input.businessId, input.bookingId);
  await repo.updateBooking(input.bookingId, { status: input.status });
  revalidatePath('/dashboard/bookings');
}

export async function cancelBookingAction(input: { businessId: string; bookingId: string; reason: string }): Promise<void> {
  const repo = await assertBooking(input.businessId, input.bookingId);
  await repo.cancelBooking(input.bookingId, input.reason);
  revalidatePath('/dashboard/bookings');
}

export async function rescheduleBookingAction(input: { businessId: string; bookingId: string; at: string }): Promise<void> {
  const repo = await assertBooking(input.businessId, input.bookingId);
  await repo.rescheduleBooking(input.bookingId, input.at);
  revalidatePath('/dashboard/bookings');
}

/** Слоты для переноса: тот же расчёт, что и на публичном сайте, минус сама запись. */
export async function listSlotsAction(input: { businessId: string; bookingId?: string }): Promise<{ at: string; free: number }[]> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager']);
  const repo = await getRepo();
  const slots = await repo.listBookingSlots(input.businessId, { excludeBookingId: input.bookingId });
  return slots.map((slot) => ({ at: slot.at, free: slot.capacity - slot.taken })).filter((slot) => slot.free > 0);
}

export async function updateScheduleAction(input: {
  businessId: string;
  weekdays: number[];
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  capacity: number;
  leadHours: number;
  horizonDays: number;
}): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  const { businessId, ...patch } = input;
  const repo = await getRepo();
  await repo.updateBookingSchedule(businessId, patch);
  revalidatePath('/dashboard/bookings');
}
