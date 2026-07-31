/**
 * Localy — строка ленты операций.
 *
 * Вызывающие: src/app/api/stream/transactions/route.ts (SSE),
 * src/app/(app)/dashboard/page.tsx (начальная лента).
 *
 * Транзакция хранит только customerId — для ленты нужно имя. Обогащаем здесь,
 * чтобы и первичная отрисовка, и realtime-события давали одинаковую форму.
 */

import type { Repo } from '@/lib/repo';
import type { Transaction, TransactionKind } from '@/lib/types';

export interface FeedRow {
  id: string;
  at: string;
  customerId: string;
  customerName: string;
  kind: TransactionKind;
  amount: number;
  pointsDelta: number;
  items: string[];
}

const KIND_LABELS: Record<TransactionKind, string> = {
  purchase: 'Покупка',
  accrue: 'Начисление',
  redeem: 'Списание бонусов',
  reward: 'Выдача награды',
};

export function feedKindLabel(kind: TransactionKind): string {
  return KIND_LABELS[kind];
}

export async function toFeedRow(repo: Repo, t: Transaction): Promise<FeedRow> {
  const customer = await repo.getCustomer(t.customerId);
  return {
    id: t.id,
    at: t.createdAt,
    customerId: t.customerId,
    customerName: customer?.name ?? 'Гость',
    kind: t.kind,
    amount: t.amount,
    pointsDelta: t.pointsDelta,
    items: t.items,
  };
}

/** Последние операции заведения, самые свежие сверху. */
export async function recentFeed(repo: Repo, businessId: string, limit = 12): Promise<FeedRow[]> {
  const txs = await repo.listTransactions(businessId);
  const latest = [...txs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  return Promise.all(latest.map((t) => toFeedRow(repo, t)));
}
