'use client';

/**
 * Касса: «скан» клиента → сумма → начисление/списание → готово.
 *
 * Вызывающие: src/app/pos/page.tsx.
 * Кассир видит только это. После проведения покупки экран владельца
 * обновляется сам — через SSE-поток, к которому подписан дашборд.
 */

import { useState, useTransition } from 'react';
import { resolveClient, submitPurchase, type ResolvedClient } from '@/app/pos/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import type { PosPurchaseResult } from '@/lib/repo';
import { kzt, num } from '@/lib/format';
import { REDEEM_CONFIRM_THRESHOLD } from '@/lib/types';

export default function PosTerminal({
  businessId,
  businessName,
  staffId,
  pointsPerCurrency,
}: {
  businessId: string;
  businessName: string;
  staffId: string;
  pointsPerCurrency: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [client, setClient] = useState<ResolvedClient | null>(null);

  const [amount, setAmount] = useState('');
  const [items, setItems] = useState('');
  const [redeem, setRedeem] = useState('');

  const [result, setResult] = useState<PosPurchaseResult | null>(null);

  const accrualPreview = amount ? Math.round(Number(amount) * pointsPerCurrency) : 0;

  function reset() {
    setCode('');
    setClient(null);
    setAmount('');
    setItems('');
    setRedeem('');
    setResult(null);
    setError(null);
  }

  function onResolve() {
    setError(null);
    startTransition(async () => {
      const res = await resolveClient(businessId, code);
      if ('error' in res) {
        setError(res.error);
        setClient(null);
      } else {
        setClient(res);
      }
    });
  }

  function onSubmit() {
    if (!client) return;
    setError(null);
    startTransition(async () => {
      const res = await submitPurchase({
        businessId,
        staffId,
        qrToken: client.customer.qrToken,
        amount: Number(amount),
        items: items
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        redeemPoints: redeem ? Number(redeem) : 0,
      });
      if ('error' in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-bold text-ink">Касса</h1>
        <p className="text-sm text-ink-soft">{businessName}</p>
      </header>

      {error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {result ? (
        <Card className="space-y-3 text-center">
          <Badge tone="success">Покупка проведена</Badge>
          <p className="text-3xl font-bold tnum text-brand">
            {num(result.membership.points)} бонусов
          </p>
          <p className="text-sm text-ink-soft">Баланс клиента после операции</p>
          {result.rewardUnlocked ? (
            <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm font-medium text-ok">
              Достигнут порог награды — выдайте её клиенту
            </p>
          ) : null}
          {result.requiresConfirmation ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              Крупное списание — попросите клиента подтвердить на своём экране
            </p>
          ) : null}
          <Button className="w-full" onClick={reset}>
            Следующий клиент
          </Button>
        </Card>
      ) : !client ? (
        <Card className="space-y-3">
          <TextInput
            label="QR-код клиента или телефон"
            placeholder="qr_001_… или +7 777 …"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onResolve()}
          />
          <Button className="w-full" onClick={onResolve} disabled={pending}>
            Найти клиента
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{client.customer.name}</p>
              <p className="text-xs text-ink-soft">{client.customer.phone}</p>
            </div>
            <div className="text-right">
              <p className="tnum font-semibold text-brand">
                {num(client.membership?.points ?? 0)}
              </p>
              <p className="text-xs text-ink-soft">бонусов</p>
            </div>
          </div>

          <TextInput
            label="Сумма покупки, ₸"
            inputMode="numeric"
            placeholder="2400"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            hint={amount ? `Начислим ${num(accrualPreview)} бонусов` : undefined}
          />
          <TextInput
            label="Позиции (через запятую)"
            placeholder="Капучино, Круассан"
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
          <TextInput
            label="Списать бонусов (необязательно)"
            inputMode="numeric"
            placeholder="0"
            value={redeem}
            onChange={(e) => setRedeem(e.target.value.replace(/\D/g, ''))}
            hint={
              Number(redeem) > REDEEM_CONFIRM_THRESHOLD
                ? 'Крупное списание потребует подтверждения клиента'
                : undefined
            }
          />

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={reset}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={onSubmit} disabled={pending || !amount}>
              {pending ? 'Проводим…' : `Провести ${amount ? kzt(Number(amount)) : ''}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
