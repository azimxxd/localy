import Link from 'next/link';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { Badge, Card, btnClass } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import type { BusinessGoal } from '@/lib/types';

const GOAL_LABELS: Record<BusinessGoal, string> = {
  create_site: 'Создать сайт',
  new_customers: 'Привлечь новых клиентов',
  return_customers: 'Вернуть ушедших',
  increase_check: 'Поднять средний чек',
  increase_frequency: 'Повысить частоту визитов',
  launch_loyalty: 'Запустить лояльность',
  collect_clients: 'Собирать клиентскую базу',
  online_booking: 'Настроить онлайн-запись',
  automate: 'Автоматизировать рутину',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  await requireSession(['owner']);
  const { done } = await searchParams;

  if (done !== '1') {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <header className="mb-6">
          <Link href="/" className="text-xl font-bold text-brand">Localy</Link>
          <h1 className="mt-4 text-3xl font-bold text-ink">Расскажите о вашем бизнесе</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            За три коротких шага создадим кабинет, сайт, программу лояльности и персональный план запуска.
          </p>
        </header>
        <OnboardingWizard />
      </main>
    );
  }

  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [plan, tools] = await Promise.all([repo.getGrowthPlan(business.id), repo.listTools()]);
  const toolTitle = (id: string) => tools.find((tool) => tool.id === id)?.title ?? id;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <header className="text-center">
        <p className="text-xl font-bold text-brand">Localy</p>
        <Badge tone="success" className="mt-4">Бизнес создан</Badge>
        <h1 className="mt-3 text-2xl font-bold text-ink">План роста для «{business.name}»</h1>
        <p className="mt-1 text-sm text-ink-soft">{business.city} · рекомендации учитывают нишу и ваши цели</p>
      </header>
      <div className="flex flex-wrap justify-center gap-2">
        {business.goals.map((goal) => <Badge key={goal} tone="brand">{GOAL_LABELS[goal]}</Badge>)}
      </div>
      <div className="space-y-3">
        {plan.weeks.map((week) => (
          <Card key={week.week}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">{week.week}</span>
              <h2 className="font-semibold text-ink">{week.title}</h2>
            </div>
            <ul className="ml-9 list-disc space-y-1 text-sm text-ink-soft">
              {week.steps.map((step) => <li key={step}>{step}</li>)}
            </ul>
            <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
              {week.toolIds.map((id) => <Badge key={id} tone="muted">{toolTitle(id)}</Badge>)}
            </div>
          </Card>
        ))}
      </div>
      <div className="flex justify-center gap-3">
        <Link href="/dashboard" className={btnClass('primary', 'px-6 py-3')}>Перейти в кабинет</Link>
        <Link href={`/b/${business.slug}`} className={btnClass('secondary', 'px-6 py-3')}>Открыть сайт</Link>
      </div>
    </main>
  );
}
