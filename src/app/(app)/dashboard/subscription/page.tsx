import PlanSelector from '@/components/subscription/PlanSelector';
import { Card } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { dateShort, kzt, num } from '@/lib/format';
import { getRepo } from '@/lib/repo';

export default async function SubscriptionPage() {
  await requireSession(['owner']);
  const repo = await getRepo(); const business = await getActiveBusiness();
  const [plans, subscription, payments, profiles, staff, branches, promos, campaigns] = await Promise.all([repo.listPlans(), repo.getSubscription(business.id), repo.listSubscriptionPayments(business.id), repo.listCustomerProfiles(business.id), repo.listStaff(business.id), repo.listBranches(business.id), repo.listPromos(business.id), repo.listCampaigns(business.id)]);
  const plan = plans.find((item) => item.tier === subscription.plan)!;
  const periodEnd = subscription.nextBillingAt ?? subscription.startedAt;
  const monthAgo = new Date(new Date(periodEnd).getTime() - 30 * 86_400_000).toISOString();
  const usage = [
    ['Клиенты', profiles.length, plan.limits.customers], ['Сотрудники', staff.filter((item) => item.active !== false).length, plan.limits.staff], ['Филиалы', branches.length, plan.limits.branches], ['Активные акции', promos.filter((item) => item.status === 'active' || item.status === 'scheduled').length, plan.limits.activePromos], ['Рассылки за 30 дней', campaigns.filter((item) => (item.sentAt ?? '') >= monthAgo).length, plan.limits.campaignsPerMonth],
  ] as const;
  return <div className="mx-auto max-w-6xl space-y-6"><header><p className="ascii-kicker">Подписка</p><h1 className="mt-1 text-2xl uppercase tracking-[0.1em]">Тариф и подписка</h1><p className="mt-1 text-sm text-ink-soft">Текущий тариф «{plan.title}»{subscription.nextBillingAt ? ` · следующее списание ${dateShort(subscription.nextBillingAt)}` : ' · без списаний'}</p></header>
    <Card><h2 className="font-semibold">Использование лимитов</h2><div className="mt-4 grid gap-4 md:grid-cols-5">{usage.map(([label, value, limit]) => <div key={label}><div className="flex justify-between text-xs text-ink-soft"><span>{label}</span><span>{num(value)} / {num(limit)}</span></div><div className="mt-2 h-2 border border-line"><div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.round(value / Math.max(1, limit) * 100))}%` }} /></div></div>)}</div></Card>
    <PlanSelector businessId={business.id} current={subscription.plan} plans={plans} />
    <details className="ascii-details border border-line bg-surface p-4"><summary className="font-semibold uppercase">История операций ({payments.length})</summary><div className="mt-4 overflow-x-auto border-t border-line pt-4"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-ink-soft"><th className="py-2">Дата</th><th>Тариф</th><th className="text-right">Сумма</th><th className="text-right">Статус</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-t border-line"><td className="py-2">{dateShort(payment.at)}</td><td>{plans.find((item) => item.tier === payment.plan)?.title}</td><td className="text-right tnum">{kzt(payment.amountKzt)}</td><td className="text-right text-ink-soft">Демо</td></tr>)}</tbody></table></div></details>
  </div>;
}
