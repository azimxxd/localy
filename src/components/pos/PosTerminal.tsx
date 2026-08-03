'use client';

/**
 * Касса: «скан» клиента → сумма → начисление/списание → готово.
 *
 * Вызывающие: src/app/pos/page.tsx.
 * Кассир видит только это. После проведения покупки экран владельца
 * обновляется сам — через SSE-поток, к которому подписан дашборд.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { resolveClient, submitPurchase, type ResolvedClient } from '@/app/pos/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import type { PosPurchaseResult } from '@/lib/repo';
import type { PromoKind } from '@/lib/types';
import { kzt, num } from '@/lib/format';
import { promoEffectText, promoSavingsFor } from '@/lib/promo-runtime';
import { REDEEM_CONFIRM_THRESHOLD } from '@/lib/types';
import QrScanner from '@/components/pos/QrScanner';

export default function PosTerminal({
  businessId,
  businessName,
  staffId,
  canOpenCrm,
  pointsPerCurrency,
  promos,
}: {
  businessId: string;
  businessName: string;
  staffId: string;
  canOpenCrm: boolean;
  pointsPerCurrency: number;
  promos: { id: string; title: string; promocode: string; kind: PromoKind; value: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [client, setClient] = useState<ResolvedClient | null>(null);

  const [amount, setAmount] = useState('');
  const [items, setItems] = useState('');
  const [redeem, setRedeem] = useState('');
  const [promoId, setPromoId] = useState('');
  const [claimReward, setClaimReward] = useState(false);

  const [result, setResult] = useState<PosPurchaseResult | null>(null);

  const selectedPromo = promos.find((promo) => promo.id === promoId);
  const promoSavings = selectedPromo ? promoSavingsFor(selectedPromo, Number(amount) || 0, items.split(',').map((item) => item.trim()).filter(Boolean)) : 0;
  const payableAmount = Math.max(0, (Number(amount) || 0) - promoSavings);
  const accrualPreview = amount ? Math.round(payableAmount * pointsPerCurrency) : 0;

  function reset() {
    setCode('');
    setClient(null);
    setAmount('');
    setItems('');
    setRedeem('');
    setPromoId('');
    setClaimReward(false);
    setResult(null);
    setError(null);
  }

  function onResolve(override?: string) {
    const search = override ?? code;
    setError(null);
    startTransition(async () => {
      const res = await resolveClient(businessId, search);
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
        customerId: client.customer.id,
        amount: Number(amount),
        items: items
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        redeemPoints: redeem ? Number(redeem) : 0,
        promoId: promoId || null,
        claimReward,
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
          <Badge tone={result.requiresConfirmation ? 'warning' : 'success'}>
            {result.requiresConfirmation ? 'Ожидает подтверждения' : 'Покупка проведена'}
          </Badge>
          <p className="text-3xl font-bold tnum text-brand">
            {num(result.membership.points)} бонусов
          </p>
          <p className="text-sm text-ink-soft">
            {client?.customer.name ?? 'Клиент'} · баланс после операции
          </p>
          <div className="rounded-xl border border-line bg-canvas px-3 py-2 text-left text-sm">
            <p className="font-medium text-ink">
              {result.transaction.items.length ? result.transaction.items.join(', ') : 'Покупка'}
            </p>
            <p className="text-xs text-ink-soft">
              {result.transaction.originalAmount ? `${kzt(result.transaction.originalAmount)} → ${kzt(result.transaction.amount)} · скидка ${kzt(result.transaction.discountAmount ?? 0)}` : kzt(result.transaction.amount)}{' '}
              · {result.transaction.status === 'completed' ? 'записано в историю' : 'ожидает подтверждения'}
            </p>
          </div>
          {result.rewardUnlocked ? (
            <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm font-medium text-ok">
              Достигнут порог награды — выдайте её клиенту
            </p>
          ) : null}
          {result.requiresConfirmation ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
            Покупка уже появилась в истории, но списание бонусов завершится после подтверждения клиента в его кабинете.
            </p>
          ) : null}
          {canOpenCrm ? (
            <Link
              href={`/dashboard/crm/${result.transaction.customerId}`}
              className="block text-sm text-brand underline underline-offset-2"
            >
              Открыть карточку клиента и историю
            </Link>
          ) : null}
          <Button className="w-full" onClick={reset}>
            Следующий клиент
          </Button>
        </Card>
      ) : !client ? (
        <Card className="space-y-3">
          <QrScanner onScan={(value) => { setCode(value); onResolve(value); }} />
          <TextInput
            label="QR, имя, телефон, ID или код карты"
            placeholder="Отсканируйте QR или введите данные"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onResolve()}
          />
          <Button className="w-full" onClick={() => onResolve()} disabled={pending}>
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
          {promos.length ? <label className="block text-sm"><span className="mb-1 block font-medium">Акция или промокод</span><select className="w-full border border-line px-3 py-2.5" value={promoId} onChange={(e) => setPromoId(e.target.value)}><option value="">Без акции</option>{promos.map((promo) => <option key={promo.id} value={promo.id}>{promo.title} · {promo.promocode}</option>)}</select></label> : null}
          <label className={`flex items-start gap-2 border p-3 text-sm ${client.rewardAvailable ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-soft'}`}><input type="checkbox" checked={claimReward} disabled={!client.rewardAvailable} onChange={(e) => setClaimReward(e.target.checked)} /><span>{client.rewardAvailable ? `Применить награду: ${client.rewardTitle}` : `До награды «${client.rewardTitle}» ещё ${client.visitsToReward} виз.`}</span></label>
          <TextInput
            label="Позиции (через запятую)"
            placeholder="Капучино, Круассан"
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
          {selectedPromo ? <p className="rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-ink">{promoEffectText(selectedPromo, promoSavings)}{promoSavings > 0 ? ` · к оплате ${kzt(payableAmount)}` : ''}</p> : null}
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
              {pending ? 'Проводим…' : `Провести ${amount ? kzt(payableAmount) : ''}`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
