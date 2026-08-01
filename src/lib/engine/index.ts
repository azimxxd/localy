/**
 * Localy — движок сегментации, прогноза и рекомендаций.
 *
 * Чистые функции. Никаких обращений к сети и БД: демо не может упасть
 * из-за внешнего сервиса, а каждую цифру можно объяснить жюри.
 * LLM здесь не участвует — он только пишет тексты, см. src/app/api/ai/*.
 */

import { daysBetween } from '@/lib/engine/activity';
import type {
  Business,
  BusinessStats,
  CustomerProfile,
  GrowthPlan,
  LoyaltyConfig,
  Promo,
  PromoForecast,
  PromoKind,
  Recommendation,
  Segment,
  SegmentCode,
  RecommendationRuleSetting,
  Tool,
} from '@/lib/types';

export * from '@/lib/engine/activity';

// ─────────────────────────────────────────────────────────────
// Сегментация — все 13 групп
// ─────────────────────────────────────────────────────────────

export const SEGMENT_META: Record<SegmentCode, { title: string; description: string }> = {
  new: { title: 'Новые', description: 'Первый визит за последние 30 дней' },
  returning: { title: 'Вернувшиеся', description: 'Пришли повторно после первого визита' },
  habit_forming: { title: 'Формируют привычку', description: 'Ходят несколько недель, но ещё не стали постоянными' },
  regular: { title: 'Постоянные', description: 'Ходят стабильно и часто' },
  loyal: { title: 'Лояльные', description: 'Давно с вами и много тратят' },
  declining: { title: 'Активность снижается', description: 'Стали приходить реже своего обычного ритма' },
  lapsed: { title: 'Давно не приходили', description: 'Пропустили срок возврата в разы' },
  at_risk: { title: 'Под риском ухода', description: 'Пропустили ожидаемый период возвращения' },
  high_points: { title: 'Много бонусов', description: 'Накопили больше порога награды' },
  expiring_points: { title: 'Бонусы скоро сгорят', description: 'Сгорание в ближайшие 7 дней' },
  promo_lovers: { title: 'Пользуются акциями', description: 'Уже приходили по предложению' },
  item_buyers: {
    title: 'Покупают определённый товар',
    description: 'Есть выраженный любимый товар',
  },
  high_check: { title: 'Высокий средний чек', description: 'Тратят больше среднего по заведению' },
  no_booking: { title: 'Давно не записывались', description: 'Нет записи дольше обычного' },
  birthday_soon: { title: 'День рождения близко', description: 'День рождения в ближайшие 14 дней' },
  campaign_arrival: { title: 'Пришли по акции', description: 'Вернулись после конкретного предложения' },
  no_consent: { title: 'Без согласия на рассылку', description: 'Исключаются из всех кампаний' },
};

export interface SegmentContext {
  loyalty: LoyaltyConfig;
  /** Сколько акций клиент использовал: customerId → количество redeemed. */
  redeemedPromosByCustomer: Record<string, number>;
  /** Дата последней записи: customerId → ISO. Нет записи — ключа нет. */
  lastBookingByCustomer: Record<string, string>;
  campaignCustomers: string[];
  /** Средний чек по заведению — база для сегмента high_check. */
  businessAvgCheck: number;
  now?: string;
}

function isBirthdaySoon(birthday: string | null, now: Date, withinDays = 14): boolean {
  if (!birthday) return false;
  const [, month, day] = birthday.split('-').map(Number);
  if (!month || !day) return false;

  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day));
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, month - 1, day));
  const target = thisYear >= now ? thisYear : nextYear;

  const diffDays = Math.floor((target.getTime() - now.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= withinDays;
}

/** Принадлежит ли профиль сегменту. Один предикат — один сегмент. */
export function matchesSegment(code: SegmentCode, p: CustomerProfile, ctx: SegmentContext): boolean {
  const nowIso = ctx.now ?? new Date().toISOString();
  const now = new Date(nowIso);
  const lifetimeDays = daysBetween(p.membership.firstSeen, nowIso);

  switch (code) {
    case 'new':
      return p.level === 'new' || lifetimeDays <= 30;
    case 'returning':
      return p.level === 'returning';
    case 'habit_forming':
      return p.level === 'habit_forming';
    case 'regular':
      return p.level === 'regular';
    case 'loyal':
      return p.level === 'loyal';
    case 'declining':
      return p.activity === 'declining';
    case 'lapsed':
      return p.activity === 'lapsed';
    case 'at_risk':
      return p.activity === 'at_risk';
    case 'high_points':
      return p.membership.points >= ctx.loyalty.rewardThreshold;
    case 'expiring_points': {
      if (!ctx.loyalty.expiryDays || p.membership.points <= 0) return false;
      const daysHeld = daysBetween(p.membership.lastSeen, nowIso);
      const daysLeft = ctx.loyalty.expiryDays - daysHeld;
      return daysLeft > 0 && daysLeft <= 7;
    }
    case 'promo_lovers':
      // Хотя бы одна использованная акция. Порог в две отсекал почти всех:
      // у малого бизнеса за квартал проходит две-три акции, не двадцать.
      return (ctx.redeemedPromosByCustomer[p.customer.id] ?? 0) >= 1;
    case 'item_buyers':
      // Не «покупал хоть что-то», а выраженное предпочтение: узкий набор
      // позиций при достаточной истории. Иначе сегмент = вся база.
      return (
        p.membership.favoriteItems.length > 0 &&
        p.membership.favoriteItems.length <= 2 &&
        p.membership.visits >= 4
      );
    case 'high_check':
      return ctx.businessAvgCheck > 0 && p.avgCheck > ctx.businessAvgCheck * 1.25;
    case 'no_booking': {
      const last = ctx.lastBookingByCustomer[p.customer.id];
      if (!last) return p.membership.visits > 2;
      return daysBetween(last, nowIso) > Math.max(30, p.medianIntervalDays * 2);
    }
    case 'birthday_soon':
      return isBirthdaySoon(p.customer.birthday, now);
    case 'campaign_arrival':
      return ctx.campaignCustomers.includes(p.customer.id);
    case 'no_consent':
      return p.membership.consentChannels.length === 0;
  }
}

/** Собрать все сегменты разом. Владелец не листает сотни карточек вручную. */
export function computeSegments(profiles: CustomerProfile[], ctx: SegmentContext): Segment[] {
  return (Object.keys(SEGMENT_META) as SegmentCode[]).map((code) => {
    const ids = profiles.filter((p) => matchesSegment(code, p, ctx)).map((p) => p.customer.id);
    return {
      code,
      title: SEGMENT_META[code].title,
      description: SEGMENT_META[code].description,
      count: ids.length,
      customerIds: ids,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Симулятор акции — прогноз ДО запуска
// ─────────────────────────────────────────────────────────────

/**
 * Ожидаемая доля отклика по типу акции.
 * Консервативные ориентиры для малого офлайн-бизнеса. На питче называем
 * их допущениями модели, а не измерениями — это честно и защитимо.
 */
const RESPONSE_RATE: Record<PromoKind, number> = {
  discount: 0.22,
  coupon: 0.18,
  points: 0.15,
  gift: 0.24,
  two_plus_one: 0.2,
  double_points: 0.16,
  return_reward: 0.19,
  item_promo: 0.14,
  winback: 0.12,
  birthday: 0.45,
  referral: 0.08,
};

/** Во сколько раз охотнее реагирует сегмент по сравнению со средним. */
const SEGMENT_MULTIPLIER: Partial<Record<SegmentCode, number>> = {
  loyal: 1.5,
  regular: 1.3,
  returning: 1.1,
  promo_lovers: 1.6,
  birthday_soon: 1.8,
  at_risk: 0.8,
  lapsed: 0.45,
  new: 0.9,
};

export interface ForecastInput {
  kind: PromoKind;
  /** Смысл зависит от типа акции — см. PROMO_VALUE_MEANING. */
  value: number;
  segment: SegmentCode;
  audienceSize: number;
  avgCheck: number;
  /** Валовая маржа заведения, 0..1. По умолчанию 0.65 — типично для кофейни. */
  margin?: number;
  /** Бонусов за 1 тенге — нужно для расчёта стоимости бонусных акций. */
  pointsPerCurrency?: number;
}

/**
 * Что означает поле value у каждого типа акции. Форма конструктора
 * подставляет отсюда подпись к полю, симулятор — формулу затрат.
 */
export const PROMO_VALUE_MEANING: Record<PromoKind, 'percent' | 'currency' | 'points' | 'multiplier'> = {
  discount: 'percent',
  winback: 'percent',
  return_reward: 'percent',
  item_promo: 'percent',
  two_plus_one: 'percent',
  coupon: 'currency',
  gift: 'currency',
  birthday: 'currency',
  points: 'points',
  referral: 'points',
  double_points: 'multiplier',
};

/**
 * Во сколько заведению обходится один откликнувшийся.
 *
 * Считаем по-разному, потому что это разные деньги:
 *  - процентная скидка   → недополученная выручка целиком
 *  - подарок, товар 2+1  → только себестоимость, не ценник
 *  - бонусы              → 1 бонус = 1 тенге будущей скидки
 *  - двойные бонусы      → лишние бонусы сверх обычного начисления
 *
 * Без этого разделения бонусные акции выглядели бы бесплатными,
 * а ROI улетал в сотни — цифру, которую невозможно защитить.
 */
function costPerResponder(input: ForecastInput, margin: number): number {
  const { kind, value, avgCheck } = input;
  const pointsRate = input.pointsPerCurrency ?? 0.05;
  const cogs = 1 - margin;

  switch (kind) {
    case 'discount':
    case 'winback':
    case 'return_reward':
    case 'item_promo':
      return avgCheck * (value / 100);
    case 'two_plus_one':
      // Отдаём товар, а не деньги — теряем себестоимость
      return avgCheck * (value / 100) * cogs;
    case 'gift':
    case 'birthday':
      return value * cogs;
    case 'coupon':
      return value;
    case 'points':
    case 'referral':
      return value;
    case 'double_points':
      return avgCheck * pointsRate * Math.max(0, value - 1);
  }
}

/**
 * Прогноз результата акции до её запуска.
 * Владелец видит цифру прежде, чем потратил деньги.
 */
export function forecastPromo(input: ForecastInput): PromoForecast {
  const margin = input.margin ?? 0.65;
  const base = RESPONSE_RATE[input.kind] ?? 0.15;
  const multiplier = SEGMENT_MULTIPLIER[input.segment] ?? 1;

  // Слишком большая скидка не увеличивает отклик линейно — эффект насыщается
  const valueBoost = input.kind === 'discount' ? Math.min(1.6, 1 + input.value / 100) : 1;

  const rate = Math.min(0.75, base * multiplier * valueBoost);
  const responders = Math.round(input.audienceSize * rate);

  // Ушедшие и новые дают приток, остальные — возвраты
  const isAcquisition = input.segment === 'new' || input.kind === 'referral';
  const expectedNewCustomers = isAcquisition ? responders : Math.round(responders * 0.15);
  const expectedReturns = responders - expectedNewCustomers;

  // Скидка уменьшает чек только у процентных акций
  const discountShare =
    PROMO_VALUE_MEANING[input.kind] === 'percent' && input.kind !== 'two_plus_one'
      ? input.value / 100
      : 0;
  const revenue = Math.round(responders * input.avgCheck * (1 - discountShare));

  const cost = Math.round(responders * costPerResponder(input, margin));
  const grossProfit = revenue * margin;
  // ROI считаем как отношение валовой прибыли к затратам на акцию.
  // Ограничиваем сверху: за пределами 15× модель перестаёт быть честной,
  // такие цифры означают лишь, что затраты близки к нулю.
  const roi = cost > 0 ? Math.min(15, Math.round((grossProfit / cost) * 10) / 10) : 0;

  return {
    expectedNewCustomers,
    expectedReturns,
    expectedRevenue: revenue,
    expectedCost: cost,
    roi,
    breakEvenDiscount: Math.round(margin * 100),
  };
}

// ─────────────────────────────────────────────────────────────
// Автоматические рекомендации — правила, не LLM
// ─────────────────────────────────────────────────────────────

const WEEKDAY_NAMES = [
  'воскресеньям',
  'понедельникам',
  'вторникам',
  'средам',
  'четвергам',
  'пятницам',
  'субботам',
];

/**
 * Что делать прямо сейчас. Сортировка по приоритету, показываем 3–5 верхних.
 * Каждая рекомендация ведёт на готовое действие, а не просто сообщает факт.
 */
export function recommend(params: {
  segments: Segment[];
  stats: BusinessStats;
  promos: Promo[];
  loyalty: LoyaltyConfig;
}): Recommendation[] {
  const { segments, stats, promos, loyalty } = params;
  const seg = (code: SegmentCode) => segments.find((s) => s.code === code);
  const out: Recommendation[] = [];

  const lapsed = seg('lapsed');
  if (lapsed && lapsed.count > 0) {
    out.push({
      id: 'rec-lapsed',
      title: `${lapsed.count} клиентов не посещали вас дольше обычного`,
      action: 'Создайте предложение на повторное посещение',
      actionKind: 'create_promo',
      priority: 5,
      segment: 'lapsed',
      suggestedPromoKind: 'winback',
      affectedCount: lapsed.count,
    });
  }

  const expiring = seg('expiring_points');
  if (expiring && expiring.count > 0 && loyalty.expiryDays) {
    out.push({
      id: 'rec-expiring',
      title: `У ${expiring.count} клиентов бонусы сгорят в ближайшие 7 дней`,
      action: 'Отправьте напоминание, пока бонусы не пропали',
      actionKind: 'send_campaign',
      priority: 5,
      segment: 'expiring_points',
      affectedCount: expiring.count,
    });
  }

  const atRisk = seg('at_risk');
  if (atRisk && atRisk.count > 0) {
    out.push({
      id: 'rec-at-risk',
      title: `${atRisk.count} постоянных клиентов стали приходить реже`,
      action: 'Верните их персональным предложением, пока они не ушли',
      actionKind: 'create_promo',
      priority: 4,
      segment: 'at_risk',
      suggestedPromoKind: 'return_reward',
      affectedCount: atRisk.count,
    });
  }

  const birthday = seg('birthday_soon');
  if (birthday && birthday.count > 0) {
    out.push({
      id: 'rec-birthday',
      title: `У ${birthday.count} клиентов день рождения в ближайшие 2 недели`,
      action: 'Настройте автоматический подарок ко дню рождения',
      actionKind: 'schedule_promo',
      priority: 3,
      segment: 'birthday_soon',
      suggestedPromoKind: 'birthday',
      affectedCount: birthday.count,
    });
  }

  // Самый слабый день недели — повод для точечной акции
  if (stats.byWeekday.length > 0) {
    const worst = [...stats.byWeekday].sort((a, b) => a.visits - b.visits)[0];
    const total = stats.byWeekday.reduce((s, d) => s + d.visits, 0);
    const avg = total / stats.byWeekday.length;
    if (worst.visits < avg * 0.6) {
      out.push({
        id: 'rec-weekday',
        title: `По ${WEEKDAY_NAMES[worst.weekday]} у вас меньше всего посещений`,
        action: 'Запустите двойные бонусы в этот день',
        actionKind: 'create_promo',
        priority: 3,
        suggestedPromoKind: 'double_points',
        affectedCount: worst.visits,
      });
    }
  }

  // Сравнение результатов завершённых акций
  const finished = promos.filter((p) => p.status === 'finished' && p.forecast);
  if (finished.length >= 2) {
    const sorted = [...finished].sort((a, b) => (b.forecast?.roi ?? 0) - (a.forecast?.roi ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    out.push({
      id: 'rec-compare',
      title: `Акция «${best.title}» сработала лучше, чем «${worst.title}»`,
      action: 'Повторите более удачный формат',
      actionKind: 'create_promo',
      priority: 2,
      suggestedPromoKind: best.kind,
      affectedCount: best.audienceSize,
    });
  }

  // Мало покупок привязано к картам — кассиры не предлагают программу
  if (stats.identifiedShare < 0.5 && stats.visits > 20) {
    out.push({
      id: 'rec-identified',
      title: `Только ${Math.round(stats.identifiedShare * 100)}% покупок привязаны к клиентским картам`,
      action: 'Напомните кассирам предлагать бонусную карту на кассе',
      actionKind: 'activate_tool',
      priority: 4,
      affectedCount: stats.visits,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export function applyRecommendationSettings(items: Recommendation[], settings: RecommendationRuleSetting[]): Recommendation[] {
  const byId = new Map(settings.map((setting) => [setting.id, setting]));
  return items
    .filter((item) => byId.get(item.id)?.active !== false)
    .map((item) => {
      const setting = byId.get(item.id);
      return setting ? { ...item, action: setting.actionText, priority: setting.priority } : item;
    })
    .sort((a, b) => b.priority - a.priority);
}

// ─────────────────────────────────────────────────────────────
// План роста на 30 дней — результат онбординга
// ─────────────────────────────────────────────────────────────

/**
 * Онбординг выдаёт не список инструментов, а календарь на месяц:
 * что включить на этой неделе, что на следующей.
 */
export function buildGrowthPlan(business: Business, tools: Tool[]): GrowthPlan {
  const relevant = tools
    .filter((t) => t.forTypes.length === 0 || t.forTypes.includes(business.typeCode))
    .sort((a, b) => b.impact - a.impact);

  const pick = (category: Tool['category'], n: number) =>
    relevant
      .filter((t) => t.category === category)
      .slice(0, n)
      .map((t) => t.id);

  const nicheLaunch: Record<Business['typeCode'], string[]> = {
    coffee: [
      'Опубликуйте сайт с меню и актуальными ценами',
      'Запустите награду «Каждый шестой напиток бесплатно»',
      'Поставьте QR-табличку на кассе и на столах',
    ],
    barber: [
      'Откройте онлайн-запись и добавьте услуги мастеров',
      'Настройте напоминание о следующей стрижке через 28 дней',
      'Дайте скидку на первое посещение и бонус за друга',
    ],
    beauty: [
      'Опубликуйте услуги, цены и свободные окна для записи',
      'Настройте награду за пять посещений',
      'Отправьте персональное напоминание к обычному сроку повтора',
    ],
    flower: [
      'Опубликуйте каталог букетов по поводам и ценам',
      'Добавьте быструю заявку на доставку',
      'Настройте напоминания о днях рождения и важных датах',
    ],
    repair: [
      'Опубликуйте перечень услуг и форму заявки на диагностику',
      'Собирайте историю ремонтов, а не ожидайте еженедельных визитов',
      'Запланируйте напоминание о диагностике через 4–6 месяцев',
    ],
    retail: [
      'Соберите каталог ходовых товаров и опубликуйте сайт',
      'Дайте стартовые бонусы за регистрацию по QR',
      'Создайте первую акцию на товар с низким спросом',
    ],
  };

  const acquisitionStep = business.goals.includes('new_customers')
    ? 'Запустите предложение для первого визита'
    : 'Пригласите вернуться тех, кто стал приходить реже';

  return {
    businessId: business.id,
    weeks: [
      {
        week: 1,
        title: 'Запуск: собираем клиентскую базу',
        toolIds: [...pick('retention', 1), ...pick('automation', 1)],
        steps: nicheLaunch[business.typeCode],
      },
      {
        week: 2,
        title: 'Первые данные: смотрим, кто к вам ходит',
        toolIds: pick('analytics', 2),
        steps: [
          'Проверьте карточки клиентов — система уже определила уровни и активность',
          'Посмотрите, какие товары покупают чаще всего',
          'Соберите сегмент постоянных клиентов',
        ],
      },
      {
        week: 3,
        title: 'Первая акция: возвращаем ушедших',
        toolIds: pick('marketing', 2),
        steps: [
          acquisitionStep,
          'Создайте акцию и посмотрите прогноз до запуска',
          'Отправьте рассылку тем, кто дал согласие',
        ],
      },
      {
        week: 4,
        title: 'Результат: считаем деньги',
        toolIds: pick('sales', 2),
        steps: [
          'Откройте воронку акции: сколько пришло и сколько принесло',
          'Сравните результат с прогнозом',
          'Повторите то, что сработало, на соседнем сегменте',
        ],
      },
    ],
  };
}
