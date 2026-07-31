/**
 * Localy — склейка классов Tailwind.
 *
 * Вызывающие: все компоненты в src/components и src/app.
 * twMerge нужен, чтобы проп className извне переопределял базовые классы
 * компонента, а не соседствовал с ними.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
