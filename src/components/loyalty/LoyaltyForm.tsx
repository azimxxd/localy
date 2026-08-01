'use client';

/**
 * Форма настройки бонусной программы.
 *
 * Вызывающие: src/app/(app)/dashboard/loyalty/page.tsx.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateLoyalty } from '@/app/(app)/dashboard/loyalty/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';
import type { LoyaltyConfig } from '@/lib/types';

export default function LoyaltyForm({ config }: { config: LoyaltyConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const [percent, setPercent] = useState(Math.round(config.pointsPerCurrency * 100));
  const [threshold, setThreshold] = useState(config.rewardThreshold);
  const [title, setTitle] = useState(config.rewardTitle);
  const [expiry, setExpiry] = useState(config.expiryDays ?? 0);
  const [maxRedemption, setMaxRedemption] = useState(config.maxRedemptionPercent ?? 20);
  const [startBonus, setStartBonus] = useState(config.startBonus ?? 100);
  const [minPurchase, setMinPurchase] = useState(config.minPurchaseAmount ?? 500);
  const [rewardVisits, setRewardVisits] = useState(config.rewardEveryVisits ?? 6);
  const [excluded, setExcluded] = useState((config.excludedItems ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateLoyalty(config.businessId, {
          pointsPerCurrency: percent / 100,
          rewardThreshold: threshold,
          rewardTitle: title,
          expiryDays: expiry > 0 ? expiry : null,
          maxRedemptionPercent: maxRedemption,
          startBonus,
          minPurchaseAmount: minPurchase,
          rewardEveryVisits: rewardVisits,
          excludedItems: excluded.split(',').map((item) => item.trim()).filter(Boolean),
        });
        setSaved(true);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Не удалось сохранить');
      }
    });
  }

  return (
    <Card className="space-y-3">
      <TextInput
        label="Начисление, % с покупки"
        inputMode="numeric"
        value={String(percent)}
        onChange={(e) => setPercent(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <TextInput
        label="Порог награды, бонусов"
        inputMode="numeric"
        value={String(threshold)}
        onChange={(e) => setThreshold(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <TextInput label="Название награды" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextInput
        label="Сгорание бонусов, дней (0 — не сгорают)"
        inputMode="numeric"
        value={String(expiry)}
        onChange={(e) => setExpiry(Number(e.target.value.replace(/\D/g, '')) || 0)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Максимум оплаты бонусами, %" inputMode="numeric" value={String(maxRedemption)} onChange={(e) => setMaxRedemption(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        <TextInput label="Стартовый бонус" inputMode="numeric" value={String(startBonus)} onChange={(e) => setStartBonus(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        <TextInput label="Минимальная покупка, ₸" inputMode="numeric" value={String(minPurchase)} onChange={(e) => setMinPurchase(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        <TextInput label="Награда каждые N визитов" inputMode="numeric" value={String(rewardVisits)} onChange={(e) => setRewardVisits(Number(e.target.value.replace(/\D/g, '')) || 0)} />
      </div>
      <TextInput label="Исключённые товары (через запятую)" value={excluded} onChange={(e) => setExcluded(e.target.value)} hint="На эти позиции бонусы не начисляются и не списываются." />
      {error ? <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        {saved && !pending ? <span className="text-sm text-ok">Сохранено</span> : null}
      </div>
    </Card>
  );
}
