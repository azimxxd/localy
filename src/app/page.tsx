/**
 * Главная страница платформы.
 *
 * Вызывающие: роутер Next, маршрут /.
 * Требование положения: что за платформа, для кого, ценностное предложение,
 * три CTA — «Найти клиентов», «Создать акцию», «Начать использовать».
 *
 * Первый экран — анимированный halftone-арт (HalftoneArt), поверх него
 * заголовок. Арт декоративный, поэтому лежит ниже контента по z-index и
 * не перехватывает клики.
 */

import Link from 'next/link';
import HalftoneArt from '@/components/home/HalftoneArt';
import { btnClass } from '@/components/ui/kit';

const VALUE = [
  {
    index: '01',
    title: 'Единый QR клиента',
    body: 'Один аккаунт на всю сеть заведений. Балансы и история каждого бизнеса — раздельные.',
  },
  {
    index: '02',
    title: 'Активность по личной частоте',
    body: 'Не «мало ходит», а «обычно раз в 7 дней, прошло 14 — под риском». Формула сама подстраивается под нишу.',
  },
  {
    index: '03',
    title: 'Прогноз акции до запуска',
    body: 'Владелец видит ожидаемую выручку и ROI прежде, чем потратил деньги, и реальную воронку после.',
  },
];

const AUDIENCE = ['Кофейни', 'Барбершопы', 'Салоны красоты', 'Сервисы ремонта', 'Магазины'];

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-lg font-bold tracking-[0.14em] text-ink">LOCALY</span>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/discover" className={btnClass('ghost', 'hidden sm:inline-flex')}>
            Заведения
          </Link>
          <Link href="/me" className={btnClass('ghost', 'hidden sm:inline-flex')}>
            Я клиент
          </Link>
          <Link href="/login" className={btnClass('secondary')}>
            Войти
          </Link>
        </nav>
      </header>

      <section className="relative isolate mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center overflow-hidden px-5 py-16">
        <HalftoneArt className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />

        <div className="mx-auto max-w-3xl text-center">
          <p className="ascii-kicker">Платформа лояльности для офлайн-бизнеса</p>

          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            <span className="block text-ink-soft">Инструменты крупных сетей</span>
            <span className="block text-ink">для маленького бизнеса</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-ink-soft">
            Сайт, бонусная программа, клиентская база, акции и аналитика в одном сервисе.
            Без программиста и маркетолога.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-2">
            <Link href="/onboarding" className={btnClass('primary', 'px-7 py-3')}>
              Найти клиентов
            </Link>
            <Link href="/dashboard/promos/new" className={btnClass('secondary', 'px-7 py-3')}>
              Создать акцию
            </Link>
            <Link href="/onboarding" className={btnClass('ghost', 'px-7 py-3')}>
              Начать использовать платформу
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-3 text-xs text-ink-soft sm:grid-cols-3">
          <p>Один человек — один QR — все заведения.</p>
          <p className="sm:text-center">
            Система сама собирает сегменты и подсказывает, что сделать сегодня.
          </p>
          <p className="sm:text-right">[ листайте вниз ]</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="grid gap-px border border-line bg-line md:grid-cols-3">
          {VALUE.map((v) => (
            <div key={v.title} className="bg-surface p-6">
              <span className="ascii-kicker">{v.index}</span>
              <h2 className="mt-3 font-semibold uppercase tracking-[0.06em] text-ink">
                {v.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">
          {AUDIENCE.join('  ·  ')}
        </p>
      </section>
    </div>
  );
}
