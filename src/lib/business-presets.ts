import type { BusinessTypeCode } from '@/lib/types';

export interface BusinessPreset {
  label: string;
  offerings: string[];
  avgCheck: number;
  repeatVisitDays: number;
  socials: string[];
  catalogTitle: string;
  catalogCategory: string;
  rewardTitle: string;
  workHours: string;
  brandColor: string;
}

export const BUSINESS_PRESETS: Record<BusinessTypeCode, BusinessPreset> = {
  coffee: { label: 'Кофейня или кондитерская', offerings: ['Капучино', 'Латте', 'Раф', 'Американо', 'Круассан', 'Чизкейк'], avgCheck: 2500, repeatVisitDays: 5, socials: ['Instagram', 'WhatsApp', '2GIS'], catalogTitle: 'Меню', catalogCategory: 'Меню', rewardTitle: 'Шестой напиток бесплатно', workHours: 'Ежедневно, 08:00–22:00', brandColor: '#7c4dff' },
  barber: { label: 'Барбершоп', offerings: ['Мужская стрижка', 'Стрижка бороды', 'Комплекс: стрижка + борода', 'Королевское бритьё', 'Детская стрижка', 'Камуфляж седины'], avgCheck: 7000, repeatVisitDays: 28, socials: ['Instagram', 'WhatsApp', 'Telegram', '2GIS'], catalogTitle: 'Услуги и цены', catalogCategory: 'Услуги', rewardTitle: 'Скидка 20% на следующую стрижку', workHours: 'Ежедневно, 10:00–22:00', brandColor: '#0f172a' },
  beauty: { label: 'Салон красоты / специалист', offerings: ['Маникюр', 'Педикюр', 'Стрижка и укладка', 'Окрашивание', 'Брови и ресницы', 'Уход за лицом'], avgCheck: 12000, repeatVisitDays: 24, socials: ['Instagram', 'WhatsApp', '2GIS'], catalogTitle: 'Услуги и цены', catalogCategory: 'Услуги', rewardTitle: 'Уход в подарок', workHours: 'Ежедневно, 09:00–21:00', brandColor: '#db2777' },
  flower: { label: 'Цветочный магазин', offerings: ['Монобукет', 'Авторский букет', 'Розы', 'Сезонные цветы', 'Композиция в коробке', 'Доставка'], avgCheck: 15000, repeatVisitDays: 18, socials: ['Instagram', 'WhatsApp', 'Telegram', '2GIS'], catalogTitle: 'Каталог букетов', catalogCategory: 'Букеты', rewardTitle: 'Подарок к шестому заказу', workHours: 'Ежедневно, 09:00–22:00', brandColor: '#be185d' },
  retail: { label: 'Небольшой магазин', offerings: ['Футболки', 'Худи', 'Джинсы', 'Куртки', 'Обувь', 'Аксессуары'], avgCheck: 10000, repeatVisitDays: 16, socials: ['Instagram', 'WhatsApp', 'TikTok', '2GIS'], catalogTitle: 'Каталог товаров', catalogCategory: 'Товары', rewardTitle: 'Скидка 20% на следующую покупку', workHours: 'Ежедневно, 10:00–21:00', brandColor: '#b45309' },
  repair: { label: 'Сервисная точка', offerings: ['Диагностика', 'Замена экрана', 'Замена батареи', 'Ремонт разъёма', 'Чистка от пыли', 'Восстановление данных'], avgCheck: 18000, repeatVisitDays: 120, socials: ['WhatsApp', 'Telegram', '2GIS'], catalogTitle: 'Услуги и цены', catalogCategory: 'Ремонт', rewardTitle: 'Бесплатная диагностика', workHours: 'Пн–Сб, 10:00–20:00', brandColor: '#0369a1' },
};

export const BUSINESS_TYPE_CODES = Object.keys(BUSINESS_PRESETS) as BusinessTypeCode[];
