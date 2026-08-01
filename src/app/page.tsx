/**
 * Главная страница платформы.
 *
 * Вызывающие: роутер Next, маршрут /.
 * Требование положения: что за платформа, для кого, ценностное предложение,
 * три CTA — «Найти клиентов», «Создать акцию», «Начать использовать».
 *
 * Первый экран — трёхколоночная композиция: ASCII-руки Микеланджело в боковых
 * полях, текст в чистом коридоре между ними. Арт живёт внутри секции (а не
 * фоном всей страницы), не перехватывает клики и ни одним символом не заходит
 * под текст — ширина коридора в AsciiHands и ширина текстового блока здесь
 * заданы одной и той же долей (38%).
 *
 * Ниже 768px боковых полей не остаётся: арт прячется, текст занимает всю
 * ширину.
 */

import Link from 'next/link';
import AsciiHands from '@/components/home/AsciiHands';
import { btnClass } from '@/components/ui/kit';

const VALUE = [
  {
    index: 'I',
    title: 'Единый QR клиента',
    body: 'Один аккаунт на всю сеть заведений. Балансы и история каждого бизнеса — раздельные.',
  },
  {
    index: 'II',
    title: 'Активность по личной частоте',
    body: 'Не «мало ходит», а «обычно раз в 7 дней, прошло 14 — под риском». Формула сама подстраивается под нишу.',
  },
  {
    index: 'III',
    title: 'Прогноз акции до запуска',
    body: 'Владелец видит ожидаемую выручку и ROI прежде, чем потратил деньги, и реальную воронку после.',
  },
];

const AUDIENCE = ['Кофейни', 'Барбершопы', 'Салоны красоты', 'Сервисы ремонта', 'Магазины'];

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="font-display text-xl tracking-[0.3em] text-ink">LOCALY</span>
        <nav className="flex items-center gap-1 text-base">
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

      <section className="relative isolate flex min-h-[80vh] flex-col justify-center overflow-hidden px-5 py-16">
        <AsciiHands className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block" />

        <div className="mx-auto w-full max-w-xl text-center md:w-[38%] md:max-w-none">
          <p className="ascii-kicker">Платформа лояльности для офлайн-бизнеса</p>

          <h1 className="mt-6 font-display text-4xl leading-[1.12] text-ink sm:text-[2.75rem] xl:text-5xl">
            Инструменты крупных сетей для маленького бизнеса
          </h1>

          <div aria-hidden className="meander mx-auto mt-7 w-32" />

          <p className="mx-auto mt-7 max-w-lg text-lg leading-relaxed text-ink-soft xl:text-xl">
            Сайт, бонусная программа, клиентская база, акции и аналитика в одном сервисе.
            Без программиста и маркетолога.
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href="/onboarding" className={btnClass('primary', 'px-7 py-3.5 text-base')}>
              Найти клиентов
            </Link>
            <Link
              href="/dashboard/promos/new"
              className={btnClass('secondary', 'px-7 py-3.5 text-base')}
            >
              Создать акцию
            </Link>
          </div>

          <p className="mt-6">
            <Link href="/onboarding" className="text-base text-brand underline underline-offset-4">
              Начать использовать платформу
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="grid gap-5 text-base text-ink-soft sm:grid-cols-3">
          <p>Один человек — один QR — все заведения.</p>
          <p className="sm:text-center">
            Система сама собирает сегменты и подсказывает, что сделать сегодня.
          </p>
          <p className="sm:text-right">[ листайте вниз ]</p>
        </div>
        <div aria-hidden className="meander mt-8 w-full" />
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-10">
        <div className="grid gap-px border border-line bg-line md:grid-cols-3">
          {VALUE.map((v) => (
            <div key={v.title} className="bg-surface p-8">
              <span className="ascii-kicker text-gold">{v.index}</span>
              <h2 className="mt-3 font-display text-2xl leading-snug text-ink xl:text-3xl">
                {v.title}
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-ink-soft">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="ascii-kicker">{AUDIENCE.join('  ·  ')}</p>
      </section>
    </div>
  );
}
