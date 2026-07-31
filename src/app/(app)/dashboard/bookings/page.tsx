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

const STATUS: Record<BookingStatus, { label: string; tone: 'brand' | 'success' | 'warning' | 'muted' }> = {
  pending: { label: 'Ожидает', tone: 'warning' },
  confirmed: { label: 'Подтверждена', tone: 'brand' },
  done: { label: 'Выполнена', tone: 'success' },
  cancelled: { label: 'Отменена', tone: 'muted' },
};

export default async function BookingsPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const bookings = await repo.listBookings(business.id);

  const withNames = await Promise.all(
    bookings.map(async (b) => ({ booking: b, customer: await repo.getCustomer(b.customerId) })),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Онлайн-запись</h1>
        <p className="text-sm text-ink-soft">Записи клиентов</p>
      </header>

      {withNames.length === 0 ? (
        <EmptyState title="Записей пока нет" />
      ) : (
        <div className="space-y-2">
          {withNames.map(({ booking, customer }) => (
            <Card key={booking.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{booking.service}</p>
                <p className="text-xs text-ink-soft">
                  {customer?.name ?? 'Клиент'} · {dateShort(booking.at)}, {timeShort(booking.at)}
                </p>
              </div>
              <Badge tone={STATUS[booking.status].tone}>{STATUS[booking.status].label}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
