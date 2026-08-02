import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyToolText from '@/components/tools/CopyToolText';
import DepositManager from '@/components/tools/DepositManager';
import { Badge, Card, EmptyState, btnClass } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { kzt, num } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { runtimeFor } from '@/lib/tool-runtime';

function fillTemplate(body: string, businessName: string) {
  const date = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('ru-RU');
  return body
    .replaceAll('{name}', 'Друзья')
    .replaceAll('{date}', date)
    .replaceAll('{value}', '15')
    .replaceAll('{reward}', 'подарок')
    .replaceAll('{points}', '500')
    .replaceAll('{days}', '14')
    .replaceAll('{weekday}', 'в будни')
    .replaceAll('{item}', 'любимая позиция')
    .replaceAll('{item2}', 'приятное дополнение')
    .replaceAll('{months}', 'несколько')
    .concat(`\n\n${businessName}`);
}

export default async function ToolWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession(['owner', 'admin']);
  const { id } = await params;
  const repo = await getRepo();
  const business = await getActiveBusiness();
  const [tool, businessTools] = await Promise.all([repo.getTool(id), repo.listBusinessTools(business.id)]);
  if (!tool || (tool.forTypes.length > 0 && !tool.forTypes.includes(business.typeCode))) notFound();
  const runtime = runtimeFor(tool);
  const active = businessTools.some((item) => item.toolId === id && item.activatedAt);

  let content: React.ReactNode;

  if (id === 'tool_social') {
    const templates = (await repo.listTemplates(business.typeCode)).filter((template) => template.kind === 'promo' || template.kind === 'campaign');
    content = <div className="grid gap-3 md:grid-cols-2">{templates.map((template) => { const text = fillTemplate(template.body, business.name); return <Card key={template.id} className="flex flex-col gap-3"><div><Badge tone="brand">{template.kind === 'promo' ? 'Пост об акции' : 'Сообщение'}</Badge><h2 className="mt-2 font-semibold">{template.title}</h2></div><p className="whitespace-pre-wrap text-sm text-ink-soft">{text}</p><div className="mt-auto"><CopyToolText text={text} /></div></Card>; })}</div>;
  } else if (id === 'tool_upsell') {
    const transactions = (await repo.listTransactions(business.id)).filter((transaction) => transaction.kind === 'purchase');
    const pairCounts = new Map<string, number>();
    transactions.forEach((transaction) => {
      const items = [...new Set(transaction.items.map((item) => item.trim()).filter(Boolean))].sort();
      for (let left = 0; left < items.length; left += 1) for (let right = left + 1; right < items.length; right += 1) {
        const key = `${items[left]}|||${items[right]}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    });
    const pairs = [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    content = pairs.length === 0 ? <EmptyState title="Недостаточно чеков с несколькими позициями" hint="Проводите состав покупки на кассе — подсказки появятся автоматически" /> : <div className="grid gap-3 md:grid-cols-2">{pairs.map(([key, count], index) => { const [first, second] = key.split('|||'); return <Card key={key}><p className="ascii-kicker">Подсказка {index + 1}</p><h2 className="mt-2 font-semibold">К «{first}» предложите «{second}»</h2><p className="mt-2 text-sm text-ink-soft">Встречались вместе в {num(count)} чеках. Используйте эту пару на кассе или в акции.</p><Link href="/dashboard/promos/new?goal=increase_check" className={btnClass('secondary', 'mt-3')}>Создать комбо</Link></Card>; })}</div>;
  } else if (id === 'tool_personal') {
    const profiles = await repo.listCustomerProfiles(business.id);
    const ranked = profiles.slice().sort((a, b) => {
      const score = (profile: typeof a) => (profile.activity === 'lapsed' ? 100 : profile.activity === 'at_risk' ? 70 : profile.activity === 'declining' ? 40 : 0) + Math.min(30, profile.membership.points / 100);
      return score(b) - score(a);
    }).slice(0, 20);
    content = <Card className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-ink-soft"><th className="px-4 py-3">Клиент</th><th className="px-4 py-3">Сигнал</th><th className="px-4 py-3">Предложение</th><th className="px-4 py-3"></th></tr></thead><tbody>{ranked.map((profile) => { const offer = profile.activity === 'lapsed' ? `Повод вернуться: скидка 15%` : profile.membership.points >= 500 ? `Напомнить про ${num(profile.membership.points)} бонусов` : profile.level === 'loyal' ? 'Подарок за лояльность' : 'Бонус на следующий визит'; return <tr key={profile.customer.id} className="border-b border-line"><td className="px-4 py-3"><p className="font-medium">{profile.customer.name}</p><p className="text-xs text-ink-soft">средний чек {kzt(profile.avgCheck)}</p></td><td className="px-4 py-3 text-ink-soft">{profile.daysSinceLastVisit} дней без визита</td><td className="px-4 py-3">{offer}</td><td className="px-4 py-3"><Link className="text-brand hover:underline" href={`/dashboard/crm/${profile.customer.id}`}>Открыть →</Link></td></tr>; })}</tbody></table></div></Card>;
  } else if (id === 'tool_deposits') {
    const [profiles, deposits] = await Promise.all([repo.listCustomerProfiles(business.id), repo.listDeposits(business.id)]);
    const names = new Map(profiles.map((profile) => [profile.customer.id, profile.customer.name]));
    content = <DepositManager customers={profiles.map((profile) => ({ id: profile.customer.id, name: profile.customer.name, phone: profile.customer.phone }))} deposits={deposits.map((deposit) => ({ ...deposit, customerName: names.get(deposit.customerId) ?? 'Клиент' }))} />;
  } else {
    content = <Card><h2 className="text-lg font-semibold">Инструмент готов к работе</h2><p className="mt-2 text-sm text-ink-soft">{runtime.outcome}</p><Link href={runtime.href} className={btnClass('primary', 'mt-4')}>{runtime.action}</Link></Card>;
  }

  return <div className="mx-auto max-w-5xl space-y-5"><Link href="/tools" className="text-sm text-ink-soft hover:text-brand">← К каталогу</Link><header><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{tool.title}</h1><Badge tone={active ? 'success' : 'muted'}>{active ? 'В моих инструментах' : 'Не добавлен'}</Badge></div><p className="mt-1 text-sm text-ink-soft">{runtime.outcome}</p></header>{content}</div>;
}
