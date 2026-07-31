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

  function save() {
    start(async () => {
      await updateLoyalty(config.businessId, {
        pointsPerCurrency: percent / 100,
        rewardThreshold: threshold,
        rewardTitle: title,
        expiryDays: expiry > 0 ? expiry : null,
      });
      setSaved(true);
      router.refresh();
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
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        {saved && !pending ? <span className="text-sm text-ok">Сохранено</span> : null}
      </div>
    </Card>
  );
}
