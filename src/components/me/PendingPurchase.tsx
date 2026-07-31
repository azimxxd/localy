'use client';

import { useState, useTransition } from 'react';
import { confirmPendingPurchase } from '@/app/me/actions';
import { Button, Card } from '@/components/ui/kit';
import { kzt, num } from '@/lib/format';

export default function PendingPurchase({
  id,
  businessName,
  amount,
  redeemPoints,
}: {
  id: string;
  businessName: string;
  amount: number;
  redeemPoints: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="border-warn/30 bg-warn-soft">
      <p className="text-xs font-semibold uppercase text-warn">Подтвердите списание</p>
      <p className="mt-1 font-semibold text-ink">{businessName} · {kzt(amount)}</p>
      <p className="mt-1 text-sm text-ink-soft">Будет списано {num(redeemPoints)} бонусов. До подтверждения покупка не влияет на баланс.</p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <Button className="mt-3 w-full" disabled={pending} onClick={() => startTransition(async () => {
        try { await confirmPendingPurchase(id); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Ошибка подтверждения'); }
      })}>{pending ? 'Подтверждаем…' : 'Подтвердить списание'}</Button>
    </Card>
  );
}
