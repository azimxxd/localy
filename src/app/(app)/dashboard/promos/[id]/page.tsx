/**
 * Итог акции: прогноз до запуска, воронка после.
 *
 * Вызывающие: роутер Next, маршрут /dashboard/promos/[id].
 * Воронка — не «отправлено сообщений», а деньги:
 * получили → открыли → пришли → использовали → выручка.
 */

import Link from 'next/link';
import LaunchButton from '@/components/promos/LaunchButton';
import PromoActions from '@/components/promos/PromoActions';
import { Badge, Card, EmptyState, Stat } from '@/components/ui/kit';
import { SEGMENT_META } from '@/lib/engine';
import { kzt, num, percent } from '@/lib/format';
import { PROMO_GOAL_LABELS, PROMO_KIND_LABELS, PROMO_PLACEMENT_LABELS, PROMO_STATUS_LABELS } from '@/lib/promo-labels';
import { getRepo } from '@/lib/repo';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';

export default async function PromoResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession(['owner', 'admin', 'marketer']);
  const { id } = await params;
  const repo = await getRepo();
  const promo = await repo.getPromo(id);
  const business = await getActiveBusiness();
  if (!promo || promo.businessId !== business.id) {
    return <EmptyState title="Акция не найдена" />;
  }

  const hasRun = promo.status === 'active' || promo.status === 'paused' || promo.status === 'finished';
  const isPublicAcquisition = promo.audienceMode === 'public' || promo.goal === 'new_customers';
  const [funnel, branches] = await Promise.all([
    hasRun ? repo.getPromoFunnel(id) : Promise.resolve(null),
    repo.listBranches(business.id),
  ]);

  const stages = funnel
    ? [
        { label: 'Получили', value: funnel.sent },
        { label: 'Открыли', value: funnel.opened },
        { label: 'Перешли', value: funnel.clicked },
        { label: 'Пришли', value: funnel.visited },
        { label: 'Использовали', value: funnel.redeemed },
      ]
    : [];
  const visibleStages = isPublicAcquisition ? stages.filter((stage) => stage.label === 'Пришли' || stage.label === 'Использовали') : stages;
  const max = funnel ? (isPublicAcquisition ? Math.max(1, promo.audienceSize, funnel.visited, funnel.redeemed) : Math.max(1, funnel.sent)) : 1;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/promos" className="text-sm text-ink-soft hover:text-brand">
        ← К списку акций
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{promo.title}</h1>
          <p className="text-sm text-ink-soft">
            {[PROMO_KIND_LABELS[promo.kind], promo.goal ? PROMO_GOAL_LABELS[promo.goal] : null].filter(Boolean).join(' · ')} ·{' '}
            {isPublicAcquisition ? `оценочный охват ${num(promo.audienceSize)}` : `${SEGMENT_META[promo.segment].title} · ${num(promo.audienceSize)} чел`}
          </p>
        </div>
        <Badge tone={promo.status === 'active' ? 'success' : 'brand'}>
          {PROMO_STATUS_LABELS[promo.status]}
        </Badge>
      </header>

      <PromoActions promo={promo} branches={branches} />

      <Card className="space-y-2"><h2 className="font-semibold">Как работает акция</h2><p className="text-sm text-ink-soft">{isPublicAcquisition ? 'Привлекает ещё не зарегистрированных людей. Охват до запуска — оценка; визиты и применения фиксируются по кассе.' : `Акция нацелена на CRM-сегмент «${SEGMENT_META[promo.segment].title}». Публикация акции не отправляет сообщения: для доставки запустите отдельную рассылку.`}</p><div className="flex flex-wrap gap-2">{(promo.placements ?? []).map((placement) => <Badge key={placement} tone="muted">{PROMO_PLACEMENT_LABELS[placement]}</Badge>)}</div><p className="text-xs text-ink-soft">Промокод: <span className="font-semibold text-ink">{promo.promocode}</span> · с {new Date(promo.startsAt).toLocaleDateString('ru-RU')} до {new Date(promo.endsAt).toLocaleDateString('ru-RU')}</p>{promo.status === 'active' || promo.status === 'scheduled' ? <p className="text-xs text-warn">После даты окончания акция автоматически завершится. Если черновик пролежал до этой даты, кнопка «Запустить сейчас» перенесёт срок вперёд.</p> : promo.status === 'finished' ? <p className="text-xs text-ink-soft">Акция завершена по сроку. Её можно дублировать и запустить новым периодом.</p> : null}</Card>

      {funnel ? (
        <>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Воронка</h2>
            {isPublicAcquisition && funnel.visited === 0 && funnel.redeemed === 0 ? <p className="text-sm text-ink-soft">Пока нет зафиксированных визитов или применений. Оценочный охват не выдаётся за фактические показы.</p> : null}
            {visibleStages.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-soft">{s.label}</span>
                  <span className="tnum font-medium text-ink">
                    {num(s.value)} · {percent(s.value / max)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((s.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
          <Stat label="Выручка с акции" value={kzt(funnel.revenue)} />
        </>
      ) : promo.forecast ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Прогноз до запуска</h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Придут снова" value={num(promo.forecast.expectedReturns)} />
            <Stat label="Новые клиенты" value={num(promo.forecast.expectedNewCustomers)} />
            <Stat label="Ожидаемая выручка" value={kzt(promo.forecast.expectedRevenue)} />
            <Stat label="Стоимость предложения" value={kzt(promo.forecast.expectedCost)} />
            <Stat label="Окупаемость" value={`${promo.forecast.roi}×`} />
            <Stat label="Безубыточная скидка" value={`${promo.forecast.breakEvenDiscount}%`} />
          </div>
          <p className="text-sm text-ink-soft">
            Акция ещё не запущена — показан прогноз. После запуска здесь появится воронка.
          </p>
          <LaunchButton promoId={promo.id} />
        </Card>
      ) : (
        <EmptyState title="Нет данных по акции" />
      )}
    </div>
  );
}
