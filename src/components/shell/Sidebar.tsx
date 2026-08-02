'use client';

/**
 * Боковая навигация кабинета владельца + переключатель заведения (демо).
 *
 * Вызывающие: src/app/(app)/layout.tsx.
 * Список заведений и активный id приходят с сервера пропсами — здесь только
 * навигация и вызов server action switchBusiness с последующим refresh.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { switchBusiness } from '@/app/(app)/actions';
import { logoutAction } from '@/app/login/actions';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/types';

const NAV = [
  { href: '/dashboard', label: 'Обзор', roles: ['owner', 'admin', 'marketer', 'manager'] },
  { href: '/dashboard/crm', label: 'Клиенты', roles: ['owner', 'admin', 'marketer', 'manager'] },
  { href: '/dashboard/promos', label: 'Акции', roles: ['owner', 'admin', 'marketer', 'manager'] },
  { href: '/dashboard/campaigns', label: 'Рассылки', roles: ['owner', 'admin', 'marketer'] },
  { href: '/dashboard/analytics', label: 'Аналитика', roles: ['owner', 'admin', 'marketer'] },
  { href: '/dashboard/recommendations', label: 'Рекомендации', roles: ['owner', 'admin', 'marketer', 'manager'] },
  { href: '/dashboard/site', label: 'Сайт бизнеса', roles: ['owner', 'admin'] },
  { href: '/dashboard/qr', label: 'QR бизнеса', roles: ['owner', 'admin', 'manager'] },
  { href: '/tools', label: 'Каталог', roles: ['owner', 'admin'] },
];

const SETTINGS_NAV = [
  { href: '/dashboard/loyalty', label: 'Лояльность', roles: ['owner', 'admin'] },
  { href: '/dashboard/staff', label: 'Сотрудники', roles: ['owner', 'admin'] },
  { href: '/dashboard/branches', label: 'Филиалы', roles: ['owner', 'admin', 'manager'] },
  { href: '/dashboard/bookings', label: 'Запись', roles: ['owner', 'admin', 'manager'] },
  { href: '/dashboard/subscription', label: 'Тариф и подписка', roles: ['owner'] },
];

const PLATFORM_NAV = [
  { href: '/admin', label: 'Управление' },
  { href: '/admin/stats', label: 'Аналитика платформы' },
];

export default function Sidebar({
  businesses,
  activeId,
  role,
  userName,
}: {
  businesses: { id: string; name: string }[];
  activeId: string;
  role: UserRole;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const mainItems = role === 'platform_admin' ? PLATFORM_NAV : NAV.filter((item) => item.roles.includes(role));
  const settingsItems = role === 'platform_admin' ? [] : SETTINGS_NAV.filter((item) => item.roles.includes(role));
  const preferredMobile = role === 'platform_admin'
    ? ['/admin', '/admin/stats']
    : role === 'marketer'
      ? ['/dashboard', '/dashboard/crm', '/dashboard/promos', '/dashboard/campaigns', '/dashboard/analytics']
      : role === 'manager'
        ? ['/dashboard', '/dashboard/crm', '/dashboard/promos', '/dashboard/bookings', '/dashboard/qr']
        : ['/dashboard', '/dashboard/crm', '/dashboard/promos', '/dashboard/site', '/tools'];
  const mobileItems = [...mainItems, ...settingsItems].filter((item) => preferredMobile.includes(item.href)).sort((a, b) => preferredMobile.indexOf(a.href) - preferredMobile.indexOf(b.href));
  const isActive = (href: string) => href === '/dashboard' || href === '/admin' ? pathname === href : pathname.startsWith(href);
  const closeMobileMenu = (target: HTMLElement) => { const details = target.closest('details'); if (details) details.open = false; };

  return (
    <aside className="sticky top-0 z-40 flex w-full shrink-0 flex-col gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:static md:min-h-dvh md:w-64 md:self-stretch md:gap-5 md:border-b-0 md:border-r md:bg-surface md:py-6">
      <div className="flex items-center justify-between gap-3 px-1 md:block md:px-2">
        <div>
        <Link href="/" className="font-display text-xl uppercase tracking-[0.24em] text-brand">
          LOCALY
        </Link>
        <p className="hidden md:mt-1 md:block md:text-xs md:uppercase md:tracking-[0.14em] md:text-ink-soft">Кабинет бизнеса</p>
        </div>
        <details className="relative md:hidden">
          <summary className="list-none border border-line px-3 py-2 text-sm font-semibold text-ink">Все разделы</summary>
          <div className="fixed inset-x-3 top-16 z-50 max-h-[72vh] overflow-y-auto border border-line bg-surface p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-line pb-2"><div><p className="font-semibold text-ink">{userName}</p><p className="text-xs text-ink-soft">Навигация и настройки</p></div><span className="text-xs text-ink-soft">Выберите раздел</span></div>
            <nav className="grid grid-cols-2 gap-2">{[...mainItems, ...settingsItems].map((item) => <Link key={item.href} href={item.href} onClick={(event) => closeMobileMenu(event.currentTarget)} className={cn('border px-3 py-3 text-sm', isActive(item.href) ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink')}>{item.label}</Link>)}</nav>
            {role !== 'platform_admin' ? <Link href="/pos" onClick={(event) => closeMobileMenu(event.currentTarget)} className="mt-3 block border border-brand px-3 py-3 text-center text-sm font-semibold text-brand">Открыть кассу</Link> : null}
            <form action={logoutAction} className="mt-3 border-t border-line pt-3"><button className="w-full px-3 py-2 text-left text-sm text-ink-soft">Выйти из кабинета</button></form>
          </div>
        </details>
      </div>

      {role !== 'platform_admin' && businesses.length > 1 ? <select
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await switchBusiness(id);
            router.refresh();
          });
        }}
        aria-label="Выбрать бизнес"
        className="w-full border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select> : role !== 'platform_admin' ? <p className="hidden truncate border border-line bg-canvas px-3 py-2 text-sm text-ink md:block">{businesses[0]?.name}</p> : null}

      <nav aria-label="Основная навигация" className="hidden gap-1 md:flex md:flex-col">
        {mainItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-brand bg-brand-soft text-brand' : 'text-ink-soft hover:bg-canvas hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Быстрая мобильная навигация" className="fixed inset-x-0 bottom-0 z-50 grid border-t border-line bg-surface/95 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${Math.max(1, mobileItems.length)}, minmax(0, 1fr))` }}>
        {mobileItems.map((item) => <Link key={item.href} href={item.href} className={cn('min-w-0 border-t-2 px-1 py-2 text-center text-[11px] leading-tight', isActive(item.href) ? 'border-brand text-brand' : 'border-transparent text-ink-soft')}>{item.label.replace('Сайт бизнеса', 'Сайт')}</Link>)}
      </nav>

      {role !== 'platform_admin' ? <nav aria-label="Настройки" className="hidden flex-col gap-1 border-t border-line pt-4 md:flex">
        <span className="ascii-kicker px-3 pb-1">Настройки</span>
        {SETTINGS_NAV.filter((item) => item.roles.includes(role)).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-brand bg-brand-soft text-brand' : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav> : null}

      <div className="mt-auto hidden flex-col gap-2 border-t border-line pt-4 text-sm md:flex">
        {role !== 'platform_admin' ? <Link href="/pos" className="border border-brand px-3 py-2 text-center text-brand hover:bg-brand hover:text-canvas">
          Открыть кассу
        </Link> : null}
        <div className="overflow-hidden border border-line bg-canvas">
          <div className="px-3 py-2.5">
            <p className="truncate text-xs font-medium text-ink">{userName}</p>
            <p className="mt-1 text-xs text-ink-soft">{role === 'platform_admin' ? 'Адин Localy' : role}</p>
          </div>
          <form action={logoutAction} className="border-t border-line">
            <button className="w-full px-3 py-2.5 text-left text-ink-soft hover:bg-surface hover:text-ink">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
