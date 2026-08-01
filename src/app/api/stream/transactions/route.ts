/**
 * GET /api/stream/transactions?businessId=… — SSE-поток операций заведения.
 *
 * Вызывающие: src/components/dashboard/LiveFeed.tsx через EventSource.
 *
 * Кассир пробивает покупку → экран владельца обновляется сам. Это главный
 * кадр демо-видео. В моке подписка держится в памяти процесса, поэтому
 * поток работает, когда касса и дашборд обслуживаются одним сервером
 * (`next dev`, один инстанс). В проде источник — Supabase Realtime, и это
 * ограничение снимается; отмечено в техническом описании.
 */

import { getRepo } from '@/lib/repo';
import { toFeedRow } from '@/lib/feed';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get('businessId');
  if (!businessId) {
    return new Response('Параметр businessId обязателен', { status: 400 });
  }
  const session = await getSession();
  if (!session) return new Response('Требуется вход', { status: 401 });
  if (session.businessId !== businessId || session.role === 'cashier') {
    return new Response('Нет доступа', { status: 403 });
  }

  const repo = await getRepo();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(': поток открыт\n\n');

      const unsubscribe = repo.subscribeTransactions(businessId, (t) => {
        void toFeedRow(repo, t).then((row) => {
          safeEnqueue(`event: tx\ndata: ${JSON.stringify(row)}\n\n`);
        });
      });

      // Комментарий-пинг держит соединение живым через прокси и таймауты.
      const ping = setInterval(() => safeEnqueue(': ping\n\n'), 15_000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // соединение уже закрыто клиентом — ничего не делаем
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
