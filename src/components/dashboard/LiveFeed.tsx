'use client';

/**
 * Лента операций владельца в реальном времени.
 *
 * Вызывающие: src/app/(app)/dashboard/page.tsx.
 * Начальные строки приходят с сервера (SSR), дальше поток по SSE. Новую
 * строку подсвечиваем анимацией row-new — на видео видно, что она приехала
 * сама, без перезагрузки.
 */

import { useEffect, useState } from 'react';
import { Badge, Card, SectionTitle } from '@/components/ui/kit';
import { feedKindLabel, type FeedRow } from '@/lib/feed';
import { kzt, num, timeShort } from '@/lib/format';

export default function LiveFeed({
  businessId,
  initial,
}: {
  businessId: string;
  initial: FeedRow[];
}) {
  const [rows, setRows] = useState<FeedRow[]>(initial);
  const [connected, setConnected] = useState(false);
  // id строк, приехавших уже после монтирования — только их анимируем
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const source = new EventSource(
      `/api/stream/transactions?businessId=${encodeURIComponent(businessId)}`,
    );
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('tx', (event) => {
      const row = JSON.parse((event as MessageEvent).data) as FeedRow;
      setLiveIds((prev) => new Set(prev).add(row.id));
      setRows((prev) => {
        if (prev.some((r) => r.id === row.id)) return prev;
        return [row, ...prev].slice(0, 40);
      });
    });
    return () => source.close();
  }, [businessId]);

  return (
    <Card>
      <SectionTitle
        title="Лента операций"
        hint="Обновляется сама, когда кассир пробивает покупку"
        action={
          <Badge tone={connected ? 'success' : 'muted'}>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? 'bg-ok' : 'bg-ink-soft'
              }`}
            />
            {connected ? 'В реальном времени' : 'Подключение…'}
          </Badge>
        }
      />
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          Пока нет операций. Пробейте покупку на кассе — строка появится здесь.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`flex items-center justify-between gap-3 py-3 ${
                liveIds.has(row.id) ? 'row-new' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{row.customerName}</p>
                <p className="truncate text-xs text-ink-soft">
                  {feedKindLabel(row.kind)}
                  {row.items.length ? ` · ${row.items.join(', ')}` : ''} · {timeShort(row.at)}
                </p>
              </div>
              <div className="text-right">
                {row.amount > 0 ? <p className="font-semibold tnum">{kzt(row.amount)}</p> : null}
                <p
                  className={`text-xs tnum ${
                    row.pointsDelta >= 0 ? 'text-ok' : 'text-danger'
                  }`}
                >
                  {row.pointsDelta >= 0 ? '+' : '−'}
                  {num(Math.abs(row.pointsDelta))} бонусов
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
