/**
 * Журнал доставки одной рассылки.
 *
 * Вызывающие: src/app/(app)/dashboard/campaigns/page.tsx.
 * Статусы доставки симулируются, а причины исключения настоящие — по ним
 * видно, почему аудитория оказалась меньше сегмента.
 */

import { Badge } from '@/components/ui/kit';
import { timeShort } from '@/lib/format';
import type { MessageDelivery, MessageStatus } from '@/lib/types';

const STATUS_LABELS: Record<MessageStatus, { label: string; tone: 'brand' | 'success' | 'warning' | 'danger' | 'muted' }> = {
  queued: { label: 'В очереди', tone: 'muted' },
  sent: { label: 'Отправлено', tone: 'muted' },
  delivered: { label: 'Доставлено', tone: 'brand' },
  opened: { label: 'Открыто', tone: 'success' },
  clicked: { label: 'Переход', tone: 'success' },
  failed: { label: 'Ошибка', tone: 'danger' },
  skipped: { label: 'Пропущен', tone: 'warning' },
};

const ORDER: MessageStatus[] = ['clicked', 'opened', 'delivered', 'sent', 'queued', 'failed', 'skipped'];

export default function DeliveryLog({ rows, names }: { rows: MessageDelivery[]; names: Map<string, string> }) {
  if (rows.length === 0) return null;
  const counts = ORDER.map((status) => [status, rows.filter((row) => row.status === status).length] as const).filter(([, count]) => count > 0);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-ink-soft">Журнал доставки ({rows.length})</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {counts.map(([status, count]) => (
          <Badge key={status} tone={STATUS_LABELS[status].tone}>{STATUS_LABELS[status].label}: {count}</Badge>
        ))}
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto border-t border-line pt-2">
        <ul className="space-y-1 text-xs">
          {rows.slice(0, 100).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-ink">{names.get(row.customerId) ?? 'Клиент'}</span>
              <span className="shrink-0 text-ink-soft">
                {STATUS_LABELS[row.status].label}
                {row.reason ? ` · ${row.reason}` : ''} · {timeShort(row.at)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
