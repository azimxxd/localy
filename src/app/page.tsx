/**
 * Главная страница платформы.
 *
 * Вызывающие: роутер Next, маршрут /.
 * Требование положения: что за платформа, для кого, ценностное предложение,
 * три CTA — «Найти клиентов», «Создать акцию», «Начать использовать».
 */

import Link from 'next/link';
import { btnClass } from '@/components/ui/kit';

const VALUE = [
  {
    title: 'Единый QR клиента',
    body: 'Один аккаунт на всю сеть заведений. Балансы и история каждого бизнеса — раздельные.',
  },
  {
    title: 'Активность по личной частоте',
    body: 'Не «мало ходит», а «обычно раз в 7 дней, прошло 14 — под риском». Формула сама подстраивается под нишу.',
  },
  {
    title: 'Прогноз акции до запуска',
    body: 'Владелец видит ожидаемую выручку и ROI прежде, чем потратил деньги, и реальную воронку после.',
  },
];

const AUDIENCE = ['Кофейни', 'Барбершопы', 'Салоны красоты', 'Сервисы ремонта', 'Магазины'];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="flex items-center justify-between">
        <span className="text-2xl font-bold text-brand">Localy</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/dashboard" className={btnClass('ghost')}>
            Кабинет бизнеса
          </Link>
          <Link href="/me" className={btnClass('secondary')}>
            Я клиент
          </Link>
        </nav>
      </header>

      <section className="py-16 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-ink md:text-5xl">
          Инструменты крупных сетей — для малого офлайн-бизнеса
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">
          Сайт, бонусная программа, клиентская база, акции и аналитика в одном сервисе. Без
          программиста и маркетолога.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/onboarding" className={btnClass('primary', 'px-6 py-3 text-base')}>
            Найти клиентов
          </Link>
          <Link href="/dashboard/promos" className={btnClass('secondary', 'px-6 py-3 text-base')}>
            Создать акцию
          </Link>
          <Link href="/onboarding" className={btnClass('ghost', 'px-6 py-3 text-base')}>
            Начать использовать платформу
          </Link>
        </div>

        <p className="mt-6 text-sm text-ink-soft">Для {AUDIENCE.join(' · ')}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {VALUE.map((v) => (
          <div key={v.title} className="rounded-card border border-line bg-surface p-6">
            <h2 className="font-semibold text-ink">{v.title}</h2>
            <p className="mt-2 text-sm text-ink-soft">{v.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
