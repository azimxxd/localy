/**
 * Localy — единый контракт данных.
 *
 * ВАЖНО: этот файл меняется ТОЛЬКО совместно двумя разработчиками,
 * коммитом с префиксом `contract:`. Всё остальное — своя зона владения.
 *
 * Соглашения:
 *  - все даты  — ISO 8601 строкой в UTC: "2026-07-29T14:30:00Z"
 *  - все суммы — целые тенге, без копеек
 *  - все id    — uuid строкой
 */

// ─────────────────────────────────────────────────────────────
// Справочники
// ─────────────────────────────────────────────────────────────

/** Ниша бизнеса. Определяет набор рекомендуемых инструментов и шаблонов. */
export type BusinessTypeCode =
  | 'coffee' // кофейня
  | 'barber' // барбершоп
  | 'beauty' // салон красоты
  | 'flower' // цветочный магазин
  | 'repair' // ремонт техники
  | 'retail'; // небольшой магазин

export interface BusinessType {
  id: string;
  code: BusinessTypeCode;
  title: string;
  icon: string;
  /** Запасной цикл визита, если у клиента ещё недостаточно истории. */
  defaultRepeatVisitDays: number;
  /** Границы статусов как множители обычного цикла визита. */
  activityThresholds: ActivityThresholds;
}

export interface ActivityThresholds {
  declining: number;
  atRisk: number;
  lapsed: number;
}

/** Категория инструмента в каталоге. Ровно эти пять — требование положения. */
export type ToolCategory =
  | 'marketing' // маркетинг
  | 'sales' // продажи
  | 'retention' // удержание клиентов
  | 'analytics' // аналитика
  | 'automation'; // автоматизация

/** Тип функции — показывается на карточке инструмента. */
export type ToolKind = 'module' | 'automation' | 'template' | 'integration';

export interface Tool {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  kind: ToolKind;
  /** Для каких ниш инструмент осмыслен. Пустой массив = для всех. */
  forTypes: BusinessTypeCode[];
  /** Ожидаемый эффект, для сортировки в рекомендациях: 1..5 */
  impact: number;
  icon: string;
}

/** Связь бизнеса с инструментом: активирован и/или в избранном. */
export interface BusinessTool {
  businessId: string;
  toolId: string;
  activatedAt: string | null;
  isFavorite: boolean;
}

/** Готовый маркетинговый шаблон (текст акции, рассылки, оформление). */
export interface Template {
  id: string;
  title: string;
  category: ToolCategory;
  businessTypes: BusinessTypeCode[];
  kind: 'promo' | 'campaign' | 'site';
  body: string;
}

// ─────────────────────────────────────────────────────────────
// Бизнес
// ─────────────────────────────────────────────────────────────

export type PlanTier = 'free' | 'basic' | 'pro';

export interface PlanLimits {
  customers: number;
  campaignsPerMonth: number;
  staff: number;
  branches: number;
  activePromos: number;
}

export interface Plan {
  tier: PlanTier;
  title: string;
  priceKzt: number;
  description: string;
  features: string[];
  limits: PlanLimits;
}

export interface Subscription {
  businessId: string;
  plan: PlanTier;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  startedAt: string;
  nextBillingAt: string | null;
}

export interface SubscriptionPayment {
  id: string;
  businessId: string;
  plan: PlanTier;
  amountKzt: number;
  status: 'paid' | 'demo';
  at: string;
}

/** Цель, выбираемая при онбординге. Влияет на План роста на 30 дней. */
export type BusinessGoal =
  | 'create_site'
  | 'new_customers' // привлечь новых
  | 'return_customers' // вернуть ушедших
  | 'increase_check' // поднять средний чек
  | 'increase_frequency' // повысить частоту визитов
  | 'launch_loyalty'
  | 'collect_clients'
  | 'online_booking'
  | 'automate'; // автоматизировать рутину

export interface Business {
  id: string;
  slug: string;
  name: string;
  typeCode: BusinessTypeCode;
  city: string;
  address?: string;
  employeeCount?: number;
  branchCount?: number;
  offerings?: string[];
  repeatVisitDays?: number;
  currentTools?: string[];
  onboardingCompleted?: boolean;
  /** Средний чек в тенге — база для симулятора прогноза. */
  avgCheck: number;
  goals: BusinessGoal[];
  plan: PlanTier;
  active?: boolean;
  brandColor: string;
  logoUrl: string | null;
  createdAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  title: string;
  address: string;
  phone: string;
}

export interface BusinessQrStats {
  businessId: string;
  scans: number;
  registrations: number;
}

/** Настройки бонусной программы конкретного бизнеса. */
export interface LoyaltyConfig {
  businessId: string;
  /** Сколько бонусов начисляется за 1 тенге покупки. Напр. 0.05 = 5%. */
  pointsPerCurrency: number;
  /** Сколько бонусов нужно накопить до награды. */
  rewardThreshold: number;
  rewardTitle: string;
  /** Через сколько дней сгорают бонусы. null = не сгорают. */
  expiryDays: number | null;
  /** Максимальная доля чека, которую можно оплатить бонусами. */
  maxRedemptionPercent?: number;
  startBonus?: number;
  minPurchaseAmount?: number;
  excludedItems?: string[];
  /** Награда за количество визитов, независимо от бонусного баланса. */
  rewardEveryVisits?: number;
}

/** Конфигурация сайта бизнеса — то, что рендерит /b/[slug]. */
export interface SiteConfig {
  businessId: string;
  templateId: string;
  sections: SiteSection[];
  published: boolean;
  description?: string;
  coverUrl?: string | null;
  logoUrl?: string | null;
  galleryUrls?: string[];
  phone?: string;
  workHours?: string;
  telegram?: string;
  whatsapp?: string;
  instagram?: string;
  /** Соцсети и площадки в виде отдельных значений, введённых через запятую. */
  socials?: string[];
  primaryColor?: string;
  fontStyle?: 'clean' | 'editorial' | 'friendly';
  /** Общий заголовок блока каталога; category у CatalogItem — это группа отдельной позиции. */
  catalogTitle?: string;
  catalog?: CatalogItem[];
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  active: boolean;
}

export interface SiteSection {
  kind: 'hero' | 'about' | 'services' | 'promos' | 'loyalty' | 'contacts' | 'booking' | 'lead';
  enabled: boolean;
  title: string;
  body: string;
}

// ─────────────────────────────────────────────────────────────
// Сотрудники
// ─────────────────────────────────────────────────────────────

/** Кассир видит только /pos. Разграничение — в src/lib/permissions.ts */
export type StaffRole = 'owner' | 'admin' | 'marketer' | 'cashier' | 'manager';

/** Роль пользователя приложения. Администратор Localy не привязан к бизнесу. */
export type UserRole = StaffRole | 'platform_admin';

/**
 * Учётная запись для входа. Пароль хранится только в виде хеша и никогда не
 * возвращается клиентским компонентам.
 */
export interface User {
  id: string;
  login: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  businessId: string | null;
  staffId: string | null;
  active: boolean;
  createdAt: string;
}

export interface Staff {
  id: string;
  businessId: string;
  branchId: string | null;
  name: string;
  role: StaffRole;
  /** PIN кассира. В интерфейс владельца возвращается только маска. */
  pin: string;
  active?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Клиент — ГЛОБАЛЬНЫЙ, один на всю платформу
// ─────────────────────────────────────────────────────────────

/**
 * Ядро продукта: один человек — один аккаунт — один QR на все заведения.
 * Балансы и история раздельные, они живут в Membership.
 */
export interface Customer {
  id: string;
  phone: string;
  name: string;
  /** Дата рождения, "1998-04-17". Для сегмента «скоро день рождения». */
  birthday: string | null;
  /** Динамический токен QR. Ротируется раз в QR_ROTATION_SECONDS. */
  qrToken: string;
  qrRotatedAt: string;
  createdAt: string;
}

export type NotificationChannel = 'telegram' | 'email' | 'sms' | 'whatsapp' | 'push';

/** Связь клиента с конкретным бизнесом: баланс, история, согласия. */
export interface Membership {
  businessId: string;
  customerId: string;
  points: number;
  visits: number;
  firstSeen: string;
  lastSeen: string;
  totalSpent: number;
  /** Каналы, на которые клиент дал согласие. Пустой = не писать вообще. */
  consentChannels: NotificationChannel[];
  favoriteItems: string[];
  /** Сколько наград за серии визитов уже выдано. */
  claimedVisitRewards?: number;
  source?: string;
  notes?: string;
}

/** Уровень лояльности — по количеству визитов, сроку жизни и сумме. */
export type LoyaltyLevel = 'new' | 'returning' | 'habit_forming' | 'regular' | 'loyal';

/**
 * Текущая активность — считается от ЛИЧНОЙ частоты визитов клиента,
 * а не от абсолютных цифр. Кофейня и ремонт телефонов обрабатываются
 * одной формулой: медиана интервалов растягивает пороги сама.
 */
export type ActivityState = 'active' | 'declining' | 'at_risk' | 'lapsed';

/** Membership + вычисленные поля. То, что показывается в карточке CRM. */
export interface CustomerProfile {
  customer: Customer;
  membership: Membership;
  level: LoyaltyLevel;
  activity: ActivityState;
  /** Обычная частота визитов этого человека, в днях. */
  medianIntervalDays: number;
  daysSinceLastVisit: number;
  avgCheck: number;
  /** Сколько визитов осталось до награды. */
  visitsToReward: number;
  /** Вероятность визита в ближайшие 7 дней, 0..1. */
  visitProbability7d: number;
}

// ─────────────────────────────────────────────────────────────
// Транзакции
// ─────────────────────────────────────────────────────────────

export type TransactionKind =
  | 'purchase' // покупка с начислением
  | 'accrue' // ручное начисление
  | 'redeem' // списание бонусов
  | 'reward'; // выдача награды

export interface Transaction {
  id: string;
  businessId: string;
  branchId: string | null;
  customerId: string;
  staffId: string | null;
  /** Сумма покупки в тенге. Для redeem/reward = 0. */
  amount: number;
  /** Изменение бонусного баланса: + начисление, − списание. */
  pointsDelta: number;
  accruedPoints?: number;
  redeemedPoints?: number;
  status?: 'pending_confirmation' | 'completed' | 'cancelled';
  rewardTitle?: string | null;
  promoId?: string | null;
  kind: TransactionKind;
  items: string[];
  createdAt: string;
}

/** Импортированный из кассы чек без клиентского QR. */
export interface AnonymousSale {
  id: string;
  businessId: string;
  branchId: string | null;
  amount: number;
  items: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Сегменты
// ─────────────────────────────────────────────────────────────

/** Полезные автосегменты CRM. */
export type SegmentCode =
  | 'new'
  | 'returning'
  | 'habit_forming'
  | 'regular'
  | 'loyal'
  | 'declining'
  | 'lapsed'
  | 'at_risk'
  | 'high_points'
  | 'expiring_points'
  | 'promo_lovers'
  | 'item_buyers'
  | 'high_check'
  | 'no_booking'
  | 'birthday_soon'
  | 'campaign_arrival'
  | 'no_consent';

export interface Segment {
  code: SegmentCode;
  title: string;
  description: string;
  count: number;
  customerIds: string[];
}

// ─────────────────────────────────────────────────────────────
// Акции
// ─────────────────────────────────────────────────────────────

/** 11 типов акций из продуктовой спеки. */
export type PromoKind =
  | 'discount' // скидка
  | 'coupon' // купон
  | 'points' // бонусы
  | 'gift' // подарок
  | 'two_plus_one' // товар 2+1
  | 'double_points' // двойные бонусы
  | 'return_reward' // награда за повторное посещение
  | 'item_promo' // акция на конкретный товар
  | 'winback' // предложение давно не приходившим
  | 'birthday' // подарок на день рождения
  | 'referral'; // реферальная программа

export type PromoStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'finished';

export type PromoGoal =
  | 'new_customers'
  | 'return_customers'
  | 'increase_frequency'
  | 'increase_check'
  | 'sell_item'
  | 'activate_points'
  | 'referrals'
  | 'fill_quiet_time';

export type PromoPlacement = 'site' | 'client_app' | 'cashier' | 'qr_landing';

/**
 * Прогноз ДО запуска акции — ключевое отличие Localy.
 * Владелец видит цифру прежде, чем потратил деньги.
 */
export interface PromoForecast {
  /** CRM-аудитория или оценочный публичный охват, на котором построен прогноз. */
  estimatedAudience?: number;
  expectedNewCustomers: number;
  expectedReturns: number;
  expectedRevenue: number;
  /** Затраты на акцию: скидки, подарки, себестоимость бонусов. */
  expectedCost: number;
  roi: number;
  /** Скидка в процентах, при которой акция уходит в минус. */
  breakEvenDiscount: number;
}

export interface Promo {
  id: string;
  businessId: string;
  kind: PromoKind;
  title: string;
  /** Размер: проценты для discount, штуки бонусов для points и т.д. */
  value: number;
  segment: SegmentCode;
  goal?: PromoGoal;
  /** public — ещё не зарегистрированные люди; segment — клиенты из CRM. */
  audienceMode?: 'public' | 'segment';
  branchId?: string | null;
  channel?: NotificationChannel;
  placements?: PromoPlacement[];
  body?: string;
  audienceSize: number;
  startsAt: string;
  endsAt: string;
  status: PromoStatus;
  forecast: PromoForecast | null;
  promocode: string;
  createdAt: string;
}

/** Стадия воронки. */
export type PromoStage = 'sent' | 'opened' | 'clicked' | 'visited' | 'redeemed';

export interface PromoEvent {
  promoId: string;
  customerId: string;
  stage: PromoStage;
  at: string;
}

/** Итог акции — не «отправлено сообщений», а деньги. */
export interface PromoFunnel {
  promoId: string;
  sent: number;
  opened: number;
  clicked: number;
  visited: number;
  redeemed: number;
  revenue: number;
}

// ─────────────────────────────────────────────────────────────
// Рассылки
// ─────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  businessId: string;
  promoId: string | null;
  channel: NotificationChannel;
  audienceSegment: SegmentCode;
  audienceSize: number;
  body: string;
  sentAt: string | null;
  opened?: number;
  clicked?: number;
  visited?: number;
  redeemed?: number;
  /** Фактические получатели после consent- и anti-spam-фильтра. */
  recipientIds?: string[];
  /** В MVP отправки нет — интерфейс полный, симуляция. */
  simulated: boolean;
}

// ─────────────────────────────────────────────────────────────
// Аналитика и рекомендации
// ─────────────────────────────────────────────────────────────

export interface BusinessStats {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatVisits: number;
  visits: number;
  avgCheck: number;
  activeCustomers: number;
  atRiskShare: number;
  atRiskCustomers: number;
  pointsAccrued: number;
  pointsRedeemed: number;
  revenue: number;
  pointsUnspent: number;
  activePromoConversion: number;
  /** Доля покупок, привязанных к клиентским картам. */
  identifiedShare: number;
  topItems: { title: string; count: number }[];
  byWeekday: { weekday: number; visits: number }[];
}

export type RecommendationAction =
  | 'create_promo'
  | 'send_campaign'
  | 'activate_tool'
  | 'adjust_loyalty'
  | 'schedule_promo';

/** Правило, не LLM. Демо не должно зависеть от внешнего сервиса. */
export interface Recommendation {
  id: string;
  /** «42 клиента не приходили дольше обычного» */
  title: string;
  /** «Создайте предложение на повторное посещение» */
  action: string;
  actionKind: RecommendationAction;
  /** Приоритет 1..5, чем выше — тем раньше в списке. */
  priority: number;
  segment?: SegmentCode;
  suggestedPromoKind?: PromoKind;
  affectedCount: number;
}

export interface RecommendationRuleSetting {
  id: string;
  label: string;
  actionText: string;
  priority: number;
  active: boolean;
}

/** План роста на 30 дней — результат онбординга. */
export interface GrowthPlan {
  businessId: string;
  weeks: GrowthPlanWeek[];
}

export interface GrowthPlanWeek {
  week: 1 | 2 | 3 | 4;
  title: string;
  toolIds: string[];
  steps: string[];
}

// ─────────────────────────────────────────────────────────────
// Аудит
// ─────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  businessId: string;
  actorId: string | null;
  actorName: string;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

// ─────────────────────────────────────────────────────────────
// Онлайн-запись и депозиты
// ─────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled';

export interface Booking {
  id: string;
  businessId: string;
  customerId: string;
  service: string;
  at: string;
  kind?: 'booking' | 'lead';
  note?: string;
  status: BookingStatus;
}

/**
 * Депозит/абонемент. В MVP реальные деньги НЕ хранятся —
 * это демонстрация модели, помечается в интерфейсе как демо.
 */
export interface Deposit {
  id: string;
  businessId: string;
  customerId: string;
  balance: number;
  kind: 'deposit' | 'subscription' | 'certificate';
  title?: string;
  initialBalance?: number;
  issuedAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Статистика платформы (админка — требование положения)
// ─────────────────────────────────────────────────────────────

export interface PlatformStats {
  activeBusinesses: number;
  totalCustomers: number;
  totalTransactions: number;
  popularTools: { toolId: string; title: string; activations: number }[];
  businessesByType: { typeCode: BusinessTypeCode; count: number }[];
}

// ─────────────────────────────────────────────────────────────
// Константы движка
// ─────────────────────────────────────────────────────────────

export const QR_ROTATION_SECONDS = 45;

/**
 * Пороги активности как множители личной медианы интервалов.
 * Проверка на примере из спеки: медиана 7 дней →
 *   10 дней  (7×1.3 = 9.1  < 10 ≤ 7×2 = 14)     → declining
 *   14 дней  (14 ≤ 14, но > 9.1)                → declining, на границе с at_risk
 *   25 дней  (> 7×3.5 = 24.5)                   → lapsed
 */
export const ACTIVITY_THRESHOLDS: ActivityThresholds = {
  declining: 1.3,
  atRisk: 2.0,
  lapsed: 3.5,
} as const;

/** Порог, выше которого списание бонусов требует подтверждения клиентом. */
export const REDEEM_CONFIRM_THRESHOLD = 1000;

/** Антиспам: максимум рассылок на одного клиента за 30 дней. */
export const MAX_CAMPAIGNS_PER_MONTH = 4;

/** Человеческие названия ролей. В интерфейсе не показываем коды вроде `marketer`. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  marketer: 'Маркетолог',
  manager: 'Управляющий',
  cashier: 'Кассир',
  platform_admin: 'Админ Localy',
};
