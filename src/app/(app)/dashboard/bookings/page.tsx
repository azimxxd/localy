/**
 * Онлайн-запись.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/bookings.
 * В MVP — просмотр записей со статусами.
 */

import { Badge, Card, EmptyState } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { dateShort, timeShort } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import type { BookingStatus } from '@/lib/types';
import BookingActions from '@/components/bookings/BookingActions';
import { requireSession } from '@/lib/auth';

const STATUS: Record<BookingStatus, { label: string; tone: 'brand' | 'success' | 'warning' | 'muted' }> = {
  pending: { label: 'Ожидает', tone: 'warning' },
  confirmed: { label: 'Подтверждена', tone: 'brand' },
  done: { label: 'Выполнена', tone: 'success' },
  cancelled: { label: 'Отменена', tone: 'muted' },
};

export default async function BookingsPage() {
  await requireSession(['owner', 'admin', 'manager']);
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const bookings = await repo.listBookings(business.id);

  const withNames = await Promise.all(
    bookings.map(async (b) => ({ booking: b, customer: await repo.getCustomer(b.customerId) })),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="ascii-kicker">~/localy/bookings</p><h1 className="mt-1 text-2xl font-bold uppercase text-ink">+-- Записи и заявки --+</h1>
        <p className="mt-1 text-sm text-ink-soft">Подтвердите, выполните или отмените</p>
      </header>

      {withNames.length === 0 ? (
        <EmptyState title="Записей пока нет" />
      ) : (
        <div className="space-y-2">
          {withNames.map(({ booking, customer }) => (
            <Card key={booking.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{booking.service}</p>
                <p className="text-xs text-ink-soft">
                  {customer?.name ?? 'Клиент'} · {dateShort(booking.at)}{booking.kind === 'lead' ? '' : `, ${timeShort(booking.at)}`}
                </p>
                {booking.note ? <p className="mt-1 text-xs text-ink-soft">&gt; {booking.note}</p> : null}
              </div>
              <Badge tone={STATUS[booking.status].tone}>{STATUS[booking.status].label}</Badge>
              </div>
              <BookingActions businessId={business.id} bookingId={booking.id} status={booking.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
