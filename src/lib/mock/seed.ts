/**
 * Localy — детерминированный генератор демо-данных.
 *
 * Импортируется только из src/lib/repo/mock.ts.
 *
 * Почему детерминированный: демо-видео и питч снимаются несколько раз,
 * цифры на экране должны совпадать между дублями. PRNG с фиксированным
 * зерном даёт одинаковый набор при каждом запуске, но даты считаются
 * от «сегодня», чтобы данные не протухли к сдаче.
 *
 * Что гарантирует генератор:
 *  - в каждом заведении есть клиенты во всех четырёх состояниях активности
 *  - есть люди, состоящие сразу в 2–3 заведениях (сетевой эффект, главный тезис)
 *  - есть завершённая акция с полной воронкой — аналитике есть что показать
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { forecastPromo } from '@/lib/engine';
import type {
  ActivityLogEntry,
  AnonymousSale,
  Booking,
  Branch,
  Business,
  BusinessGoal,
  BusinessQrStats,
  BusinessTool,
  BusinessType,
  BusinessTypeCode,
  Campaign,
  Customer,
  Deposit,
  LoyaltyConfig,
  Membership,
  Plan,
  Promo,
  PromoEvent,
  PromoKind,
  RecommendationRuleSetting,
  SegmentCode,
  SiteConfig,
  Staff,
  Subscription,
  SubscriptionPayment,
  Template,
  Tool,
  ToolCategory,
  Transaction,
  User,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// PRNG и утилиты
// ─────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;

function makeRng(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    /** Целое в [min, max] включительно. */
    int: (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min,
    /** Дробное в [min, max). */
    float: (min: number, max: number) => min + r() * (max - min),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    chance: (p: number) => r() < p,
    /** n случайных элементов без повторов. */
    sample: <T>(arr: readonly T[], n: number): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
    },
  };
}

type Rng = ReturnType<typeof makeRng>;

const iso = (d: Date) => d.toISOString();
const shift = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS);

// ─────────────────────────────────────────────────────────────
// Справочник ниш
// ─────────────────────────────────────────────────────────────

export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'bt_coffee', code: 'coffee', title: 'Кофейня', icon: 'coffee', defaultRepeatVisitDays: 5, activityThresholds: { declining: 1.3, atRisk: 2, lapsed: 3.5 } },
  { id: 'bt_barber', code: 'barber', title: 'Барбершоп', icon: 'scissors', defaultRepeatVisitDays: 28, activityThresholds: { declining: 1.25, atRisk: 1.8, lapsed: 2.8 } },
  { id: 'bt_beauty', code: 'beauty', title: 'Салон красоты', icon: 'sparkles', defaultRepeatVisitDays: 24, activityThresholds: { declining: 1.25, atRisk: 1.9, lapsed: 3 } },
  { id: 'bt_flower', code: 'flower', title: 'Цветочный магазин', icon: 'flower-2', defaultRepeatVisitDays: 18, activityThresholds: { declining: 1.5, atRisk: 2.5, lapsed: 4 } },
  { id: 'bt_repair', code: 'repair', title: 'Ремонт техники', icon: 'wrench', defaultRepeatVisitDays: 120, activityThresholds: { declining: 1.5, atRisk: 2.5, lapsed: 4 } },
  { id: 'bt_retail', code: 'retail', title: 'Магазин', icon: 'shopping-bag', defaultRepeatVisitDays: 16, activityThresholds: { declining: 1.3, atRisk: 2, lapsed: 3.5 } },
];

/** Типичный интервал между визитами в нише, дней. База для генерации истории. */
const CADENCE: Record<BusinessTypeCode, number> = {
  coffee: 5,
  barber: 28,
  beauty: 24,
  flower: 18,
  repair: 120,
  retail: 16,
};

const ITEMS: Record<BusinessTypeCode, string[]> = {
  coffee: ['Капучино', 'Латте', 'Раф', 'Американо', 'Круассан', 'Чизкейк', 'Матча', 'Эспрессо'],
  barber: ['Стрижка', 'Стрижка + борода', 'Бритьё', 'Камуфляж седины', 'Детская стрижка'],
  beauty: ['Маникюр', 'Педикюр', 'Окрашивание', 'Укладка', 'Уход за лицом', 'Брови'],
  flower: ['Монобукет', 'Авторский букет', 'Розы', 'Пионы', 'Композиция', 'Доставка'],
  repair: ['Замена экрана', 'Замена батареи', 'Чистка от пыли', 'Ремонт разъёма', 'Диагностика'],
  retail: ['Футболка', 'Джинсы', 'Худи', 'Кроссовки', 'Куртка', 'Аксессуар'],
};

// ─────────────────────────────────────────────────────────────
// Каталог инструментов (требование положения: карточки + 5 категорий)
// ─────────────────────────────────────────────────────────────

type ToolSeed = [
  string,
  string,
  string,
  ToolCategory,
  Tool['kind'],
  BusinessTypeCode[],
  number,
  string,
];

const TOOL_SEEDS: ToolSeed[] = [
  // маркетинг
  ['tool_promo_builder', 'Конструктор акций', 'Соберите акцию за минуту и увидьте прогноз выручки до запуска', 'marketing', 'module', [], 5, 'megaphone'],
  ['tool_campaigns', 'Рассылки клиентам', 'Подготовьте предложение для сегмента, проверьте согласия и лимиты канала', 'marketing', 'module', [], 5, 'send'],
  ['tool_birthday', 'Поздравления с днём рождения', 'Найдите клиентов с ближайшим днём рождения и подготовьте подарок', 'marketing', 'automation', [], 4, 'gift'],
  ['tool_referral', 'Приведи друга', 'Клиент получает бонусы за каждого приведённого знакомого', 'marketing', 'module', ['coffee', 'barber', 'beauty'], 4, 'users'],
  ['tool_site', 'Мини-сайт заведения', 'Страница с услугами, акциями и записью — без программиста', 'marketing', 'module', [], 4, 'globe'],
  ['tool_qr_poster', 'QR-плакат на кассу', 'Готовый макет: клиент сканирует и вступает в программу за 10 секунд', 'marketing', 'template', [], 4, 'qr-code'],
  ['tool_social', 'Шаблоны для соцсетей', 'Готовые тексты и макеты постов под вашу нишу', 'marketing', 'template', [], 2, 'image'],

  // продажи
  ['tool_pos', 'Касса', 'Пробейте покупку по QR клиента — бонусы начислятся сами', 'sales', 'module', [], 5, 'credit-card'],
  ['tool_item_promo', 'Акция на товар', 'Продвиньте конкретную позицию тем, кто её уже покупал', 'sales', 'module', ['coffee', 'retail'], 3, 'tag'],
  ['tool_upsell', 'Подсказки допродаж', 'Найдите сочетания позиций в реальных чеках и соберите комбо', 'sales', 'automation', ['coffee', 'retail'], 3, 'trending-up'],
  ['tool_bookings', 'Онлайн-запись', 'Клиент записывается сам, вы видите расписание', 'sales', 'module', ['barber', 'beauty', 'repair'], 4, 'calendar'],
  ['tool_deposits', 'Абонементы и сертификаты', 'Продавайте пакеты услуг и подарочные сертификаты', 'sales', 'module', ['beauty', 'barber'], 3, 'wallet'],
  ['tool_avg_check', 'Рост среднего чека', 'Комбо-предложения тем, кто берёт только одну позицию', 'sales', 'module', [], 3, 'arrow-up-right'],

  // удержание
  ['tool_loyalty', 'Программа лояльности', 'Бонусы за покупки и награда на выбранном пороге', 'retention', 'module', [], 5, 'star'],
  ['tool_crm', 'Клиентская база', 'Карточка каждого клиента: визиты, чек, любимые позиции', 'retention', 'module', [], 5, 'contact'],
  ['tool_segments', 'Автосегменты', 'Система сама делит базу на 13 групп и держит их актуальными', 'retention', 'automation', [], 5, 'layers'],
  ['tool_winback', 'Возврат ушедших', 'Находит тех, кто пропал, и предлагает повод вернуться', 'retention', 'automation', [], 5, 'undo'],
  ['tool_expiring', 'Напоминание о бонусах', 'Выберите клиентов со сгорающими бонусами и подготовьте сообщение', 'retention', 'automation', [], 4, 'clock'],
  ['tool_return_reward', 'Награда за возврат', 'Скидка на второй визит, чтобы новый клиент стал постоянным', 'retention', 'module', [], 4, 'repeat'],
  ['tool_personal', 'Персональные предложения', 'Получите приоритетный список клиентов и подходящий повод обратиться', 'retention', 'automation', [], 4, 'user-check'],

  // аналитика
  ['tool_dashboard', 'Аналитика продаж', 'Выручка, визиты, средний чек — по дням и неделям', 'analytics', 'module', [], 5, 'bar-chart'],
  ['tool_promo_roi', 'Отдача от акций', 'Сколько принесла каждая акция и окупилась ли она', 'analytics', 'module', [], 5, 'percent'],
  ['tool_funnel', 'Воронка акции', 'Получили → открыли → пришли → воспользовались', 'analytics', 'module', [], 4, 'filter'],
  ['tool_customer_analytics', 'Аналитика клиентов', 'Новые, повторные, ушедшие — и куда движется база', 'analytics', 'module', [], 4, 'pie-chart'],
  ['tool_weekday', 'Загрузка по дням', 'Какие дни и часы простаивают', 'analytics', 'module', [], 3, 'calendar-days'],
  ['tool_forecast', 'Симулятор роста', 'Прогноз новых клиентов и выручки до запуска акции', 'analytics', 'module', [], 5, 'activity'],

  // автоматизация
  ['tool_recommendations', 'Автоподсказки', 'Платформа сама говорит, что сделать сегодня', 'automation', 'automation', [], 5, 'lightbulb'],
  ['tool_schedule', 'Планировщик акций', 'Акции запускаются и завершаются по расписанию', 'automation', 'automation', [], 3, 'timer'],
  ['tool_roles', 'Роли сотрудников', 'Кассир видит только кассу, маркетолог — только акции', 'automation', 'module', [], 3, 'shield'],
  ['tool_notify', 'Маршрут уведомлений', 'Показывает доступную аудиторию по каждому каналу с учётом согласий', 'automation', 'automation', [], 3, 'bell'],
  ['tool_antispam', 'Защита от спама', 'Не больше четырёх сообщений клиенту в месяц', 'automation', 'automation', [], 4, 'shield-check'],
];

export const TOOLS: Tool[] = TOOL_SEEDS.map(
  ([id, title, description, category, kind, forTypes, impact, icon]) => ({
    id,
    title,
    description,
    category,
    kind,
    forTypes,
    impact,
    icon,
  }),
);

// ─────────────────────────────────────────────────────────────
// Маркетинговые шаблоны (админка платформы ими управляет)
// ─────────────────────────────────────────────────────────────

type TemplateSeed = [string, string, ToolCategory, BusinessTypeCode[], Template['kind'], string];

const TEMPLATE_SEEDS: TemplateSeed[] = [
  ['tpl_2plus1', 'Кофе 2+1', 'marketing', ['coffee'], 'promo', 'Два напитка — третий в подарок. Действует до {date}.'],
  ['tpl_happy_hours', 'Тихие часы', 'sales', ['coffee', 'retail'], 'promo', 'С 14:00 до 16:00 скидка {value}% на всё меню.'],
  ['tpl_winback_coffee', 'Возвращение в кофейню', 'retention', ['coffee'], 'campaign', '{name}, давно вас не видели. Ваш любимый {item} со скидкой {value}% всю неделю.'],
  ['tpl_winback_general', 'Мы соскучились', 'retention', [], 'campaign', '{name}, возвращайтесь — дарим скидку {value}% на следующий визит.'],
  ['tpl_birthday', 'Подарок на день рождения', 'marketing', [], 'campaign', '{name}, с наступающим! Дарим {reward} — заходите в течение недели.'],
  ['tpl_expiring', 'Бонусы сгорают', 'retention', [], 'campaign', '{name}, на вашем счету {points} бонусов. Они сгорят {date} — успейте потратить.'],
  ['tpl_second_visit', 'Скидка на второй визит', 'retention', ['barber', 'beauty', 'repair'], 'promo', 'Приходите второй раз в течение {days} дней — скидка {value}%.'],
  ['tpl_referral', 'Приведи друга', 'marketing', [], 'promo', 'Приведите друга — оба получаете {value} бонусов.'],
  ['tpl_double_points', 'Двойные бонусы', 'retention', [], 'promo', 'Всю неделю бонусы начисляются в двойном размере.'],
  ['tpl_new_service', 'Новая услуга', 'marketing', ['beauty', 'barber'], 'campaign', 'У нас новая услуга — {item}. Для вас скидка {value}% на первое посещение.'],
  ['tpl_weekday_boost', 'Разгрузить будни', 'sales', [], 'promo', 'По {weekday} скидка {value}% — самый свободный день недели.'],
  ['tpl_certificate', 'Подарочный сертификат', 'sales', ['beauty', 'barber'], 'promo', 'Сертификат на {value} ₸ — удобный подарок.'],
  ['tpl_repair_reminder', 'Профилактика техники', 'retention', ['repair'], 'campaign', '{name}, прошло полгода с последнего ремонта. Бесплатная диагностика до {date}.'],
  ['tpl_retail_season', 'Сезонная распродажа', 'marketing', ['retail'], 'promo', 'Новая коллекция: скидка {value}% первым покупателям.'],
  ['tpl_site_coffee', 'Сайт кофейни', 'marketing', ['coffee'], 'site', 'Мини-сайт: меню, акции, карта, бонусная программа.'],
  ['tpl_site_barber', 'Сайт барбершопа', 'marketing', ['barber'], 'site', 'Контрастная витрина: мастера, услуги, цены и быстрая запись.'],
  ['tpl_site_beauty', 'Сайт салона', 'marketing', ['beauty'], 'site', 'Мини-сайт: услуги, мастера, онлайн-запись, отзывы.'],
  ['tpl_site_flower', 'Сайт цветочного магазина', 'marketing', ['flower'], 'site', 'Каталог букетов, поводы, доставка и бонусы.'],
  ['tpl_site_retail', 'Сайт небольшого магазина', 'marketing', ['retail'], 'site', 'Каталог новинок, категории, акции и клуб покупателей.'],
  ['tpl_site_repair', 'Сайт сервиса', 'marketing', ['repair'], 'site', 'Мини-сайт: услуги, сроки, цены, статус ремонта.'],
  ['tpl_upsell', 'Допродажа к заказу', 'sales', ['coffee', 'retail'], 'campaign', 'К вашему {item} отлично подойдёт {item2} — сегодня со скидкой.'],
  ['tpl_vip', 'Спасибо постоянным', 'retention', [], 'campaign', '{name}, вы с нами уже {months} месяцев. Держите {reward} — просто так.'],
  ['tpl_first_visit', 'Приветствие новичка', 'marketing', [], 'campaign', '{name}, спасибо за первый визит! Ваши {points} бонусов уже на счету.'],
];

export const TEMPLATES: Template[] = TEMPLATE_SEEDS.map(
  ([id, title, category, businessTypes, kind, body]) => ({
    id,
    title,
    category,
    businessTypes,
    kind,
    body,
  }),
);

// ─────────────────────────────────────────────────────────────
// Заведения
// ─────────────────────────────────────────────────────────────

interface BusinessSeed {
  business: Business;
  customers: number;
  loyalty: Omit<LoyaltyConfig, 'businessId'>;
}

type BusinessDef = [
  string,
  string,
  BusinessTypeCode,
  string,
  number,
  BusinessGoal[],
  Business['plan'],
  string,
  number,
  Omit<LoyaltyConfig, 'businessId'>,
];

function businessSeeds(now: Date): BusinessSeed[] {
  const defs: BusinessDef[] = [
    [
      'almaty-coffee', 'Кофейня «Дом кофе»', 'coffee', 'Алматы', 2400,
      ['return_customers', 'increase_frequency'], 'pro', '#7C4DFF', 62,
      { pointsPerCurrency: 0.05, rewardThreshold: 1000, rewardTitle: 'Напиток в подарок', expiryDays: 90 },
    ],
    [
      'barber-devyatka', 'Барбершоп «Девятка»', 'barber', 'Астана', 6000,
      ['new_customers', 'return_customers'], 'basic', '#0F172A', 28,
      { pointsPerCurrency: 0.04, rewardThreshold: 2000, rewardTitle: 'Стрижка бороды бесплатно', expiryDays: 180 },
    ],
    [
      'lotus-beauty', 'Салон красоты Lotus', 'beauty', 'Алматы', 12000,
      ['increase_check', 'return_customers'], 'basic', '#DB2777', 24,
      { pointsPerCurrency: 0.05, rewardThreshold: 5000, rewardTitle: 'Уход за лицом в подарок', expiryDays: 180 },
    ],
    [
      'fixphone', 'Сервис FixPhone', 'repair', 'Алматы', 18000,
      ['new_customers', 'automate'], 'free', '#0EA5E9', 18,
      { pointsPerCurrency: 0.03, rewardThreshold: 4000, rewardTitle: 'Бесплатная диагностика', expiryDays: null },
    ],
    [
      'moda-store', 'Магазин Moda', 'retail', 'Астана', 9000,
      ['new_customers', 'increase_check'], 'basic', '#F59E0B', 22,
      { pointsPerCurrency: 0.06, rewardThreshold: 3000, rewardTitle: 'Скидка 20% на любую вещь', expiryDays: 120 },
    ],
  ];

  return defs.map(
    ([slug, name, typeCode, city, avgCheck, goals, plan, brandColor, customers, loyalty], i) => ({
      business: {
        id: `biz_${slug}`,
        slug,
        name,
        typeCode,
        city,
        address: `${city}, центральный район`,
        employeeCount: typeCode === 'coffee' ? 8 : 4,
        branchCount: typeCode === 'coffee' ? 2 : 1,
        offerings: [...ITEMS[typeCode]],
        repeatVisitDays: CADENCE[typeCode],
        currentTools: ['Instagram', 'WhatsApp', '2GIS'],
        onboardingCompleted: true,
        avgCheck,
        goals,
        plan,
        brandColor,
        logoUrl: null,
        createdAt: iso(shift(now, -(200 - i * 15))),
      },
      customers,
      loyalty,
    }),
  );
}

// ─────────────────────────────────────────────────────────────
// Люди
// ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Арман', 'Айгерим', 'Данияр', 'Динара', 'Ерлан', 'Жанна', 'Мадина', 'Нурлан',
  'Асель', 'Тимур', 'Алия', 'Санжар', 'Камила', 'Бекзат', 'Гульнара', 'Рустем',
  'Алина', 'Олжас', 'Сабина', 'Ильяс', 'Айдана', 'Максим', 'Анна', 'Дмитрий',
  'Елена', 'Сергей', 'Ольга', 'Артём', 'Мария', 'Азамат',
];

const LAST_NAMES = [
  'Абдуллаев', 'Сатпаева', 'Жумабеков', 'Каримова', 'Нурланов', 'Сеитова',
  'Ахметов', 'Байжанова', 'Мусин', 'Оспанова', 'Ким', 'Ли', 'Петров', 'Иванова',
  'Смагулов', 'Тулегенова', 'Ержанов', 'Досжанова', 'Серикулы', 'Аманжолова',
];

function makeCustomers(rng: Rng, count: number, now: Date): Customer[] {
  const out: Customer[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = rng.pick(LAST_NAMES);
    const hasBirthday = rng.chance(0.75);
    // Часть дней рождения намеренно кладём в ближайшие две недели —
    // сегмент birthday_soon не должен быть пустым на демо.
    const bday = rng.chance(0.12)
      ? shift(now, rng.int(1, 13))
      : new Date(Date.UTC(1990, rng.int(0, 11), rng.int(1, 28)));

    out.push({
      id: `cus_${String(i + 1).padStart(3, '0')}`,
      phone: `+7 7${rng.int(0, 9)}${rng.int(0, 9)} ${rng.int(100, 999)} ${rng.int(10, 99)} ${rng.int(10, 99)}`,
      name: `${first} ${last}`,
      birthday: hasBirthday
        ? `${1985 + rng.int(0, 18)}-${String(bday.getUTCMonth() + 1).padStart(2, '0')}-${String(bday.getUTCDate()).padStart(2, '0')}`
        : null,
      qrToken: `qr_${String(i + 1).padStart(3, '0')}_${Math.floor(rng.next() * 1e9).toString(36)}`,
      qrRotatedAt: iso(now),
      createdAt: iso(shift(now, -rng.int(30, 190))),
    });
  }
  return out;
}

const STAFF_NAMES = ['Асель', 'Марат', 'Динара', 'Ержан', 'Айым'];

function makeStaff(rng: Rng, businessId: string, branchId: string): Staff[] {
  const roles: Staff['role'][] = ['owner', 'admin', 'marketer', 'cashier', 'manager'];
  return roles.map((role, i) => ({
    id: `stf_${businessId}_${role}`,
    businessId,
    branchId: role === 'cashier' || role === 'manager' ? branchId : null,
    name: `${STAFF_NAMES[i]} ${rng.pick(LAST_NAMES)}`,
    role,
    pin: String(1111 * (i + 1)).slice(0, 4),
  }));
}

// ─────────────────────────────────────────────────────────────
// История визитов
// ─────────────────────────────────────────────────────────────

/**
 * Целевое состояние активности задаём заранее и подгоняем под него дату
 * последнего визита. Иначе случайная генерация даёт перекос в active,
 * и сегменты «под риском» и «давно не приходили» на демо оказываются пустыми.
 */
type TargetState = 'active' | 'declining' | 'at_risk' | 'lapsed' | 'single' | 'expiring';

const STATE_MIX: TargetState[] = [
  ...Array<TargetState>(9).fill('active'),
  ...Array<TargetState>(4).fill('declining'),
  ...Array<TargetState>(3).fill('at_risk'),
  ...Array<TargetState>(2).fill('lapsed'),
  ...Array<TargetState>(2).fill('single'),
  ...Array<TargetState>(2).fill('expiring'),
];

/**
 * Дней с последнего визита — как множитель личной медианы интервалов.
 *
 * `expiring` считается не от медианы, а от срока сгорания бонусов: человек
 * пропал почти на весь срок, бонусы вот-вот сгорят. Без этого состояния
 * сегмент «Бонусы скоро сгорят» пустой, а на нём держится одна из
 * сильнейших рекомендаций владельцу.
 */
function daysSinceFor(
  state: TargetState,
  cadence: number,
  rng: Rng,
  expiryDays: number | null,
): number {
  switch (state) {
    case 'active':
      return Math.round(cadence * rng.float(0.1, 1.2));
    case 'declining':
      return Math.round(cadence * rng.float(1.4, 1.9));
    case 'at_risk':
      return Math.round(cadence * rng.float(2.1, 3.3));
    case 'lapsed':
      return Math.round(cadence * rng.float(3.7, 5.5));
    case 'single':
      return rng.int(2, 40);
    case 'expiring':
      // Бонусы не сгорают вовсе — состояние вырождается в «давно не приходил»
      return expiryDays === null
        ? Math.round(cadence * rng.float(3.7, 5.5))
        : expiryDays - rng.int(2, 7);
  }
}

interface HistoryResult {
  membership: Membership;
  transactions: Transaction[];
  anonymousSales: AnonymousSale[];
}

function buildHistory(params: {
  rng: Rng;
  now: Date;
  business: Business;
  loyalty: LoyaltyConfig;
  customerId: string;
  branchId: string;
  cashierId: string;
  state: TargetState;
}): HistoryResult {
  const { rng, now, business, loyalty, customerId, branchId, cashierId, state } = params;

  const base = CADENCE[business.typeCode];
  const cadence = Math.max(2, base * rng.float(0.6, 1.7));
  const daysSince = daysSinceFor(state, cadence, rng, loyalty.expiryDays);
  const lastSeen = shift(now, -daysSince);
  const items = ITEMS[business.typeCode];

  // Идём назад от последнего визита, пока не упрёмся в горизонт истории
  const horizonDays = business.typeCode === 'repair' ? 540 : 190;
  const dates: Date[] = [];
  let cursor = lastSeen;
  const maxVisits = state === 'single' ? 1 : rng.int(3, 26);

  while (dates.length < maxVisits) {
    dates.push(cursor);
    const gap = Math.max(1, Math.round(cadence * rng.float(0.7, 1.35)));
    cursor = shift(cursor, -gap);
    if ((now.getTime() - cursor.getTime()) / DAY_MS > horizonDays) break;
  }
  dates.reverse();

  const transactions: Transaction[] = [];
  const anonymousSales: AnonymousSale[] = [];
  let points = 0;
  let totalSpent = 0;
  const favorite = rng.sample(items, rng.int(1, 2));

  dates.forEach((d, i) => {
    const amount = Math.round((business.avgCheck * rng.float(0.55, 1.8)) / 50) * 50;
    const delta = Math.round(amount * loyalty.pointsPerCurrency);
    points += delta;
    totalSpent += amount;

    const lineItems = rng.chance(0.6) ? favorite.slice(0, 1) : rng.sample(items, rng.int(1, 2));

    transactions.push({
      id: `trx_${business.id}_${customerId}_${i}`,
      businessId: business.id,
      branchId,
      customerId,
      staffId: cashierId,
      amount,
      pointsDelta: delta,
      kind: 'purchase',
      items: lineItems,
      createdAt: iso(d),
    });

    // Накопил больше порога — иногда забирает награду
    if (points >= loyalty.rewardThreshold && rng.chance(0.45)) {
      points -= loyalty.rewardThreshold;
      transactions.push({
        id: `trx_${business.id}_${customerId}_${i}_r`,
        businessId: business.id,
        branchId,
        customerId,
        staffId: cashierId,
        amount: 0,
        pointsDelta: -loyalty.rewardThreshold,
        kind: 'reward',
        items: [loyalty.rewardTitle],
        createdAt: iso(d),
      });
    }
  });

  // Чеки из внешней кассы без QR: по ним честно считаем долю
  // идентифицированных покупок, а не рисуем её из числа включённых модулей.
  transactions.filter((transaction) => transaction.kind === 'purchase' && transaction.status !== 'pending_confirmation' && transaction.status !== 'cancelled').forEach((transaction, index) => {
    const copies = index % 4 === 0 ? 2 : 1;
    for (let copy = 0; copy < copies; copy += 1) anonymousSales.push({ id: `anon_${transaction.id}_${copy + 1}`, businessId: transaction.businessId, branchId: transaction.branchId, amount: Math.max(100, Math.round(transaction.amount * (0.8 + rng.next() * 0.4))), items: transaction.items.slice(0, 2), createdAt: transaction.createdAt });
  });

  const consentPool = ['telegram', 'sms', 'email', 'whatsapp', 'push'] as const;
  const consent = rng.chance(0.85) ? rng.sample(consentPool, rng.int(1, 3)) : [];

  return {
    membership: {
      businessId: business.id,
      customerId,
      points,
      visits: dates.length,
      firstSeen: iso(dates[0]),
      lastSeen: iso(dates[dates.length - 1]),
      totalSpent,
      consentChannels: [...consent],
      favoriteItems: favorite,
    },
    transactions: transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    anonymousSales: anonymousSales.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

// ─────────────────────────────────────────────────────────────
// Акции
// ─────────────────────────────────────────────────────────────

interface PromoSeedDef {
  kind: PromoKind;
  title: string;
  value: number;
  segment: SegmentCode;
  status: Promo['status'];
  /** Смещение старта относительно сегодня, дней. */
  startOffset: number;
  lengthDays: number;
}

const PROMO_PLAN: Record<BusinessTypeCode, PromoSeedDef[]> = {
  coffee: [
    { kind: 'two_plus_one', title: 'Кофе 2+1 по будням', value: 33, segment: 'regular', status: 'finished', startOffset: -38, lengthDays: 14 },
    { kind: 'winback', title: 'Вернём любимых гостей', value: 25, segment: 'lapsed', status: 'active', startOffset: -6, lengthDays: 21 },
    { kind: 'double_points', title: 'Двойные бонусы во вторник', value: 2, segment: 'returning', status: 'scheduled', startOffset: 4, lengthDays: 7 },
    { kind: 'birthday', title: 'Напиток в день рождения', value: 100, segment: 'birthday_soon', status: 'draft', startOffset: 0, lengthDays: 30 },
  ],
  barber: [
    { kind: 'return_reward', title: 'Скидка на второй визит', value: 20, segment: 'new', status: 'finished', startOffset: -45, lengthDays: 21 },
    { kind: 'discount', title: 'Стрижка + борода −15%', value: 15, segment: 'regular', status: 'active', startOffset: -3, lengthDays: 14 },
    { kind: 'referral', title: 'Приведи друга', value: 500, segment: 'loyal', status: 'draft', startOffset: 0, lengthDays: 60 },
  ],
  beauty: [
    { kind: 'gift', title: 'Уход в подарок к окрашиванию', value: 4000, segment: 'high_check', status: 'finished', startOffset: -30, lengthDays: 14 },
    { kind: 'winback', title: 'Скучаем по вам', value: 20, segment: 'at_risk', status: 'active', startOffset: -8, lengthDays: 20 },
    { kind: 'points', title: 'Бонусы за маникюр', value: 1000, segment: 'returning', status: 'scheduled', startOffset: 5, lengthDays: 14 },
  ],
  flower: [
    { kind: 'discount', title: 'Букет недели −15%', value: 15, segment: 'new', status: 'finished', startOffset: -28, lengthDays: 10 },
    { kind: 'birthday', title: 'Цветы ко дню рождения', value: 10, segment: 'birthday_soon', status: 'active', startOffset: -5, lengthDays: 20 },
    { kind: 'referral', title: 'Бонус за рекомендацию', value: 500, segment: 'loyal', status: 'draft', startOffset: 0, lengthDays: 30 },
  ],
  repair: [
    { kind: 'coupon', title: 'Бесплатная диагностика', value: 3000, segment: 'lapsed', status: 'finished', startOffset: -60, lengthDays: 30 },
    { kind: 'discount', title: 'Замена батареи −10%', value: 10, segment: 'regular', status: 'active', startOffset: -10, lengthDays: 30 },
  ],
  retail: [
    { kind: 'discount', title: 'Новая коллекция −20%', value: 20, segment: 'promo_lovers', status: 'finished', startOffset: -25, lengthDays: 10 },
    { kind: 'item_promo', title: 'Худи недели', value: 15, segment: 'item_buyers', status: 'active', startOffset: -4, lengthDays: 12 },
    { kind: 'points', title: 'Потратьте бонусы', value: 500, segment: 'expiring_points', status: 'draft', startOffset: 0, lengthDays: 14 },
  ],
};

function promoCode(rng: Rng): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(rng.next() * alphabet.length)];
  return s;
}

// ─────────────────────────────────────────────────────────────
// Сборка
// ─────────────────────────────────────────────────────────────

export interface SeedData {
  users: User[];
  businessTypes: BusinessType[];
  tools: Tool[];
  templates: Template[];
  recommendationSettings: RecommendationRuleSetting[];
  businesses: Business[];
  plans: Plan[];
  subscriptions: Subscription[];
  subscriptionPayments: SubscriptionPayment[];
  branches: Branch[];
  businessQrStats: BusinessQrStats[];
  staff: Staff[];
  loyaltyConfigs: LoyaltyConfig[];
  siteConfigs: SiteConfig[];
  businessTools: BusinessTool[];
  customers: Customer[];
  memberships: Membership[];
  transactions: Transaction[];
  anonymousSales: AnonymousSale[];
  promos: Promo[];
  promoEvents: PromoEvent[];
  campaigns: Campaign[];
  bookings: Booking[];
  deposits: Deposit[];
  activityLog: ActivityLogEntry[];
}

const SEED = 20260803;

export function generateSeed(nowInput?: Date): SeedData {
  const now = nowInput ?? new Date();
  const rng = makeRng(SEED);

  const seeds = businessSeeds(now);
  const businesses = seeds.map((s) => s.business);
  const plans: Plan[] = [
    { tier: 'free', title: 'Старт', priceKzt: 0, description: 'Чтобы запустить первую карту лояльности', features: ['1 страница бизнеса', 'До 100 клиентов', '1 активная акция', 'Базовая статистика', 'Брендинг Localy'], limits: { customers: 100, campaignsPerMonth: 1, staff: 1, branches: 1, activePromos: 1 } },
    { tier: 'basic', title: 'Бизнес', priceKzt: 14900, description: 'CRM, касса и рассылки для растущей точки', features: ['Полный сайт и CRM', 'До 2 000 клиентов', 'Сегментация и касса', 'До 5 сотрудников', '3 филиала', 'Шаблоны для вашей ниши'], limits: { customers: 2000, campaignsPerMonth: 8, staff: 5, branches: 3, activePromos: 5 } },
    { tier: 'pro', title: 'Сеть', priceKzt: 29900, description: 'Автоматизация и расширенная аналитика', features: ['До 20 000 клиентов', 'Автоматические сценарии', 'Расширенная аналитика', 'До 20 сотрудников', '10 филиалов', 'Свой домен и интеграции', 'Приоритетная поддержка', 'Без брендинга Localy'], limits: { customers: 20000, campaignsPerMonth: 40, staff: 20, branches: 10, activePromos: 20 } },
  ];
  const recommendationSettings: RecommendationRuleSetting[] = [
    { id: 'rec-lapsed', label: 'Клиенты давно не приходили', actionText: 'Создайте предложение на повторное посещение', priority: 5, active: true },
    { id: 'rec-expiring', label: 'Бонусы скоро сгорят', actionText: 'Отправьте напоминание, пока бонусы не пропали', priority: 5, active: true },
    { id: 'rec-at-risk', label: 'Постоянные стали приходить реже', actionText: 'Верните их персональным предложением, пока они не ушли', priority: 4, active: true },
    { id: 'rec-birthday', label: 'Скоро день рождения', actionText: 'Настройте автоматический подарок ко дню рождения', priority: 3, active: true },
    { id: 'rec-weekday', label: 'Слабый день недели', actionText: 'Запустите двойные бонусы в этот день', priority: 3, active: true },
    { id: 'rec-compare', label: 'Сравнение акций', actionText: 'Повторите более удачный формат', priority: 2, active: true },
    { id: 'rec-identified', label: 'Мало покупок с QR', actionText: 'Напомните кассирам предлагать бонусную карту на кассе', priority: 4, active: true },
  ];
  const subscriptions: Subscription[] = businesses.map((business) => ({ businessId: business.id, plan: business.plan, status: 'active', startedAt: iso(shift(now, -90)), nextBillingAt: business.plan === 'free' ? null : iso(shift(now, 18)) }));
  const subscriptionPayments: SubscriptionPayment[] = businesses.filter((business) => business.plan !== 'free').flatMap((business, index) => [0, 1, 2].map((month) => ({ id: `pay_${business.id}_${month + 1}`, businessId: business.id, plan: business.plan, amountKzt: plans.find((plan) => plan.tier === business.plan)?.priceKzt ?? 0, status: 'demo' as const, at: iso(shift(now, -(index + month * 30 + 5))) })));

  const branches: Branch[] = [];
  const businessQrStats: BusinessQrStats[] = [];
  const staff: Staff[] = [];
  const loyaltyConfigs: LoyaltyConfig[] = [];
  const siteConfigs: SiteConfig[] = [];
  const businessTools: BusinessTool[] = [];
  const memberships: Membership[] = [];
  const transactions: Transaction[] = [];
  const anonymousSales: AnonymousSale[] = [];
  const promos: Promo[] = [];
  const promoEvents: PromoEvent[] = [];
  const campaigns: Campaign[] = [];
  const bookings: Booking[] = [];
  const deposits: Deposit[] = [];
  const activityLog: ActivityLogEntry[] = [];

  const customers = makeCustomers(rng, 120, now);

  seeds.forEach((seed, bIndex) => {
    const b = seed.business;
    businessQrStats.push({
      businessId: b.id,
      scans: 180 - bIndex * 21,
      registrations: 74 - bIndex * 8,
    });

    // ── филиалы ──
    const branchCount = b.typeCode === 'coffee' ? 2 : 1;
    const bizBranches: Branch[] = [];
    for (let i = 0; i < branchCount; i++) {
      bizBranches.push({
        id: `brn_${b.slug}_${i + 1}`,
        businessId: b.id,
        title: i === 0 ? 'Основная точка' : 'Вторая точка',
        address: `${b.city}, ул. ${rng.pick(['Абая', 'Достык', 'Кабанбай батыра', 'Сатпаева', 'Розыбакиева'])}, ${rng.int(1, 180)}`,
        phone: `+7 7${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(10, 99)} ${rng.int(10, 99)}`,
      });
    }
    branches.push(...bizBranches);

    // ── сотрудники ──
    const bizStaff = makeStaff(rng, b.id, bizBranches[0].id);
    staff.push(...bizStaff);
    const cashier = bizStaff.find((s) => s.role === 'cashier')!;
    const owner = bizStaff.find((s) => s.role === 'owner')!;

    // ── лояльность и сайт ──
    const loyalty: LoyaltyConfig = { businessId: b.id, ...seed.loyalty };
    loyaltyConfigs.push(loyalty);

    siteConfigs.push({
      businessId: b.id,
      templateId:
        TEMPLATES.find((t) => t.kind === 'site' && t.businessTypes.includes(b.typeCode))?.id ??
        'tpl_site_coffee',
      published: bIndex < 3,
      description: `${b.name}: ${ITEMS[b.typeCode].slice(0, 3).join(', ')}.`,
      coverUrl: `/demo/${b.typeCode}-cover.svg`,
      phone: bizBranches[0].phone,
      workHours: 'Ежедневно, 09:00–21:00',
      telegram: 'localy_demo',
      whatsapp: bizBranches[0].phone,
      instagram: b.slug,
      primaryColor: b.brandColor,
      fontStyle: 'clean',
      catalogTitle: b.typeCode === 'coffee' ? 'Меню' : b.typeCode === 'flower' ? 'Каталог букетов' : b.typeCode === 'retail' ? 'Каталог товаров' : 'Услуги и цены',
      catalog: ITEMS[b.typeCode].map((title, index) => ({ id: `item_${b.slug}_${index + 1}`, title, description: index === 0 ? 'Популярная позиция' : '', category: b.typeCode === 'coffee' ? 'Меню' : 'Основное', price: Math.max(500, Math.round((b.avgCheck * (0.45 + index * 0.08)) / 100) * 100), imageUrl: index < 3 ? `/demo/${b.typeCode}-cover.svg` : null, active: true })),
      sections: [
        { kind: 'hero', enabled: true, title: b.name, body: `${b.city}. Приходите — и копите бонусы с первого визита.` },
        { kind: 'about', enabled: true, title: 'О нас', body: 'Небольшое заведение, где вас помнят по имени.' },
        { kind: 'services', enabled: true, title: 'Услуги и меню', body: ITEMS[b.typeCode].join(', ') },
        { kind: 'promos', enabled: true, title: 'Акции', body: 'Актуальные предложения для гостей.' },
        { kind: 'loyalty', enabled: true, title: 'Бонусная программа', body: `${seed.loyalty.rewardThreshold} бонусов — ${seed.loyalty.rewardTitle.toLowerCase()}.` },
        { kind: 'booking', enabled: ['barber', 'beauty', 'repair'].includes(b.typeCode), title: 'Онлайн-запись', body: 'Выберите удобное время.' },
        { kind: 'lead', enabled: !['barber', 'beauty', 'repair'].includes(b.typeCode), title: 'Оставить заявку', body: 'Задайте вопрос или закажите обратный звонок.' },
        { kind: 'contacts', enabled: true, title: 'Контакты', body: bizBranches[0].address },
      ],
    });

    // ── активированные инструменты ──
    const relevant = TOOLS.filter((t) => t.forTypes.length === 0 || t.forTypes.includes(b.typeCode));
    const activeCount = b.plan === 'pro' ? 14 : b.plan === 'basic' ? 9 : 5;
    relevant
      .slice()
      .sort((x, y) => y.impact - x.impact)
      .forEach((t, i) => {
        const activated = i < activeCount;
        if (!activated && !rng.chance(0.15)) return;
        businessTools.push({
          businessId: b.id,
          toolId: t.id,
          activatedAt: activated ? iso(shift(now, -rng.int(5, 120))) : null,
          isFavorite: rng.chance(0.25),
        });
      });

    // ── клиенты заведения ──
    // Первые 14 клиентов достаются всем заведениям — это и есть сетевой эффект:
    // один человек, один QR, несколько заведений.
    const shared = customers.slice(0, 14);
    const own = rng.sample(customers.slice(14), Math.max(0, seed.customers - shared.length));
    const bizCustomers = [...shared, ...own];

    bizCustomers.forEach((c, i) => {
      const state = STATE_MIX[(i + bIndex * 3) % STATE_MIX.length];
      const { membership, transactions: trx, anonymousSales: anonymous } = buildHistory({
        rng,
        now,
        business: b,
        loyalty,
        customerId: c.id,
        branchId: rng.pick(bizBranches).id,
        cashierId: cashier.id,
        state,
      });
      memberships.push(membership);
      transactions.push(...trx);
      anonymousSales.push(...anonymous);
    });

    // ── акции ──
    const plan = PROMO_PLAN[b.typeCode];
    plan.forEach((p, i) => {
      const startsAt = shift(now, p.startOffset);
      const endsAt = shift(startsAt, p.lengthDays);
      const audience = Math.max(8, Math.round(bizCustomers.length * rng.float(0.25, 0.7)));
      const promo: Promo = {
        id: `promo_${b.slug}_${i + 1}`,
        businessId: b.id,
        kind: p.kind,
        title: p.title,
        value: p.value,
        segment: p.segment,
        audienceSize: audience,
        startsAt: iso(startsAt),
        endsAt: iso(endsAt),
        status: p.status,
        forecast: forecastPromo({
          kind: p.kind,
          value: p.value,
          segment: p.segment,
          audienceSize: audience,
          avgCheck: b.avgCheck,
          pointsPerCurrency: seed.loyalty.pointsPerCurrency,
        }),
        promocode: promoCode(rng),
        createdAt: iso(shift(startsAt, -3)),
      };
      promos.push(promo);

      // Воронка есть у запущенных: получили → открыли → пришли → воспользовались
      if (p.status === 'finished' || p.status === 'active') {
        const recipients = rng.sample(bizCustomers, audience);
        const opened = recipients.slice(0, Math.round(audience * rng.float(0.55, 0.7)));
        const clicked = opened.slice(0, Math.round(opened.length * rng.float(0.55, 0.8)));
        const visited = clicked.slice(0, Math.round(clicked.length * rng.float(0.45, 0.65)));
        const redeemed = visited.slice(0, Math.round(visited.length * rng.float(0.7, 0.85)));
        const stageAt = (offset: number) => iso(shift(startsAt, offset));
        const lateDay = () => rng.int(2, Math.max(3, p.lengthDays - 1));

        recipients.forEach((c) =>
          promoEvents.push({ promoId: promo.id, customerId: c.id, stage: 'sent', at: stageAt(0) }),
        );
        opened.forEach((c) =>
          promoEvents.push({ promoId: promo.id, customerId: c.id, stage: 'opened', at: stageAt(1) }),
        );
        clicked.forEach((c) =>
          promoEvents.push({ promoId: promo.id, customerId: c.id, stage: 'clicked', at: stageAt(1) }),
        );
        visited.forEach((c) =>
          promoEvents.push({ promoId: promo.id, customerId: c.id, stage: 'visited', at: stageAt(lateDay()) }),
        );
        redeemed.forEach((c) =>
          promoEvents.push({ promoId: promo.id, customerId: c.id, stage: 'redeemed', at: stageAt(lateDay()) }),
        );

        campaigns.push({
          id: `cmp_${promo.id}`,
          businessId: b.id,
          promoId: promo.id,
          channel: 'telegram',
          audienceSegment: p.segment,
          audienceSize: recipients.length,
          body: `${p.title}. Промокод ${promo.promocode}.`,
          sentAt: stageAt(0),
          recipientIds: recipients.map((customer) => customer.id),
          opened: opened.length,
          clicked: clicked.length,
          visited: visited.length,
          redeemed: redeemed.length,
          simulated: true,
        });
      }
    });

    // ── онлайн-запись ──
    if (['barber', 'beauty', 'repair'].includes(b.typeCode)) {
      rng.sample(bizCustomers, 12).forEach((c, i) => {
        const at = shift(now, rng.int(-20, 12));
        const past = at.getTime() < now.getTime();
        bookings.push({
          id: `bkg_${b.slug}_${i + 1}`,
          businessId: b.id,
          customerId: c.id,
          service: rng.pick(ITEMS[b.typeCode]),
          at: iso(at),
          kind: 'booking',
          status: past
            ? rng.chance(0.85)
              ? 'done'
              : 'cancelled'
            : rng.chance(0.7)
              ? 'confirmed'
              : 'pending',
        });
      });
    }

    // ── абонементы и сертификаты ──
    if (['beauty', 'barber'].includes(b.typeCode)) {
      rng.sample(bizCustomers, 6).forEach((c, i) => {
        deposits.push({
          id: `dep_${b.slug}_${i + 1}`,
          businessId: b.id,
          customerId: c.id,
          balance: rng.int(1, 8) * 5000,
          kind: rng.pick(['deposit', 'subscription', 'certificate'] as const),
        });
      });
    }

    // ── журнал действий ──
    const logDefs: [string, string, Record<string, unknown>][] = [
      ['tool_activated', 'Активирован инструмент «Программа лояльности»', { toolId: 'tool_loyalty' }],
      ['promo_created', `Создана акция «${plan[0].title}»`, { promoId: `promo_${b.slug}_1` }],
      ['campaign_sent', 'Отправлена рассылка по сегменту', { segment: plan[0].segment }],
      ['loyalty_updated', 'Изменён порог награды', { rewardThreshold: seed.loyalty.rewardThreshold }],
      ['staff_added', 'Добавлен сотрудник — кассир', { staffId: cashier.id }],
      ['promo_launched', `Запущена акция «${plan[1]?.title ?? plan[0].title}»`, { promoId: `promo_${b.slug}_2` }],
    ];
    logDefs.forEach(([type, label, payload], i) => {
      activityLog.push({
        id: `log_${b.slug}_${i + 1}`,
        businessId: b.id,
        actorId: owner.id,
        actorName: owner.name,
        type,
        payload: { ...payload, label },
        at: iso(shift(now, -rng.int(1, 60))),
      });
    });
  });

  const primaryBusinessId = businesses[0]?.id ?? null;
  const primaryStaff = staff.filter((item) => item.businessId === primaryBusinessId);
  const demoPassword = process.env.LOCALY_DEMO_PASSWORD || 'Localy2026';
  if ((process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL_ENV === 'production') && !process.env.LOCALY_DEMO_PASSWORD) {
    throw new Error('Для production seed задайте LOCALY_DEMO_PASSWORD');
  }
  const passwordSalt = randomBytes(16);
  const passwordHash = `scrypt:${passwordSalt.toString('base64url')}:${scryptSync(demoPassword, passwordSalt, 64).toString('base64url')}`;
  const user = (
    id: string,
    login: string,
    name: string,
    role: User['role'],
    staffRole?: Staff['role'],
  ): User => ({
    id,
    login,
    name,
    passwordHash,
    role,
    businessId: role === 'platform_admin' ? null : primaryBusinessId,
    staffId: primaryStaff.find((item) => item.role === staffRole)?.id ?? null,
    active: true,
    createdAt: iso(now),
  });
  const users: User[] = [
    user('usr_owner', 'owner@localy.kz', 'Азим Сериков', 'owner', 'owner'),
    user('usr_business_admin', 'admin@localy.kz', 'Дана Калиева', 'admin', 'admin'),
    user('usr_marketer', 'marketing@localy.kz', 'Мадина Нурланова', 'marketer', 'marketer'),
    user('usr_cashier', 'cashier@localy.kz', 'Алмас Есенов', 'cashier', 'cashier'),
    user('usr_platform', 'platform@localy.kz', 'Админ Localy', 'platform_admin'),
  ];

  return {
    users,
    businessTypes: BUSINESS_TYPES,
    tools: TOOLS,
    templates: TEMPLATES,
    recommendationSettings,
    businesses,
    plans,
    subscriptions,
    subscriptionPayments,
    branches,
    businessQrStats,
    staff,
    loyaltyConfigs,
    siteConfigs,
    businessTools,
    customers,
    memberships,
    transactions: transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    anonymousSales: anonymousSales.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    promos,
    promoEvents,
    campaigns,
    bookings,
    deposits,
    activityLog: activityLog.sort((a, b) => b.at.localeCompare(a.at)),
  };
}
