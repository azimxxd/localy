import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="ru">
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
