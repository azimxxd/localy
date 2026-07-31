/**
 * Онбординг: цель бизнеса → План роста на 30 дней + рекомендованные инструменты.
 *
 * Вызывающие: роутер Next, маршрут /onboarding (CTA с главной).
 * Вне группы (app): это вход до кабинета. Показываем результат системы
 * рекомендаций — тип бизнеса и цели превращаются в календарь на месяц.
 */

import Link from 'next/link';
import { Badge, Card, btnClass } from '@/components/ui/kit';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import type { BusinessGoal } from '@/lib/types';

const GOAL_LABELS: Record<BusinessGoal, string> = {
  new_customers: 'Привлечь новых клиентов',
  return_customers: 'Вернуть ушедших',
  increase_check: 'Поднять средний чек',
  increase_frequency: 'Повысить частоту визитов',
  automate: 'Автоматизировать рутину',
};

export default async function OnboardingPage() {
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [plan, tools] = await Promise.all([repo.getGrowthPlan(business.id), repo.listTools()]);

  const toolTitle = (id: string) => tools.find((t) => t.id === id)?.title ?? id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <header className="text-center">
        <Link href="/" className="text-xl font-bold text-brand">
          Localy
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-ink">План роста для «{business.name}»</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {business.city} · подобран под ваш тип бизнеса и цели
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-2">
        {business.goals.map((g) => (
          <Badge key={g} tone="brand">
            {GOAL_LABELS[g]}
          </Badge>
        ))}
      </div>

      <div className="space-y-3">
        {plan.weeks.map((week) => (
          <Card key={week.week}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">
                {week.week}
              </span>
              <h2 className="font-semibold text-ink">{week.title}</h2>
            </div>
            <ul className="ml-9 list-disc space-y-1 text-sm text-ink-soft">
              {week.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
            {week.toolIds.length > 0 ? (
              <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
                {week.toolIds.map((id) => (
                  <Badge key={id} tone="muted">
                    {toolTitle(id)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-3">
        <Link href="/dashboard" className={btnClass('primary', 'px-6 py-3 text-base')}>
          Перейти в кабинет
        </Link>
        <Link href="/tools" className={btnClass('secondary', 'px-6 py-3 text-base')}>
          Открыть каталог
        </Link>
      </div>
    </div>
  );
}
