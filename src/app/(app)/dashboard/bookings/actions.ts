'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { BookingStatus } from '@/lib/types';

export async function updateBookingStatus(input: { businessId: string; bookingId: string; status: BookingStatus }): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'manager']);
  const repo = await getRepo();
  if (!(await repo.listBookings(input.businessId)).some((item) => item.id === input.bookingId)) throw new Error('Запись не найдена');
  await repo.updateBooking(input.bookingId, { status: input.status });
  revalidatePath('/dashboard/bookings');
}
