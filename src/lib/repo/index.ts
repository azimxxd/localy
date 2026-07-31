/**
 * Localy — контракт доступа к данным.
 *
 * ВАЖНО: сигнатуры меняются ТОЛЬКО совместно, коммитом `contract:`.
 *
 * Зачем слой: B пишет экраны на мок-реализации, не дожидаясь Supabase.
 * Когда A подключит Supabase — переключается одна строка в getRepo(),
 * экраны не меняются.
 */

import type {
  ActivityLogEntry,
  Booking,
  Branch,
  Business,
  BusinessStats,
  BusinessQrStats,
  BusinessTool,
  BusinessType,
  Campaign,
  Customer,
  CustomerProfile,
  Deposit,
  GrowthPlan,
  LoyaltyConfig,
  Membership,
  NotificationChannel,
  PlatformStats,
  Plan,
  Promo,
  PromoEvent,
  PromoFunnel,
  PromoStage,
  RecommendationRuleSetting,
  Segment,
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
// Параметры запросов
// ─────────────────────────────────────────────────────────────

export interface ToolFilter {
  categories?: ToolCategory[];
  businessType?: string;
  favoritesOnly?: boolean;
  activatedOnly?: boolean;
  search?: string;
}

export interface CustomerFilter {
  segment?: SegmentCode;
  search?: string;
  limit?: number;
  offset?: number;
  activity?: CustomerProfile['activity'];
  level?: CustomerProfile['level'];
  minPoints?: number;
  minDaysSince?: number;
  consent?: 'yes' | 'no';
  sort?: 'last_seen' | 'points' | 'spent' | 'visits';
}

export interface DateRange {
  from: string;
  to: string;
}

/** Что кассир вводит на /pos. */
export interface PosPurchaseInput {
  businessId: string;
  branchId: string | null;
  staffId: string;
  /** Токен из отсканированного QR клиента. Ротируется, проверяется на срок. */
  qrToken: string;
  customerId?: string;
  amount: number;
  items: string[];
  /** Сколько бонусов списать. 0 = только начисление. */
  redeemPoints: number;
  promoId?: string | null;
  claimReward?: boolean;
}

export interface PosPurchaseResult {
  transaction: Transaction;
  membership: Membership;
  /** Списание больше REDEEM_CONFIRM_THRESHOLD — ждём подтверждения клиента. */
  requiresConfirmation: boolean;
  /** Достигнут порог награды — кассир должен её выдать. */
  rewardUnlocked: boolean;
}

export interface CreatePromoInput {
  businessId: string;
  kind: Promo['kind'];
  title: string;
  value: number;
  segment: SegmentCode;
  goal?: Promo['goal'];
  branchId?: string | null;
  channel?: Promo['channel'];
  placements?: Promo['placements'];
  body?: string;
  startsAt: string;
  endsAt: string;
}

export interface CreateCampaignInput {
  businessId: string;
  promoId: string | null;
  channel: NotificationChannel;
  audienceSegment: SegmentCode;
  body: string;
}

// ─────────────────────────────────────────────────────────────
// Контракт
// ─────────────────────────────────────────────────────────────

export interface Repo {
  // ── Пользователи и демонстрационный вход ──
  listUsers(): Promise<User[]>;
  createUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByLogin(login: string): Promise<User | null>;
  updateUser(
    id: string,
    patch: Partial<Pick<User, 'name' | 'active' | 'role' | 'businessId' | 'staffId'>>,
  ): Promise<User>;
  resetDemoData(): Promise<void>;

  // ── Справочники платформы ──
  listBusinessTypes(): Promise<BusinessType[]>;
  updateBusinessType(id: string, patch: Partial<Pick<BusinessType, 'title' | 'icon' | 'defaultRepeatVisitDays' | 'activityThresholds'>>): Promise<BusinessType>;
  listTools(filter?: ToolFilter): Promise<Tool[]>;
  getTool(id: string): Promise<Tool | null>;
  listTemplates(businessType?: string): Promise<Template[]>;

  // ── Админка платформы (требование положения) ──
  createTool(tool: Omit<Tool, 'id'>): Promise<Tool>;
  updateTool(id: string, patch: Partial<Tool>): Promise<Tool>;
  deleteTool(id: string): Promise<void>;
  createTemplate(t: Omit<Template, 'id'>): Promise<Template>;
  updateTemplate(id: string, patch: Partial<Template>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;
  getPlatformStats(): Promise<PlatformStats>;
  listRecommendationSettings(): Promise<RecommendationRuleSetting[]>;
  updateRecommendationSetting(id: string, patch: Partial<Omit<RecommendationRuleSetting, 'id'>>): Promise<RecommendationRuleSetting>;
  listPlans(): Promise<Plan[]>;
  updatePlan(tier: Plan['tier'], patch: Partial<Omit<Plan, 'tier'>>): Promise<Plan>;

  // ── Бизнес ──
  listBusinesses(): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | null>;
  getBusinessBySlug(slug: string): Promise<Business | null>;
  createBusiness(input: Omit<Business, 'id' | 'createdAt'>): Promise<Business>;
  updateBusiness(id: string, patch: Partial<Business>): Promise<Business>;
  getSubscription(businessId: string): Promise<Subscription>;
  listSubscriptionPayments(businessId: string): Promise<SubscriptionPayment[]>;
  changeSubscription(businessId: string, plan: Plan['tier']): Promise<Subscription>;

  listBranches(businessId: string): Promise<Branch[]>;
  createBranch(input: Omit<Branch, 'id'>): Promise<Branch>;
  updateBranch(id: string, patch: Partial<Omit<Branch, 'id' | 'businessId'>>): Promise<Branch>;
  getBusinessQrStats(businessId: string): Promise<BusinessQrStats>;
  incrementBusinessQrStat(businessId: string, kind: 'scan' | 'registration'): Promise<BusinessQrStats>;
  getLoyaltyConfig(businessId: string): Promise<LoyaltyConfig>;
  updateLoyaltyConfig(businessId: string, patch: Partial<LoyaltyConfig>): Promise<LoyaltyConfig>;

  getSiteConfig(businessId: string): Promise<SiteConfig | null>;
  updateSiteConfig(businessId: string, patch: Partial<SiteConfig>): Promise<SiteConfig>;

  // ── Каталог инструментов бизнеса ──
  listBusinessTools(businessId: string): Promise<BusinessTool[]>;
  activateTool(businessId: string, toolId: string): Promise<BusinessTool>;
  deactivateTool(businessId: string, toolId: string): Promise<void>;
  toggleFavorite(businessId: string, toolId: string): Promise<BusinessTool>;

  // ── Онбординг ──
  getGrowthPlan(businessId: string): Promise<GrowthPlan>;

  // ── Сотрудники ──
  listStaff(businessId: string): Promise<Staff[]>;
  createStaff(input: Omit<Staff, 'id'>): Promise<Staff>;
  updateStaff(id: string, patch: Partial<Staff>): Promise<Staff>;
  deleteStaff(id: string): Promise<void>;

  // ── Клиенты ──
  /** Клиент по id — экран /me показывает своё имя, QR и заведения. */
  getCustomer(id: string): Promise<Customer | null>;
  /** Глобальный поиск клиента по телефону — регистрация в новом заведении. */
  findCustomerByPhone(phone: string): Promise<Customer | null>;
  /** Разрешение QR-токена в клиента. Отклоняет протухший токен. */
  resolveQrToken(qrToken: string): Promise<Customer | null>;
  createCustomer(input: Pick<Customer, 'phone' | 'name' | 'birthday'>): Promise<Customer>;
  updateCustomer(id: string, patch: Partial<Pick<Customer, 'name' | 'phone' | 'birthday'>>): Promise<Customer>;
  /** Ротация динамического QR — раз в QR_ROTATION_SECONDS. */
  rotateQrToken(customerId: string): Promise<Customer>;

  /** Все заведения клиента с балансами — экран /me. */
  listMembershipsForCustomer(
    customerId: string,
  ): Promise<{ business: Business; membership: Membership }[]>;
  getMembership(businessId: string, customerId: string): Promise<Membership | null>;
  joinBusiness(businessId: string, customerId: string): Promise<Membership>;
  updateConsent(
    businessId: string,
    customerId: string,
    channels: NotificationChannel[],
  ): Promise<Membership>;
  updateMembership(
    businessId: string,
    customerId: string,
    patch: Partial<Pick<Membership, 'notes' | 'source'>>,
  ): Promise<Membership>;
  /** Удаляет связь с бизнесом, но не глобальный аккаунт Localy. */
  removeCustomerFromBusiness(businessId: string, customerId: string, actorId: string): Promise<void>;
  adjustPoints(
    businessId: string,
    customerId: string,
    staffId: string | null,
    delta: number,
    note: string,
  ): Promise<Transaction>;

  /** Карточка CRM: membership + вычисленные уровень, активность, прогноз. */
  getCustomerProfile(businessId: string, customerId: string): Promise<CustomerProfile | null>;
  listCustomerProfiles(businessId: string, filter?: CustomerFilter): Promise<CustomerProfile[]>;

  // ── Транзакции ──
  listTransactions(businessId: string, range?: DateRange): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | null>;
  listTransactionsForCustomer(businessId: string, customerId: string): Promise<Transaction[]>;
  /** Основная операция кассира. Атомарно: транзакция + баланс + аудит. */
  recordPurchase(input: PosPurchaseInput): Promise<PosPurchaseResult>;
  confirmRedeem(transactionId: string): Promise<Transaction>;

  // ── Сегменты ──
  listSegments(businessId: string): Promise<Segment[]>;
  getSegment(businessId: string, code: SegmentCode): Promise<Segment>;

  // ── Акции ──
  listPromos(businessId: string): Promise<Promo[]>;
  getPromo(id: string): Promise<Promo | null>;
  /** Прогноз ДО сохранения — форма конструктора вызывает на каждое изменение. */
  forecastPromo(input: CreatePromoInput): Promise<Promo['forecast']>;
  createPromo(input: CreatePromoInput): Promise<Promo>;
  updatePromo(id: string, patch: Partial<Promo>): Promise<Promo>;
  launchPromo(id: string): Promise<Promo>;
  getPromoFunnel(promoId: string): Promise<PromoFunnel>;
  listPromoEvents(promoId: string, stage?: PromoStage): Promise<PromoEvent[]>;

  // ── Рассылки ──
  listCampaigns(businessId: string): Promise<Campaign[]>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  /** В MVP реальной отправки нет — помечает simulated и заполняет воронку. */
  simulateSend(campaignId: string): Promise<Campaign>;
  /** Антиспам: сколько рассылок клиент уже получил за 30 дней. */
  countRecentCampaigns(businessId: string, customerId: string): Promise<number>;

  // ── Аналитика ──
  getBusinessStats(businessId: string, range?: DateRange): Promise<BusinessStats>;
  listActivityLog(businessId: string, limit?: number): Promise<ActivityLogEntry[]>;

  // ── Онлайн-запись и депозиты ──
  listBookings(businessId: string): Promise<Booking[]>;
  createBooking(input: Omit<Booking, 'id' | 'status'>): Promise<Booking>;
  updateBooking(id: string, patch: Partial<Booking>): Promise<Booking>;
  listDeposits(businessId: string, customerId?: string): Promise<Deposit[]>;

  // ── Realtime ──
  /**
   * Подписка на новые транзакции бизнеса.
   * Экран владельца обновляется сам, когда кассир пробил покупку.
   * Это главный кадр демо-видео.
   * @returns функция отписки
   */
  subscribeTransactions(businessId: string, onInsert: (t: Transaction) => void): () => void;
}

// ─────────────────────────────────────────────────────────────
// Выбор реализации
// ─────────────────────────────────────────────────────────────

let cached: Repo | null = null;

/**
 * Единственная точка переключения источника данных.
 * Локальное JSON-хранилище — безопасный режим по умолчанию. На неполный Supabase-адаптер
 * переключаемся только явно: LOCALY_REPO=supabase.
 */
export async function getRepo(): Promise<Repo> {
  if (cached) return cached;

  const useSupabase = process.env.LOCALY_REPO === 'supabase';
  if (useSupabase && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    throw new Error('Для LOCALY_REPO=supabase нужны NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const repo = useSupabase
    ? (await import('./supabase')).createSupabaseRepo()
    : (await import('./mock')).createMockRepo();

  cached = repo;
  return repo;
}
