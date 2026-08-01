import Link from 'next/link';
import { Card, EmptyState, btnClass } from '@/components/ui/kit';
import { requireSession } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/demo';
import { applyRecommendationSettings, recommend } from '@/lib/engine';
import { getRepo } from '@/lib/repo';
import type { RecommendationAction } from '@/lib/types';

const HREF: Record<RecommendationAction, string> = { create_promo: '/dashboard/promos/new', schedule_promo: '/dashboard/promos/new', send_campaign: '/dashboard/campaigns', activate_tool: '/tools', adjust_loyalty: '/dashboard/loyalty' };
const EFFECT: Record<RecommendationAction, string> = { create_promo: 'Вернуть часть аудитории и получить дополнительные визиты', schedule_promo: 'Сгладить слабый день и загрузить свободное время', send_campaign: 'Напомнить клиентам о понятной причине вернуться', activate_tool: 'Собрать больше данных и автоматизировать повторяющуюся работу', adjust_loyalty: 'Сделать награду достижимой и повысить повторные визиты' };

export default async function RecommendationsPage() {
  await requireSession(['owner', 'admin', 'marketer', 'manager']); const repo = await getRepo(); const business = await getActiveBusiness(); const [stats, segments, promos, loyalty, settings] = await Promise.all([repo.getBusinessStats(business.id), repo.listSegments(business.id), repo.listPromos(business.id), repo.getLoyaltyConfig(business.id), repo.listRecommendationSettings()]); const items = applyRecommendationSettings(recommend({ stats, segments, promos, loyalty }), settings);
  return <div className="mx-auto max-w-4xl space-y-6"><header><p className="ascii-kicker">~/localy/recommendations</p><h1 className="mt-1 text-2xl font-bold uppercase">+-- Рекомендации --+</h1><p className="mt-1 text-sm text-ink-soft">Только действия, рассчитанные из данных «{business.name}»</p></header>{items.length === 0 ? <EmptyState title="Всё под контролем" hint="Новых сигналов пока нет" /> : <div className="space-y-3">{items.map((item, index) => <Card key={item.id} className="grid gap-4 md:grid-cols-[auto_1fr_auto]"><span className="text-2xl text-brand">{String(index + 1).padStart(2, '0')}</span><div><h2 className="font-semibold text-ink">{item.title}</h2><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase text-ink-soft">Причина</dt><dd className="mt-1">{item.affectedCount} клиентов или событий попали под правило</dd></div><div><dt className="text-xs uppercase text-ink-soft">Ожидаемый эффект</dt><dd className="mt-1">{EFFECT[item.actionKind]}</dd></div></dl><p className="mt-3 text-sm text-ink-soft">&gt; {item.action}</p></div><Link href={HREF[item.actionKind]} className={btnClass('primary', 'self-start')}>Запустить</Link></Card>)}</div>}</div>;
}
