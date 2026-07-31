'use client';

/**
 * Иконка инструмента/типа бизнеса по kebab-имени lucide.
 *
 * Вызывающие: ToolCard, AdminTools, админ-страница.
 * В данных icon хранится как имя lucide («qr-code», «credit-card»).
 * DynamicIcon ищет иконку по этому имени; раньше строка выводилась как
 * текст — отсюда «megaphone» огромными буквами над названием.
 */

import { DynamicIcon } from 'lucide-react/dynamic';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof DynamicIcon>['name'];

export default function ToolIcon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return <DynamicIcon name={name as IconName} size={size} className={className} />;
}
