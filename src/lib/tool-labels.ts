/**
 * Localy — ярлыки категорий инструментов и типов шаблонов.
 *
 * Вызывающие: админка платформы, каталог инструментов.
 * Пять категорий — требование положения, менять состав нельзя.
 */

import type { Template, ToolCategory, ToolKind } from '@/lib/types';

/** Тип шаблона — совпадает с Template['kind'] в контракте. */
type TemplateKind = Template['kind'];

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  marketing: 'Маркетинг',
  sales: 'Продажи',
  retention: 'Удержание клиентов',
  analytics: 'Аналитика',
  automation: 'Автоматизация',
};

export const TOOL_KIND_LABELS: Record<ToolKind, string> = {
  module: 'Модуль',
  automation: 'Автоматизация',
  template: 'Шаблон',
  integration: 'Интеграция',
};

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  promo: 'Акция',
  campaign: 'Рассылка',
  site: 'Сайт',
};
