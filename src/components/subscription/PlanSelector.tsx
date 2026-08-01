'use client';

import { useState, useTransition } from 'react';
import { changePlanAction } from '@/app/(app)/dashboard/subscription/actions';
import { Badge, Button, Card } from '@/components/ui/kit';
import { kzt, num } from '@/lib/format';
import type { Plan, PlanTier } from '@/lib/types';

export default function PlanSelector({ businessId, current, plans }: { businessId: string; current: PlanTier; plans: Plan[] }) {
  const [pending, startTransition] = useTransition(); const [selected, setSelected] = useState<PlanTier | null>(null); const [message, setMessage] = useState<string | null>(null);
  function confirm() { if (!selected) return; setMessage(null); startTransition(async () => { try { await changePlanAction({ businessId, plan: selected }); setMessage('Тариф изменён. Это демонстрационный checkout — банковские данные не использовались.'); setSelected(null); } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сменить тариф'); } }); }
  return <div className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-3">{plans.map((plan) => <Card key={plan.tier} className={`flex flex-col ${plan.tier === current ? 'border-brand' : ''}`}><div className="flex items-start justify-between gap-2"><div><h2 className="text-lg font-semibold uppercase text-ink">{plan.title}</h2><p className="mt-1 text-xs text-ink-soft">{plan.description}</p></div>{plan.tier === current ? <Badge tone="brand">Текущий</Badge> : null}</div><p className="mt-5 text-2xl font-bold text-brand">{plan.priceKzt ? `${kzt(plan.priceKzt)} / мес` : '0 ₸'}</p><ul className="my-5 space-y-2 text-sm text-ink-soft">{plan.features.map((feature) => <li key={feature}>+ {feature}</li>)}</ul><div className="mt-auto border-t border-line pt-3 text-xs text-ink-soft"><p>Клиентов: {num(plan.limits.customers)}</p><p>Рассылок/мес: {num(plan.limits.campaignsPerMonth)}</p></div><Button className="mt-4 w-full" variant={plan.tier === current ? 'ghost' : 'secondary'} disabled={plan.tier === current || pending} onClick={() => setSelected(plan.tier)}>{plan.tier === current ? 'Подключён' : 'Выбрать'}</Button></Card>)}</div>
    {selected ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><Card className="w-full max-w-md space-y-4 border-brand"><div><p className="ascii-kicker">Демо-оплата</p><h2 className="mt-1 text-lg font-semibold">Подтвердить смену тарифа?</h2></div><p className="text-sm text-ink-soft">Реальные платёжные данные не запрашиваются. В историю будет записана демонстрационная операция.</p><div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>Отмена</Button><Button className="flex-1" disabled={pending} onClick={confirm}>{pending ? 'Меняем…' : 'Подтвердить'}</Button></div></Card></div> : null}
    {message ? <p role="status" className="border border-brand bg-brand-soft px-3 py-2 text-sm text-ink">{message}</p> : null}
  </div>;
}
