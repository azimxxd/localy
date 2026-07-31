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
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/dashboard', label: 'Обзор' },
  { href: '/dashboard/crm', label: 'Клиенты' },
  { href: '/dashboard/promos', label: 'Акции' },
  { href: '/dashboard/campaigns', label: 'Рассылки' },
  { href: '/dashboard/analytics', label: 'Аналитика' },
  { href: '/tools', label: 'Каталог' },
];

const SETTINGS_NAV = [
  { href: '/dashboard/loyalty', label: 'Лояльность' },
  { href: '/dashboard/staff', label: 'Сотрудники' },
  { href: '/dashboard/branches', label: 'Филиалы' },
  { href: '/dashboard/bookings', label: 'Запись' },
];

export default function Sidebar({
  businesses,
  activeId,
}: {
  businesses: { id: string; name: string }[];
  activeId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-5">
      <Link href="/" className="px-2 text-xl font-bold text-brand">
        Localy
      </Link>

      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(async () => {
            await switchBusiness(id);
            router.refresh();
          });
        }}
        className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="flex flex-col gap-1 border-t border-line pt-4">
        <span className="px-3 pb-1 text-xs font-semibold uppercase text-ink-soft">Настройки</span>
        {SETTINGS_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-canvas',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4 text-sm">
        <Link href="/pos" className="rounded-xl px-3 py-2 text-ink-soft hover:bg-canvas">
          Касса
        </Link>
        <Link href="/me" className="rounded-xl px-3 py-2 text-ink-soft hover:bg-canvas">
          Кабинет клиента
        </Link>
        <Link href="/admin" className="rounded-xl px-3 py-2 text-ink-soft hover:bg-canvas">
          Админ платформы
        </Link>
      </div>
    </aside>
  );
}
