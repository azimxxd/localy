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

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 border-b border-line bg-surface px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-64 md:border-b-0 md:border-r md:py-6">
      <div className="px-2">
        <Link href="/" className="text-xl font-bold uppercase tracking-tight text-brand">
          LOCALY
        </Link>
        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-soft">&gt; business_os / v1.0</p>
      </div>

      {role !== 'platform_admin' ? <select
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
        className="border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select> : null}

      <nav aria-label="Основная навигация" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {(role === 'platform_admin' ? PLATFORM_NAV : NAV.filter((item) => item.roles.includes(role))).map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-brand bg-brand-soft text-brand' : 'text-ink-soft hover:bg-canvas hover:text-ink',
              )}
            >
              <span aria-hidden>{active ? '>' : '[ '}</span> {item.label} <span aria-hidden>{active ? '' : ' ]'}</span>
            </Link>
          );
        })}
      </nav>

      {role !== 'platform_admin' ? <nav aria-label="Настройки" className="hidden flex-col gap-1 border-t border-line pt-4 md:flex">
        <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{'// Настройки'}</span>
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
              [ {item.label} ]
            </Link>
          );
        })}
      </nav> : null}

      <div className="mt-auto hidden flex-col gap-1 border-t border-line pt-4 text-sm md:flex">
        {role !== 'platform_admin' ? <Link href="/pos" className="border border-brand px-3 py-2 text-center text-brand hover:bg-brand hover:text-canvas">
          [ Открыть кассу ]
        </Link> : null}
        {role !== 'platform_admin' ? <Link href="/me" className="px-3 py-2 text-ink-soft hover:bg-canvas">
          [ Кабинет клиента ]
        </Link> : null}
        <p className="truncate px-3 pt-2 text-xs font-medium text-ink">{userName}</p>
        <p className="px-3 text-xs text-ink-soft">{role === 'platform_admin' ? 'Админ Localy' : role}</p>
        <form action={logoutAction}>
          <button className="w-full px-3 py-2 text-left text-ink-soft hover:bg-canvas">
            &gt; Выйти
          </button>
        </form>
      </div>
    </aside>
  );
}
