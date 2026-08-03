import Link from 'next/link';
import { logoutCustomer } from '@/app/me/actions';
import { getCustomerSessionId } from '@/lib/auth';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const customerId = await getCustomerSessionId();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/me" className="font-display text-lg uppercase tracking-[0.2em] text-brand">
            Localy
            <span className="ml-2 font-sans text-[10px] font-normal tracking-normal text-ink-soft">для клиентов</span>
          </Link>
          <nav aria-label="Клиентская навигация" className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/me" className="px-3 py-2 text-ink-soft hover:bg-canvas hover:text-ink">Мои карты</Link>
            {customerId ? (
              <form action={logoutCustomer}>
                <button className="px-3 py-2 text-ink-soft hover:bg-canvas hover:text-ink">Выйти</button>
              </form>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="pb-20 sm:pb-0">{children}</main>
      <nav aria-label="Мобильная клиентская навигация" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-line bg-surface/95 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-1.5 text-center backdrop-blur sm:hidden">
        <Link href="/me" className="border-t-2 border-brand px-2 py-2 text-xs text-brand">Мои карты</Link>
        {customerId ? <form action={logoutCustomer}><button className="w-full border-t-2 border-transparent px-2 py-2 text-xs text-ink-soft">Выйти</button></form> : <span />}
      </nav>
    </div>
  );
}
