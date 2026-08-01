import type { Metadata, Viewport } from 'next';
import { EB_Garamond, Forum } from 'next/font/google';
import './globals.css';

/**
 * Шрифтовая пара античной темы.
 *
 * Forum — римская капитель (по сути тот же лапидарный шрифт, что резали на
 * камне), но с кириллицей: заголовки и капслочные подписи. EB Garamond —
 * гуманистическая антиква для текста. Оба с subset cyrillic: интерфейс
 * русскоязычный, латинских Cinzel/Cormorant Garamond здесь бы не хватило.
 */
const display = Forum({
  weight: '400',
  subsets: ['cyrillic', 'latin'],
  variable: '--font-forum',
  display: 'swap',
});

const body = EB_Garamond({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-garamond',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Localy — платформа для малого офлайн-бизнеса',
  description:
    'Сайт, бонусная программа, клиентская база, акции и аналитика для кофеен, барбершопов, салонов и магазинов. Без программиста и маркетолога.',
};

/** Кассир работает с планшета, клиент — с телефона: масштабирование не ломаем. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
