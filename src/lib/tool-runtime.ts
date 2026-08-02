import type { Tool } from '@/lib/types';

export type ToolRuntime = {
  href: string;
  action: string;
  outcome: string;
};

export const TOOL_RUNTIME: Record<string, ToolRuntime> = {
  tool_promo_builder: { href: '/dashboard/promos/new', action: 'Создать акцию', outcome: 'Конструктор, прогноз и запуск акции' },
  tool_campaigns: { href: '/dashboard/campaigns', action: 'Открыть рассылки', outcome: 'Сегмент, согласия, антиспам и история кампаний' },
  tool_birthday: { href: '/dashboard/promos/new?goal=return_customers&kind=birthday&segment=birthday_soon', action: 'Подготовить подарок', outcome: 'Готовый сценарий для клиентов с ближайшим днём рождения' },
  tool_referral: { href: '/dashboard/promos/new?goal=referrals&kind=referral', action: 'Создать реферальную акцию', outcome: 'Предложение для лояльных клиентов и кассовый учёт' },
  tool_site: { href: '/dashboard/site', action: 'Настроить сайт', outcome: 'Живой предпросмотр и публикация сайта' },
  tool_qr_poster: { href: '/dashboard/qr', action: 'Скачать QR-плакат', outcome: 'Макеты для кассы, стола и двери в SVG' },
  tool_social: { href: '/tools/tool_social', action: 'Открыть шаблоны', outcome: 'Тексты для постов и сторис под нишу бизнеса' },
  tool_pos: { href: '/pos', action: 'Открыть кассу', outcome: 'Покупка по QR, бонусы, награды и акции' },
  tool_item_promo: { href: '/dashboard/promos/new?goal=sell_item&kind=item_promo', action: 'Продвинуть позицию', outcome: 'Акция на товар или услугу для подходящего сегмента' },
  tool_upsell: { href: '/tools/tool_upsell', action: 'Посмотреть допродажи', outcome: 'Подсказки на основе состава реальных чеков' },
  tool_bookings: { href: '/dashboard/bookings', action: 'Открыть запись', outcome: 'Заявки с сайта и управление статусами' },
  tool_deposits: { href: '/tools/tool_deposits', action: 'Управлять сертификатами', outcome: 'Выпуск и списание сертификатов, депозитов и абонементов' },
  tool_avg_check: { href: '/dashboard/promos/new?goal=increase_check', action: 'Создать предложение', outcome: 'Механика роста среднего чека с прогнозом' },
  tool_loyalty: { href: '/dashboard/loyalty', action: 'Настроить лояльность', outcome: 'Начисление, списание, уровни и награды' },
  tool_crm: { href: '/dashboard/crm', action: 'Открыть клиентскую базу', outcome: 'Карточки клиентов, визиты, чеки и бонусы' },
  tool_segments: { href: '/dashboard/crm', action: 'Открыть сегменты', outcome: 'Автоматически пересчитанные группы клиентов' },
  tool_winback: { href: '/dashboard/promos/new?goal=return_customers&kind=winback', action: 'Вернуть клиентов', outcome: 'Акция для тех, кто выбился из своей частоты визитов' },
  tool_expiring: { href: '/dashboard/campaigns?segment=expiring_points', action: 'Подготовить напоминание', outcome: 'Выбор клиентов со сгорающими бонусами и проверка согласий' },
  tool_return_reward: { href: '/dashboard/promos/new?goal=increase_frequency&kind=return_reward', action: 'Создать награду', outcome: 'Предложение на следующий визит и кассовый учёт' },
  tool_personal: { href: '/tools/tool_personal', action: 'Открыть предложения', outcome: 'Приоритетный список клиентов и персональные поводы' },
  tool_dashboard: { href: '/dashboard/analytics', action: 'Открыть аналитику', outcome: 'Выручка, визиты и средний чек по периодам' },
  tool_promo_roi: { href: '/dashboard/analytics', action: 'Сравнить акции', outcome: 'Выручка, стоимость и ROI завершённых акций' },
  tool_funnel: { href: '/dashboard/promos', action: 'Открыть воронки', outcome: 'Фактические визиты и применения каждой акции' },
  tool_customer_analytics: { href: '/dashboard/analytics', action: 'Смотреть клиентов', outcome: 'Новые, вернувшиеся и клиенты под риском' },
  tool_weekday: { href: '/dashboard/analytics', action: 'Смотреть загрузку', outcome: 'Посещаемость по дням недели' },
  tool_forecast: { href: '/dashboard/promos/new', action: 'Рассчитать сценарий', outcome: 'Охват, выручка, стоимость и ROI до запуска' },
  tool_recommendations: { href: '/dashboard/recommendations', action: 'Открыть рекомендации', outcome: 'Следующие действия по фактическим данным бизнеса' },
  tool_schedule: { href: '/dashboard/promos', action: 'Планировать акции', outcome: 'Даты начала, окончания и запуск по расписанию' },
  tool_roles: { href: '/dashboard/staff', action: 'Настроить роли', outcome: 'Отдельные права владельца, маркетолога, менеджера и кассира' },
  tool_notify: { href: '/dashboard/campaigns', action: 'Настроить канал', outcome: 'Доступная аудитория с учётом согласия на канал' },
  tool_antispam: { href: '/dashboard/campaigns', action: 'Проверить лимиты', outcome: 'Исключение клиентов, достигших лимита сообщений' },
};

export function runtimeFor(tool: Tool): ToolRuntime {
  return TOOL_RUNTIME[tool.id] ?? { href: `/tools/${tool.id}`, action: 'Открыть инструмент', outcome: tool.description };
}
