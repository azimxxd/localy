/**
 * Онлайн-запись.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/bookings.
 * Расписание задаёт сетку слотов для публичного сайта; здесь же перенос,
 * отмена с причиной и подсветка дублей (один человек, одна услуга, один день).
 */

import { Badge, Card, DemoNote, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { dateShort, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { Booking, BookingStatus } from '@/lib/types';
import BookingActions from '@/components/bookings/BookingActions';
import ScheduleEditor from '@/components/bookings/ScheduleEditor';
import { requireSession } from '@/lib/auth';

const STATUS: Record<BookingStatus, { label: string; tone: 'brand' | 'success' | 'warning' | 'muted' }> = {
  pending: { label: 'Ожидает', tone: 'warning' },
  confirmed: { label: 'Подтверждена', tone: 'brand' },
  done: { label: 'Выполнена', tone: 'success' },
  cancelled: { label: 'Отменена', tone: 'muted' },
};

/** Дубль — одна и та же услуга у одного клиента в один день и не отменена. */
function duplicateKey(booking: Booking): string {
  return `${booking.customerId}|${booking.service}|${booking.at.slice(0, 10)}`;
}

export default async function BookingsPage() {
  const session = await requireSession(['owner', 'admin', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [bookings, schedule, slots] = await Promise.all([
    repo.listBookings(business.id),
    repo.getBookingSchedule(business.id),
    repo.listBookingSlots(business.id),
  ]);

  const duplicates = new Set(
    Object.entries(
      bookings
        .filter((booking) => booking.status !== 'cancelled' && booking.kind !== 'lead')
        .reduce<Record<string, number>>((acc, booking) => {
          const key = duplicateKey(booking);
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
    )
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );

  const withNames = await Promise.all(
    bookings.map(async (b) => ({ booking: b, customer: await repo.getCustomer(b.customerId) })),
  );
  const freeSlots = slots.filter((slot) => slot.taken < slot.capacity).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="ascii-kicker">Записи</p><h1 className="mt-1 text-2xl uppercase tracking-[0.1em] text-ink">Записи и заявки</h1>
        <p className="mt-1 text-sm text-ink-soft">Подтвердите, перенесите или отмените</p>
      </header>

      {session.role === 'manager' ? null : <ScheduleEditor schedule={schedule} freeSlots={freeSlots} />}

      {duplicates.size > 0 ? (
        <p role="status" className="border border-warn bg-warn-soft px-3 py-2 text-sm text-warn">
          Похоже на дубли: {duplicates.size} совпадений «клиент + услуга + день». Оставьте одну запись, вторую отмените.
        </p>
      ) : null}

      {withNames.length === 0 ? (
        <EmptyState title="Записей пока нет" hint="Слоты появятся на публичном сайте, как только включите раздел записи" />
      ) : (
        <div className="space-y-2">
          {withNames.map(({ booking, customer }) => {
            const duplicate = booking.status !== 'cancelled' && booking.kind !== 'lead' && duplicates.has(duplicateKey(booking));
            return (
              <Card key={booking.id} className={duplicate ? 'border-warn p-4' : 'p-4'}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{booking.service}</p>
                    <p className="text-xs text-ink-soft">
                      {customer?.name ?? 'Клиент'} · {dateShort(booking.at)}{booking.kind === 'lead' ? '' : `, ${timeShort(booking.at)}`}
                    </p>
                    {booking.rescheduledFrom ? (
                      <p className="mt-1 text-xs text-ink-soft">Перенесена с {dateShort(booking.rescheduledFrom)}, {timeShort(booking.rescheduledFrom)}</p>
                    ) : null}
                    {booking.cancelReason ? <p className="mt-1 text-xs text-ink-soft">Причина отмены: {booking.cancelReason}</p> : null}
                    {booking.note ? <p className="mt-1 text-xs text-ink-soft">{booking.note}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {duplicate ? <Badge tone="warning">Дубль</Badge> : null}
                    <Badge tone={STATUS[booking.status].tone}>{STATUS[booking.status].label}</Badge>
                  </div>
                </div>
                <BookingActions businessId={business.id} bookingId={booking.id} status={booking.status} />
              </Card>
            );
          })}
        </div>
      )}

      <DemoNote>Напоминания клиенту о записи — симуляция: сообщение не уходит, но попадает в журнал доставки рассылок.</DemoNote>
    </div>
  );
}
