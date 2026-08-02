/**
 * Localy — локальная реализация Repo поверх сгенерированных демо-данных.
 *
 * Вызывающие: getRepo() из src/lib/repo/index.ts. Напрямую не импортировать.
 *
 * Состояние хранится в data/localy.json и переживает перезапуск сервера.
 * Файл создаётся из детерминированного seed при первом запуске. Для сброса
 * есть resetDemoData(), доступный только администратору платформы.
 *
 * Схемы данных — только из src/lib/types.ts, своих не заводит.
 */

import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildCustomerProfile,
  buildGrowthPlan,
  computeSegments,
  forecastPromo,
  SEGMENT_META,
  type SegmentContext,
} from '@/lib/engine';
import { generateSeed, type SeedData } from '@/lib/mock/seed';
import type {
  CreateCampaignInput,
  CreatePromoInput,
  CustomerFilter,
  DateRange,
  PosPurchaseInput,
  PosPurchaseResult,
  Repo,
  ToolFilter,
} from '@/lib/repo';
import {
  QR_ROTATION_SECONDS,
  REDEEM_CONFIRM_THRESHOLD,
  MAX_CAMPAIGNS_PER_MONTH,
  type ActivityLogEntry,
  type Booking,
  type Branch,
  type Business,
  type BusinessStats,
  type BusinessQrStats,
  type Campaign,
  type Customer,
  type CustomerProfile,
  type Deposit,
  type LoyaltyConfig,
  type Membership,
  type NotificationChannel,
  type PlatformStats,
  type Plan,
  type Promo,
  type PromoEvent,
  type PromoFunnel,
  type PromoStage,
  type Segment,
  type SegmentCode,
  type Staff,
  type Template,
  type Tool,
  type Transaction,
  type User,
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Состояние
// ─────────────────────────────────────────────────────────────

let db: SeedData | null = null;
let persistLocal = true;
let persistHook: ((data: SeedData) => Promise<void> | void) | null = null;

const DATA_FILE = process.env.LOCALY_DATA_FILE
  ? path.resolve(process.env.LOCALY_DATA_FILE)
  : path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'localy.json');
const DATA_TMP_FILE = `${DATA_FILE}.tmp`;

function persist() {
  if (!db) return;
  if (!persistLocal) return;
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_TMP_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  renameSync(DATA_TMP_FILE, DATA_FILE);
}

function state(): SeedData {
  if (!db) {
    if (existsSync(DATA_FILE)) {
      const loaded = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as SeedData;
      const seed = generateSeed();
      const mergeMissingById = <T extends { id: string }>(current: T[] | undefined, defaults: T[]) => {
        const result = current ?? [];
        const ids = new Set(result.map((item) => item.id));
        return [...result, ...defaults.filter((item) => !ids.has(item.id))];
      };
      const mergeFieldsById = <T extends { id: string }>(current: T[] | undefined, defaults: T[]) => {
        const byId = new Map(defaults.map((item) => [item.id, item]));
        return (current ?? defaults).map((item) => ({ ...(byId.get(item.id) ?? {}), ...item } as T));
      };
      const siteConfigs = (loaded.siteConfigs ?? seed.siteConfigs).map((item) => {
        const fallback = seed.siteConfigs.find((candidate) => candidate.businessId === item.businessId);
        const sections = [...item.sections, ...(fallback?.sections ?? []).filter((section) => !item.sections.some((current) => current.kind === section.kind))];
        return { ...(fallback ?? {}), ...item, sections };
      });
      const promoEvents = [...(loaded.promoEvents ?? seed.promoEvents)];
      const plans = (loaded.plans ?? seed.plans).map((item) => ({
        ...(seed.plans.find((candidate) => candidate.tier === item.tier) ?? {}),
        ...item,
        features: seed.plans.find((candidate) => candidate.tier === item.tier)?.features ?? item.features,
      }));
      const promoIds = new Set(promoEvents.map((event) => event.promoId));
      promoIds.forEach((promoId) => {
        if (promoEvents.some((event) => event.promoId === promoId && event.stage === 'clicked')) return;
        promoEvents.filter((event) => event.promoId === promoId && event.stage === 'opened').filter((_, index) => index % 3 !== 2).forEach((event) => promoEvents.push({ ...event, stage: 'clicked' }));
      });
      db = {
        ...seed,
        ...loaded,
        users: mergeMissingById(loaded.users, seed.users),
        businessTypes: mergeFieldsById(loaded.businessTypes, seed.businessTypes),
        tools: mergeMissingById(loaded.tools, seed.tools),
        templates: mergeMissingById(loaded.templates, seed.templates),
        businesses: mergeFieldsById(loaded.businesses, seed.businesses),
        plans,
        siteConfigs,
        campaigns: mergeFieldsById(loaded.campaigns, seed.campaigns),
        recommendationSettings: mergeMissingById(loaded.recommendationSettings, seed.recommendationSettings),
        promoEvents,
      };
    } else {
      db = generateSeed();
      persist();
    }
  }
  return db;
}

/** Подписчики на новые транзакции: businessId → набор колбэков. */
const listeners = new Map<string, Set<(t: Transaction) => void>>();

function emitTransaction(t: Transaction) {
  listeners.get(t.businessId)?.forEach((fn) => fn(t));
}

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function promoAudienceSize(input: CreatePromoInput): number {
  const segment = segmentsOf(input.businessId).find((item) => item.code === input.segment);
  if (input.goal !== 'new_customers') return segment?.count ?? 0;
  const durationDays = Math.max(1, Math.min(60, Math.ceil((new Date(input.endsAt).getTime() - new Date(input.startsAt).getTime()) / 86_400_000)));
  const qrScans = state().businessQrStats.find((item) => item.businessId === input.businessId)?.scans ?? 0;
  const placementFactor = (input.placements ?? []).reduce((sum, placement) => sum + ({ site: 0.8, qr_landing: 0.7, cashier: 0.15, client_app: 0 }[placement] ?? 0), 0);
  const dailyReach = Math.max(6, profilesOf(input.businessId).length * 0.12, qrScans / 30);
  return Math.max(1, Math.round(dailyReach * durationDays * Math.max(0.25, placementFactor)));
}

function inRange(iso: string, range?: DateRange): boolean {
  if (!range) return true;
  return iso >= range.from && iso <= range.to;
}

function defaultRange(days = 30): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─────────────────────────────────────────────────────────────
// Вычисляемые представления
// ─────────────────────────────────────────────────────────────

function loyaltyOf(businessId: string): LoyaltyConfig {
  const found = state().loyaltyConfigs.find((l) => l.businessId === businessId);
  if (found) return found;
  return {
    businessId,
    pointsPerCurrency: 0.05,
    rewardThreshold: 1000,
    rewardTitle: 'Награда',
    expiryDays: 90,
  };
}

function planOf(businessId: string): Plan {
  const business = state().businesses.find((item) => item.id === businessId);
  const plan = state().plans.find((item) => item.tier === (business?.plan ?? 'free'));
  if (!plan) throw new Error('Тариф бизнеса не настроен');
  return plan;
}

function assertPlanLimit(businessId: string, key: keyof Plan['limits'], current: number, noun: string) {
  const plan = planOf(businessId);
  if (current >= plan.limits[key]) throw new Error(`Лимит тарифа «${plan.title}»: ${plan.limits[key]} ${noun}. Выберите другой тариф.`);
}

function transactionsOf(businessId: string, customerId: string): Transaction[] {
  return state().transactions.filter(
    (t) => t.businessId === businessId && t.customerId === customerId,
  );
}

function profileOf(businessId: string, customerId: string): CustomerProfile | null {
  const s = state();
  const membership = s.memberships.find(
    (m) => m.businessId === businessId && m.customerId === customerId,
  );
  const customer = s.customers.find((c) => c.id === customerId);
  const business = s.businesses.find((item) => item.id === businessId);
  const businessType = s.businessTypes.find((item) => item.code === business?.typeCode);
  if (!membership || !customer) return null;

  return buildCustomerProfile({
    customer,
    membership,
    transactions: transactionsOf(businessId, customerId),
    loyalty: loyaltyOf(businessId),
    fallbackIntervalDays: business?.repeatVisitDays ?? businessType?.defaultRepeatVisitDays ?? 30,
    activityThresholds: businessType?.activityThresholds,
  });
}

function profilesOf(businessId: string): CustomerProfile[] {
  return state()
    .memberships.filter((m) => m.businessId === businessId)
    .map((m) => profileOf(businessId, m.customerId))
    .filter((p): p is CustomerProfile => p !== null);
}

/** Контекст для предикатов сегментов: акции, записи, средний чек заведения. */
function segmentContext(businessId: string): SegmentContext {
  const s = state();
  const promoIds = new Set(s.promos.filter((p) => p.businessId === businessId).map((p) => p.id));

  const redeemedPromosByCustomer: Record<string, number> = {};
  s.promoEvents
    .filter((e) => e.stage === 'redeemed' && promoIds.has(e.promoId))
    .forEach((e) => {
      redeemedPromosByCustomer[e.customerId] = (redeemedPromosByCustomer[e.customerId] ?? 0) + 1;
    });

  const lastBookingByCustomer: Record<string, string> = {};
  s.bookings
    .filter((b) => b.businessId === businessId)
    .forEach((b) => {
      const prev = lastBookingByCustomer[b.customerId];
      if (!prev || b.at > prev) lastBookingByCustomer[b.customerId] = b.at;
    });

  const business = s.businesses.find((b) => b.id === businessId);
  const campaignCustomers = [...new Set(
    s.promoEvents
      .filter((event) => promoIds.has(event.promoId) && (event.stage === 'visited' || event.stage === 'redeemed'))
      .map((event) => event.customerId),
  )];

  return {
    loyalty: loyaltyOf(businessId),
    redeemedPromosByCustomer,
    lastBookingByCustomer,
    campaignCustomers,
    businessAvgCheck: business?.avgCheck ?? 3000,
  };
}

function segmentsOf(businessId: string): Segment[] {
  return computeSegments(profilesOf(businessId), segmentContext(businessId));
}

function logAction(
  businessId: string,
  type: string,
  label: string,
  payload: Record<string, unknown> = {},
) {
  const owner = state().staff.find((s) => s.businessId === businessId && s.role === 'owner');
  const entry: ActivityLogEntry = {
    id: uid('log'),
    businessId,
    actorId: owner?.id ?? null,
    actorName: owner?.name ?? 'Владелец',
    type,
    payload: { ...payload, label },
    at: nowIso(),
  };
  state().activityLog.unshift(entry);
}

// ─────────────────────────────────────────────────────────────
// Реализация
// ─────────────────────────────────────────────────────────────

export interface StateRepoOptions {
  initialState?: SeedData;
  persistLocal?: boolean;
  onPersist?: (data: SeedData) => Promise<void> | void;
}

export function createMockRepo(options: StateRepoOptions = {}): Repo {
  persistLocal = options.persistLocal ?? true;
  persistHook = options.onPersist ?? null;
  if (options.initialState) db = clone(options.initialState);
  const repo: Repo = {
    // ── Пользователи и demo-auth ──
    async listUsers() {
      return clone(state().users);
    },

    async getUser(id) {
      return clone(state().users.find((user) => user.id === id) ?? null);
    },

    async getUserByLogin(login) {
      const normalized = login.trim().toLowerCase();
      return clone(state().users.find((user) => user.login.toLowerCase() === normalized) ?? null);
    },

    async createUser(input) {
      if (state().users.some((user) => user.login.toLowerCase() === input.login.toLowerCase())) {
        throw new Error('Пользователь с этим логином уже есть');
      }
      const user: User = { ...input, id: uid('usr'), createdAt: nowIso() };
      state().users.push(user);
      return clone(user);
    },

    async updateUser(id, patch) {
      const user = state().users.find((item) => item.id === id);
      if (!user) throw new Error(`Пользователь ${id} не найден`);
      Object.assign(user, patch, { id });
      return clone(user);
    },

    async resetDemoData() {
      db = generateSeed();
    },

    // ── Справочники платформы ──
    async listBusinessTypes() {
      return clone(state().businessTypes);
    },

    async updateBusinessType(id, patch) {
      const type = state().businessTypes.find((item) => item.id === id);
      if (!type) throw new Error('Категория бизнеса не найдена');
      Object.assign(type, patch, { id });
      return clone(type);
    },

    async listTools(filter?: ToolFilter) {
      const s = state();
      let out = s.tools;

      if (filter?.categories?.length) {
        const set = new Set(filter.categories);
        out = out.filter((t) => set.has(t.category));
      }
      if (filter?.businessType) {
        out = out.filter(
          (t) => t.forTypes.length === 0 || t.forTypes.includes(filter.businessType as never),
        );
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        out = out.filter(
          (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
        );
      }
      return clone(out);
    },

    async getTool(id) {
      return clone(state().tools.find((t) => t.id === id) ?? null);
    },

    async listTemplates(businessType?: string) {
      const out = businessType
        ? state().templates.filter(
            (t) => t.businessTypes.length === 0 || t.businessTypes.includes(businessType as never),
          )
        : state().templates;
      return clone(out);
    },

    // ── Админка платформы ──
    async createTool(input) {
      const tool: Tool = { ...input, id: uid('tool') };
      state().tools.push(tool);
      return clone(tool);
    },

    async updateTool(id, patch) {
      const tool = state().tools.find((t) => t.id === id);
      if (!tool) throw new Error(`Инструмент ${id} не найден`);
      Object.assign(tool, patch, { id });
      return clone(tool);
    },

    async deleteTool(id) {
      const s = state();
      s.tools = s.tools.filter((t) => t.id !== id);
      s.businessTools = s.businessTools.filter((bt) => bt.toolId !== id);
    },

    async createTemplate(input) {
      const tpl: Template = { ...input, id: uid('tpl') };
      state().templates.push(tpl);
      return clone(tpl);
    },

    async updateTemplate(id, patch) {
      const tpl = state().templates.find((t) => t.id === id);
      if (!tpl) throw new Error(`Шаблон ${id} не найден`);
      Object.assign(tpl, patch, { id });
      return clone(tpl);
    },

    async deleteTemplate(id) {
      const s = state();
      s.templates = s.templates.filter((t) => t.id !== id);
    },

    async getPlatformStats(): Promise<PlatformStats> {
      const s = state();
      const activations = new Map<string, number>();
      s.businessTools
        .filter((bt) => bt.activatedAt !== null)
        .forEach((bt) => activations.set(bt.toolId, (activations.get(bt.toolId) ?? 0) + 1));

      const popularTools = [...activations.entries()]
        .map(([toolId, count]) => ({
          toolId,
          title: s.tools.find((t) => t.id === toolId)?.title ?? toolId,
          activations: count,
        }))
        .sort((a, b) => b.activations - a.activations)
        .slice(0, 8);

      const byType = new Map<Business['typeCode'], number>();
      s.businesses.forEach((b) => byType.set(b.typeCode, (byType.get(b.typeCode) ?? 0) + 1));

      return {
        activeBusinesses: s.businesses.filter((business) => business.active !== false).length,
        totalCustomers: s.customers.length,
        totalTransactions: s.transactions.length,
        popularTools,
        businessesByType: [...byType.entries()].map(([typeCode, count]) => ({ typeCode, count })),
      };
    },

    async listRecommendationSettings() {
      return clone(state().recommendationSettings);
    },

    async updateRecommendationSetting(id, patch) {
      const setting = state().recommendationSettings.find((item) => item.id === id);
      if (!setting) throw new Error('Правило рекомендации не найдено');
      Object.assign(setting, patch, { id });
      return clone(setting);
    },

    async listPlans() {
      return clone(state().plans);
    },

    async updatePlan(tier, patch) {
      const plan = state().plans.find((item) => item.tier === tier);
      if (!plan) throw new Error(`Тариф ${tier} не найден`);
      Object.assign(plan, patch, { tier });
      return clone(plan);
    },

    // ── Бизнес ──
    async listBusinesses() {
      return clone(state().businesses);
    },

    async getBusiness(id) {
      return clone(state().businesses.find((b) => b.id === id) ?? null);
    },

    async getBusinessBySlug(slug) {
      return clone(state().businesses.find((b) => b.slug === slug) ?? null);
    },

    async createBusiness(input) {
      const business: Business = { ...input, id: uid('biz'), createdAt: nowIso() };
      const s = state();
      s.businesses.push(business);
      s.subscriptions.push({
        businessId: business.id,
        plan: business.plan,
        status: 'active',
        startedAt: nowIso(),
        nextBillingAt: business.plan === 'free' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
      s.loyaltyConfigs.push({
        businessId: business.id,
        pointsPerCurrency: 0.05,
        rewardThreshold: 1000,
        rewardTitle: 'Награда постоянному клиенту',
        expiryDays: 90,
        maxRedemptionPercent: 20,
        startBonus: 100,
        minPurchaseAmount: 500,
        excludedItems: [],
        rewardEveryVisits: 6,
      });
      s.branches.push({
        id: uid('brn'),
        businessId: business.id,
        title: 'Основная точка',
        address: business.address || business.city,
        phone: '',
      });
      s.staff.push({
        id: uid('stf'),
        businessId: business.id,
        branchId: null,
        name: 'Владелец',
        role: 'owner',
        pin: '1111',
      });
      logAction(business.id, 'business_created', `Создан бизнес «${business.name}»`);
      return clone(business);
    },

    async updateBusiness(id, patch) {
      const b = state().businesses.find((x) => x.id === id);
      if (!b) throw new Error(`Бизнес ${id} не найден`);
      Object.assign(b, patch, { id });
      return clone(b);
    },

    async getSubscription(businessId) {
      const business = state().businesses.find((item) => item.id === businessId);
      if (!business) throw new Error('Бизнес не найден');
      const subscription = state().subscriptions.find((item) => item.businessId === businessId);
      return clone(subscription ?? { businessId, plan: business.plan, status: 'active', startedAt: business.createdAt, nextBillingAt: business.plan === 'free' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString() });
    },

    async listSubscriptionPayments(businessId) {
      return clone(state().subscriptionPayments.filter((item) => item.businessId === businessId).sort((a, b) => b.at.localeCompare(a.at)));
    },

    async changeSubscription(businessId, tier) {
      const s = state();
      const business = s.businesses.find((item) => item.id === businessId);
      const plan = s.plans.find((item) => item.tier === tier);
      if (!business || !plan) throw new Error('Бизнес или тариф не найден');
      business.plan = tier;
      let subscription = s.subscriptions.find((item) => item.businessId === businessId);
      if (!subscription) {
        subscription = { businessId, plan: tier, status: 'active', startedAt: nowIso(), nextBillingAt: null };
        s.subscriptions.push(subscription);
      }
      subscription.plan = tier;
      subscription.status = 'active';
      subscription.nextBillingAt = tier === 'free' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();
      s.subscriptionPayments.push({ id: uid('pay'), businessId, plan: tier, amountKzt: plan.priceKzt, status: 'demo', at: nowIso() });
      logAction(businessId, 'subscription_changed', `Тариф изменён на «${plan.title}»`, { tier, amountKzt: plan.priceKzt });
      return clone(subscription);
    },

    async listBranches(businessId) {
      return clone(state().branches.filter((b) => b.businessId === businessId));
    },

    async createBranch(input) {
      assertPlanLimit(input.businessId, 'branches', state().branches.filter((item) => item.businessId === input.businessId).length, 'филиалов');
      const branch: Branch = { ...input, id: uid('brn') };
      state().branches.push(branch);
      logAction(input.businessId, 'branch_created', `Добавлен филиал «${branch.title}»`);
      return clone(branch);
    },

    async updateBranch(id, patch) {
      const branch = state().branches.find((item) => item.id === id);
      if (!branch) throw new Error(`Филиал ${id} не найден`);
      Object.assign(branch, patch, { id });
      logAction(branch.businessId, 'branch_updated', `Обновлён филиал «${branch.title}»`, { branchId: id });
      return clone(branch);
    },

    async getBusinessQrStats(businessId) {
      const stats = state().businessQrStats.find((item) => item.businessId === businessId);
      return clone(stats ?? { businessId, scans: 0, registrations: 0 });
    },

    async incrementBusinessQrStat(businessId, kind) {
      let stats = state().businessQrStats.find((item) => item.businessId === businessId);
      if (!stats) {
        stats = { businessId, scans: 0, registrations: 0 } satisfies BusinessQrStats;
        state().businessQrStats.push(stats);
      }
      if (kind === 'scan') stats.scans += 1;
      else stats.registrations += 1;
      return clone(stats);
    },

    async getLoyaltyConfig(businessId) {
      return clone(loyaltyOf(businessId));
    },

    async updateLoyaltyConfig(businessId, patch) {
      const s = state();
      let cfg = s.loyaltyConfigs.find((l) => l.businessId === businessId);
      if (!cfg) {
        cfg = loyaltyOf(businessId);
        s.loyaltyConfigs.push(cfg);
      }
      Object.assign(cfg, patch, { businessId });
      logAction(businessId, 'loyalty_updated', 'Изменены настройки бонусной программы', { patch });
      return clone(cfg);
    },

    async getSiteConfig(businessId) {
      return clone(state().siteConfigs.find((s) => s.businessId === businessId) ?? null);
    },

    async updateSiteConfig(businessId, patch) {
      const s = state();
      let cfg = s.siteConfigs.find((x) => x.businessId === businessId);
      if (!cfg) {
        cfg = { businessId, templateId: 'tpl_site_coffee', sections: [], published: false };
        s.siteConfigs.push(cfg);
      }
      Object.assign(cfg, patch, { businessId });
      logAction(businessId, 'site_updated', 'Обновлён мини-сайт заведения');
      return clone(cfg);
    },

    // ── Каталог инструментов бизнеса ──
    async listBusinessTools(businessId) {
      return clone(state().businessTools.filter((bt) => bt.businessId === businessId));
    },

    async activateTool(businessId, toolId) {
      const s = state();
      let bt = s.businessTools.find((x) => x.businessId === businessId && x.toolId === toolId);
      if (!bt) {
        bt = { businessId, toolId, activatedAt: null, isFavorite: false };
        s.businessTools.push(bt);
      }
      bt.activatedAt = nowIso();
      const title = s.tools.find((t) => t.id === toolId)?.title ?? toolId;
      logAction(businessId, 'tool_activated', `Активирован инструмент «${title}»`, { toolId });
      return clone(bt);
    },

    async deactivateTool(businessId, toolId) {
      const bt = state().businessTools.find(
        (x) => x.businessId === businessId && x.toolId === toolId,
      );
      if (bt) bt.activatedAt = null;
    },

    async toggleFavorite(businessId, toolId) {
      const s = state();
      let bt = s.businessTools.find((x) => x.businessId === businessId && x.toolId === toolId);
      if (!bt) {
        bt = { businessId, toolId, activatedAt: null, isFavorite: false };
        s.businessTools.push(bt);
      }
      bt.isFavorite = !bt.isFavorite;
      return clone(bt);
    },

    // ── Онбординг ──
    async getGrowthPlan(businessId) {
      const s = state();
      const business = s.businesses.find((b) => b.id === businessId);
      if (!business) throw new Error(`Бизнес ${businessId} не найден`);
      return buildGrowthPlan(business, s.tools);
    },

    // ── Сотрудники ──
    async listStaff(businessId) {
      return clone(state().staff.filter((s) => s.businessId === businessId));
    },

    async createStaff(input) {
      assertPlanLimit(input.businessId, 'staff', state().staff.filter((item) => item.businessId === input.businessId && item.active !== false).length, 'сотрудников');
      const staff: Staff = { ...input, id: uid('stf') };
      state().staff.push(staff);
      logAction(input.businessId, 'staff_added', `Добавлен сотрудник ${staff.name}`, {
        role: staff.role,
      });
      return clone(staff);
    },

    async updateStaff(id, patch) {
      const st = state().staff.find((s) => s.id === id);
      if (!st) throw new Error(`Сотрудник ${id} не найден`);
      Object.assign(st, patch, { id });
      logAction(st.businessId, 'staff_updated', `Изменён доступ сотрудника ${st.name}`, { staffId: id, patch });
      return clone(st);
    },

    async deleteStaff(id) {
      const s = state();
      s.staff = s.staff.filter((x) => x.id !== id);
    },

    // ── Клиенты ──
    async getCustomer(id) {
      return clone(state().customers.find((c) => c.id === id) ?? null);
    },

    async findCustomerByPhone(phone) {
      const digits = phone.replace(/\D/g, '');
      const found = state().customers.find((c) => c.phone.replace(/\D/g, '') === digits);
      return clone(found ?? null);
    },

    async resolveQrToken(qrToken) {
      const c = state().customers.find((x) => x.qrToken === qrToken);
      if (!c) return null;
      const ageSeconds = (Date.now() - new Date(c.qrRotatedAt).getTime()) / 1000;
      if (ageSeconds > QR_ROTATION_SECONDS + 5) return null;
      return clone(c);
    },

    async createCustomer(input) {
      const customer: Customer = {
        id: uid('cus'),
        phone: input.phone,
        name: input.name,
        birthday: input.birthday,
        qrToken: uid('qr'),
        qrRotatedAt: nowIso(),
        createdAt: nowIso(),
      };
      state().customers.push(customer);
      return clone(customer);
    },

    async updateCustomer(id, patch) {
      const customer = state().customers.find((item) => item.id === id);
      if (!customer) throw new Error(`Клиент ${id} не найден`);
      if (patch.phone) {
        const digits = patch.phone.replace(/\D/g, '');
        const duplicate = state().customers.find(
          (item) => item.id !== id && item.phone.replace(/\D/g, '') === digits,
        );
        if (duplicate) throw new Error('Клиент с этим телефоном уже есть');
      }
      Object.assign(customer, patch, { id });
      return clone(customer);
    },

    async rotateQrToken(customerId) {
      const c = state().customers.find((x) => x.id === customerId);
      if (!c) throw new Error(`Клиент ${customerId} не найден`);
      const ageSeconds = (Date.now() - new Date(c.qrRotatedAt).getTime()) / 1000;
      if (ageSeconds >= QR_ROTATION_SECONDS) {
        c.qrToken = uid('qr');
        c.qrRotatedAt = nowIso();
      }
      return clone(c);
    },

    async listMembershipsForCustomer(customerId) {
      const s = state();
      const out: { business: Business; membership: Membership }[] = [];
      s.memberships
        .filter((m) => m.customerId === customerId)
        .forEach((m) => {
          const business = s.businesses.find((b) => b.id === m.businessId);
          if (business) out.push({ business, membership: m });
        });
      return clone(out);
    },

    async getMembership(businessId, customerId) {
      const m = state().memberships.find(
        (x) => x.businessId === businessId && x.customerId === customerId,
      );
      return clone(m ?? null);
    },

    async joinBusiness(businessId, customerId) {
      const s = state();
      const existing = s.memberships.find(
        (m) => m.businessId === businessId && m.customerId === customerId,
      );
      if (existing) return clone(existing);
      assertPlanLimit(businessId, 'customers', s.memberships.filter((item) => item.businessId === businessId).length, 'клиентов');

      const membership: Membership = {
        businessId,
        customerId,
        points: loyaltyOf(businessId).startBonus ?? 0,
        visits: 0,
        firstSeen: nowIso(),
        lastSeen: nowIso(),
        totalSpent: 0,
        consentChannels: ['telegram'],
        favoriteItems: [],
      };
      s.memberships.push(membership);
      return clone(membership);
    },

    async updateConsent(businessId, customerId, channels: NotificationChannel[]) {
      const m = state().memberships.find(
        (x) => x.businessId === businessId && x.customerId === customerId,
      );
      if (!m) throw new Error('Клиент не состоит в этом заведении');
      m.consentChannels = channels;
      return clone(m);
    },

    async updateMembership(businessId, customerId, patch) {
      const membership = state().memberships.find(
        (item) => item.businessId === businessId && item.customerId === customerId,
      );
      if (!membership) throw new Error('Клиент не состоит в программе этого бизнеса');
      Object.assign(membership, patch, { businessId, customerId });
      return clone(membership);
    },

    async removeCustomerFromBusiness(businessId, customerId, actorId) {
      const s = state();
      if (!s.memberships.some((item) => item.businessId === businessId && item.customerId === customerId)) throw new Error('Клиент не состоит в этой программе');
      s.memberships = s.memberships.filter((item) => !(item.businessId === businessId && item.customerId === customerId));
      logAction(businessId, 'customer_removed', 'Клиент удалён из CRM бизнеса', { customerId, actorId });
    },

    async adjustPoints(businessId, customerId, staffId, delta, note) {
      const s = state();
      const membership = s.memberships.find(
        (item) => item.businessId === businessId && item.customerId === customerId,
      );
      if (!membership) throw new Error('Бонусный счёт не найден');
      if (!Number.isInteger(delta) || delta === 0) throw new Error('Укажите ненулевое целое число бонусов');
      if (membership.points + delta < 0) throw new Error('Нельзя списать больше текущего баланса');
      const transaction: Transaction = {
        id: uid('trx'),
        businessId,
        branchId: null,
        customerId,
        staffId,
        amount: 0,
        pointsDelta: delta,
        accruedPoints: Math.max(0, delta),
        redeemedPoints: Math.max(0, -delta),
        status: 'completed',
        kind: delta > 0 ? 'accrue' : 'redeem',
        items: note ? [note] : [],
        createdAt: nowIso(),
      };
      s.transactions.push(transaction);
      membership.points += delta;
      logAction(businessId, delta > 0 ? 'points_accrued_manual' : 'points_redeemed_manual', `${delta > 0 ? 'Начислено' : 'Списано'} ${Math.abs(delta)} бонусов вручную`, { customerId, delta, note });
      return clone(transaction);
    },

    async getCustomerProfile(businessId, customerId) {
      return clone(profileOf(businessId, customerId));
    },

    async listCustomerProfiles(businessId, filter?: CustomerFilter) {
      let out = profilesOf(businessId);

      if (filter?.segment) {
        const seg = segmentsOf(businessId).find((s) => s.code === filter.segment);
        const ids = new Set(seg?.customerIds ?? []);
        out = out.filter((p) => ids.has(p.customer.id));
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        const digits = q.replace(/\D/g, '');
        out = out.filter(
          (p) =>
            p.customer.name.toLowerCase().includes(q) ||
            (digits.length > 0 && p.customer.phone.replace(/\D/g, '').includes(digits)),
        );
      }

      if (filter?.activity) out = out.filter((profile) => profile.activity === filter.activity);
      if (filter?.level) out = out.filter((profile) => profile.level === filter.level);
      if (filter?.minPoints) out = out.filter((profile) => profile.membership.points >= filter.minPoints!);
      if (filter?.minDaysSince) out = out.filter((profile) => profile.daysSinceLastVisit >= filter.minDaysSince!);
      if (filter?.consent === 'yes') out = out.filter((profile) => profile.membership.consentChannels.length > 0);
      if (filter?.consent === 'no') out = out.filter((profile) => profile.membership.consentChannels.length === 0);

      out.sort((a, b) => {
        if (filter?.sort === 'points') return b.membership.points - a.membership.points;
        if (filter?.sort === 'spent') return b.membership.totalSpent - a.membership.totalSpent;
        if (filter?.sort === 'visits') return b.membership.visits - a.membership.visits;
        return b.membership.lastSeen.localeCompare(a.membership.lastSeen);
      });

      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? out.length;
      return clone(out.slice(offset, offset + limit));
    },

    // ── Транзакции ──
    async listTransactions(businessId, range?: DateRange) {
      return clone(
        state().transactions.filter(
          (t) => t.businessId === businessId && inRange(t.createdAt, range),
        ),
      );
    },

    async getTransaction(id) {
      return clone(state().transactions.find((transaction) => transaction.id === id) ?? null);
    },

    async listTransactionsForCustomer(businessId, customerId) {
      return clone(
        transactionsOf(businessId, customerId).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    },

    /**
     * Главная операция кассира. Одним вызовом: транзакция, баланс, аудит,
     * уведомление подписчиков. Экран владельца обновляется сам — это
     * ключевой кадр демо-видео.
     */
    async recordPurchase(input: PosPurchaseInput): Promise<PosPurchaseResult> {
      const s = state();
      const customer = input.customerId
        ? s.customers.find((item) => item.id === input.customerId)
        : s.customers.find((item) => item.qrToken === input.qrToken);
      if (!customer) throw new Error('Клиент или QR-код не распознан');
      if (!input.customerId) {
        const ageSeconds = (Date.now() - new Date(customer.qrRotatedAt).getTime()) / 1000;
        if (ageSeconds > QR_ROTATION_SECONDS + 5) throw new Error('QR-код истёк. Попросите клиента обновить его');
      }

      const loyalty = loyaltyOf(input.businessId);

      // joinBusiness сам кладёт membership в состояние — здесь берём ссылку
      // на объект в массиве, чтобы менять баланс на месте.
      if (!s.memberships.some((m) => m.businessId === input.businessId && m.customerId === customer.id)) {
        await repo.joinBusiness(input.businessId, customer.id);
      }
      const membership = s.memberships.find(
        (m) => m.businessId === input.businessId && m.customerId === customer.id,
      )!;

      const redeem = Math.min(Math.max(0, input.redeemPoints), membership.points);
      const excluded = (loyalty.excludedItems ?? []).map((item) => item.toLowerCase());
      if (redeem > 0 && input.items.some((item) => excluded.includes(item.toLowerCase()))) {
        throw new Error('На одну из выбранных позиций нельзя списывать бонусы');
      }
      const promo = input.promoId ? s.promos.find((item) => item.id === input.promoId && item.businessId === input.businessId) : null;
      if (input.promoId && (!promo || promo.status !== 'active' || promo.endsAt < nowIso())) throw new Error('Акция недоступна или завершена');
      if (promo?.placements && !promo.placements.includes('cashier')) throw new Error('Эту акцию нельзя применить на кассе');
      if (promo?.branchId && promo.branchId !== input.branchId) throw new Error('Акция не действует в этом филиале');
      const hasExcludedItem = input.items.some((item) => excluded.includes(item.toLowerCase()));
      let accrued = hasExcludedItem ? 0 : Math.round(input.amount * loyalty.pointsPerCurrency);
      if (promo?.kind === 'double_points') accrued *= 2;
      if (promo?.kind === 'points') accrued += promo.value;
      const pointsDelta = accrued - redeem;
      const maxRedeem = Math.floor(input.amount * ((loyalty.maxRedemptionPercent ?? 20) / 100));
      if (redeem > maxRedeem) {
        throw new Error(`Можно списать не более ${maxRedeem} бонусов (${loyalty.maxRedemptionPercent ?? 20}% чека)`);
      }
      if (input.amount < (loyalty.minPurchaseAmount ?? 0)) {
        throw new Error(`Минимальная сумма для бонусов — ${loyalty.minPurchaseAmount} ₸`);
      }
      const requiresConfirmation = redeem > REDEEM_CONFIRM_THRESHOLD;
      const every = loyalty.rewardEveryVisits ?? 6;
      const earnedRewards = Math.floor(membership.visits / every);
      const rewardAvailable = earnedRewards > (membership.claimedVisitRewards ?? 0);
      if (input.claimReward && !rewardAvailable) throw new Error('Награда пока недоступна');
      const rewardTitle = input.claimReward ? loyalty.rewardTitle : promo?.kind === 'gift' ? promo.title : null;

      const transaction: Transaction = {
        id: uid('trx'),
        businessId: input.businessId,
        branchId: input.branchId,
        customerId: customer.id,
        staffId: input.staffId,
        amount: input.amount,
        pointsDelta,
        accruedPoints: accrued,
        redeemedPoints: redeem,
        status: requiresConfirmation ? 'pending_confirmation' : 'completed',
        rewardTitle,
        promoId: promo?.id ?? null,
        kind: 'purchase',
        items: input.items,
        createdAt: nowIso(),
      };
      s.transactions.push(transaction);

      if (!requiresConfirmation) {
        membership.points += pointsDelta;
        membership.visits += 1;
        membership.lastSeen = transaction.createdAt;
        membership.totalSpent += input.amount;
        if (input.claimReward) membership.claimedVisitRewards = (membership.claimedVisitRewards ?? 0) + 1;
        input.items.forEach((item) => {
          if (!membership.favoriteItems.includes(item)) membership.favoriteItems.push(item);
        });
        logAction(input.businessId, 'purchase', `Покупка ${input.amount} ₸ — ${customer.name}`, {
          customerId: customer.id,
          amount: input.amount,
        });
        emitTransaction(transaction);
        if (promo) {
          const at = transaction.createdAt;
          if (!s.promoEvents.some((event) => event.promoId === promo.id && event.customerId === customer.id && event.stage === 'visited')) s.promoEvents.push({ promoId: promo.id, customerId: customer.id, stage: 'visited', at });
          s.promoEvents.push({ promoId: promo.id, customerId: customer.id, stage: 'redeemed', at });
        }
      } else {
        logAction(input.businessId, 'redeem_pending', `Ожидается подтверждение списания — ${customer.name}`, {
          customerId: customer.id,
          amount: input.amount,
          redeem,
        });
      }

      return {
        transaction: clone(transaction),
        membership: clone(membership),
        requiresConfirmation,
        rewardUnlocked: Math.floor(membership.visits / every) > (membership.claimedVisitRewards ?? 0),
      };
    },

    async confirmRedeem(transactionId) {
      const s = state();
      const t = s.transactions.find((x) => x.id === transactionId);
      if (!t) throw new Error(`Транзакция ${transactionId} не найдена`);
      if (t.status !== 'pending_confirmation') return clone(t);
      const membership = s.memberships.find(
        (item) => item.businessId === t.businessId && item.customerId === t.customerId,
      );
      if (!membership) throw new Error('Бонусный счёт клиента не найден');
      const redeem = t.redeemedPoints ?? Math.max(0, -t.pointsDelta);
      if (redeem > membership.points) throw new Error('На счёте уже недостаточно бонусов');
      membership.points += t.pointsDelta;
      membership.visits += 1;
      membership.lastSeen = t.createdAt;
      membership.totalSpent += t.amount;
      if (t.rewardTitle && !t.promoId) membership.claimedVisitRewards = (membership.claimedVisitRewards ?? 0) + 1;
      t.items.forEach((item) => {
        if (!membership.favoriteItems.includes(item)) membership.favoriteItems.push(item);
      });
      t.status = 'completed';
      if (t.promoId) {
        if (!s.promoEvents.some((event) => event.promoId === t.promoId && event.customerId === t.customerId && event.stage === 'visited')) s.promoEvents.push({ promoId: t.promoId, customerId: t.customerId, stage: 'visited', at: nowIso() });
        s.promoEvents.push({ promoId: t.promoId, customerId: t.customerId, stage: 'redeemed', at: nowIso() });
      }
      logAction(t.businessId, 'redeem_confirmed', `Клиент подтвердил списание ${redeem} бонусов`, {
        transactionId: t.id,
        customerId: t.customerId,
      });
      emitTransaction(t);
      return clone(t);
    },

    // ── Сегменты ──
    async listSegments(businessId) {
      return clone(segmentsOf(businessId));
    },

    async getSegment(businessId, code: SegmentCode) {
      const found = segmentsOf(businessId).find((s) => s.code === code);
      return clone(
        found ?? {
          code,
          title: SEGMENT_META[code].title,
          description: SEGMENT_META[code].description,
          count: 0,
          customerIds: [],
        },
      );
    },

    // ── Акции ──
    async listPromos(businessId) {
      return clone(
        state()
          .promos.filter((p) => p.businessId === businessId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },

    async getPromo(id) {
      return clone(state().promos.find((p) => p.id === id) ?? null);
    },

    async forecastPromo(input: CreatePromoInput) {
      const s = state();
      const business = s.businesses.find((b) => b.id === input.businessId);
      const audienceSize = promoAudienceSize(input);

      return forecastPromo({
        kind: input.kind,
        value: input.value,
        segment: input.segment,
        audienceSize,
        avgCheck: business?.avgCheck ?? 3000,
        pointsPerCurrency: loyaltyOf(input.businessId).pointsPerCurrency,
      });
    },

    async createPromo(input: CreatePromoInput) {
      assertPlanLimit(input.businessId, 'activePromos', state().promos.filter((item) => item.businessId === input.businessId && (item.status === 'active' || item.status === 'scheduled')).length, 'активных акций');
      const forecast = await repo.forecastPromo(input);
      const audienceSize = promoAudienceSize(input);

      const promo: Promo = {
        id: uid('promo'),
        businessId: input.businessId,
        kind: input.kind,
        title: input.title,
        value: input.value,
        segment: input.segment,
        goal: input.goal,
        audienceMode: input.goal === 'new_customers' ? 'public' : 'segment',
        branchId: input.branchId ?? null,
        channel: input.channel ?? 'telegram',
        placements: input.placements ?? ['site', 'client_app'],
        body: input.body,
        audienceSize,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: 'draft',
        forecast,
        promocode: Math.random().toString(36).slice(2, 8).toUpperCase(),
        createdAt: nowIso(),
      };
      state().promos.push(promo);
      logAction(input.businessId, 'promo_created', `Создана акция «${promo.title}»`, {
        promoId: promo.id,
      });
      return clone(promo);
    },

    async updatePromo(id, patch) {
      const p = state().promos.find((x) => x.id === id);
      if (!p) throw new Error(`Акция ${id} не найдена`);
      Object.assign(p, patch, { id });
      return clone(p);
    },

    /** Запуск публикует акцию. Доставку сообщений выполняет отдельная рассылка. */
    async launchPromo(id) {
      const s = state();
      const promo = s.promos.find((p) => p.id === id);
      if (!promo) throw new Error(`Акция ${id} не найдена`);

      promo.status = promo.startsAt > nowIso() ? 'scheduled' : 'active';
      if (promo.audienceMode === 'public' || promo.goal === 'new_customers') {
        logAction(promo.businessId, promo.status === 'scheduled' ? 'promo_scheduled' : 'promo_launched', promo.status === 'scheduled' ? `Акция «${promo.title}» запланирована` : `Публичная акция «${promo.title}» запущена`, { promoId: promo.id, estimatedReach: promo.audienceSize });
        return clone(promo);
      }
      const segment = segmentsOf(promo.businessId).find((x) => x.code === promo.segment);
      const recipients = (segment?.customerIds ?? []).filter((cid) => {
        const m = s.memberships.find(
          (x) => x.businessId === promo.businessId && x.customerId === cid,
        );
        return (m?.consentChannels.length ?? 0) > 0;
      });

      promo.audienceSize = recipients.length;
      if (promo.status === 'scheduled') {
        logAction(promo.businessId, 'promo_scheduled', `Акция «${promo.title}» запланирована`, { promoId: promo.id, startsAt: promo.startsAt });
        return clone(promo);
      }
      logAction(promo.businessId, 'promo_launched', `Акция «${promo.title}» опубликована`, {
        promoId: promo.id,
        audienceSize: recipients.length,
        delivery: 'requires_campaign',
      });
      return clone(promo);
    },

    async getPromoFunnel(promoId): Promise<PromoFunnel> {
      const s = state();
      const events = s.promoEvents.filter((e) => e.promoId === promoId);
      const count = (stage: PromoStage) =>
        new Set(events.filter((e) => e.stage === stage).map((e) => e.customerId)).size;

      const promo = s.promos.find((p) => p.id === promoId);
      const business = s.businesses.find((b) => b.id === promo?.businessId);
      const redeemed = count('redeemed');

      return {
        promoId,
        sent: count('sent'),
        opened: count('opened'),
        clicked: count('clicked'),
        visited: count('visited'),
        redeemed,
        // Выручка акции: воспользовавшиеся × средний чек, за вычетом скидки.
        // Считаем нетто, чтобы цифра в отчёте была честной.
        revenue: Math.round(
          redeemed *
            (business?.avgCheck ?? 3000) *
            (promo?.kind === 'discount' ? 1 - promo.value / 100 : 1),
        ),
      };
    },

    async listPromoEvents(promoId, stage?: PromoStage) {
      const out: PromoEvent[] = state().promoEvents.filter(
        (e) => e.promoId === promoId && (!stage || e.stage === stage),
      );
      return clone(out);
    },

    // ── Рассылки ──
    async listCampaigns(businessId) {
      return clone(
        state()
          .campaigns.filter((c) => c.businessId === businessId)
          .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? '')),
      );
    },

    async createCampaign(input: CreateCampaignInput) {
      const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      assertPlanLimit(input.businessId, 'campaignsPerMonth', state().campaigns.filter((item) => item.businessId === input.businessId && (item.sentAt ?? '') >= monthAgo).length, 'рассылок в месяц');
      const segment = segmentsOf(input.businessId).find((x) => x.code === input.audienceSegment);
      const eligibleIds = (segment?.customerIds ?? []).filter((customerId) => {
        const membership = state().memberships.find(
          (item) => item.businessId === input.businessId && item.customerId === customerId,
        );
        if (!membership?.consentChannels.includes(input.channel)) return false;
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const recent = state().campaigns.filter((item) => item.businessId === input.businessId && Boolean(item.sentAt) && item.sentAt! >= since && item.recipientIds?.includes(customerId)).length;
        return recent < MAX_CAMPAIGNS_PER_MONTH;
      });
      const campaign: Campaign = {
        id: uid('cmp'),
        businessId: input.businessId,
        promoId: input.promoId,
        channel: input.channel,
        audienceSegment: input.audienceSegment,
        audienceSize: eligibleIds.length,
        body: input.body,
        sentAt: null,
        recipientIds: eligibleIds,
        opened: 0,
        clicked: 0,
        visited: 0,
        redeemed: 0,
        simulated: true,
      };
      state().campaigns.push(campaign);
      return clone(campaign);
    },

    /**
     * Отправки в MVP нет. Симуляция заполняет воронку правдоподобными
     * долями — владельцу есть что смотреть в отчёте сразу после отправки.
     */
    async simulateSend(campaignId) {
      const s = state();
      const campaign = s.campaigns.find((c) => c.id === campaignId);
      if (!campaign) throw new Error(`Рассылка ${campaignId} не найдена`);

      campaign.sentAt = nowIso();
      campaign.simulated = true;
      campaign.opened = Math.round(campaign.audienceSize * 0.63);
      campaign.clicked = Math.round(campaign.audienceSize * 0.42);
      campaign.visited = Math.round(campaign.audienceSize * 0.23);
      campaign.redeemed = campaign.promoId ? Math.round(campaign.audienceSize * 0.17) : 0;

      const promoId = campaign.promoId;
      if (promoId) {
        const segment = segmentsOf(campaign.businessId).find(
          (x) => x.code === campaign.audienceSegment,
        );
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const businessPromoIds = new Set(s.promos.filter((promo) => promo.businessId === campaign.businessId).map((promo) => promo.id));
        const ids = (campaign.recipientIds ?? segment?.customerIds ?? []).filter((customerId) => {
          const membership = s.memberships.find(
            (item) => item.businessId === campaign.businessId && item.customerId === customerId,
          );
          if (!membership?.consentChannels.includes(campaign.channel)) return false;
          const recent = s.promoEvents.filter(
            (event) => event.customerId === customerId && event.stage === 'sent' && event.at >= since && businessPromoIds.has(event.promoId),
          ).length;
          return recent < MAX_CAMPAIGNS_PER_MONTH;
        });
        campaign.audienceSize = ids.length;
        campaign.recipientIds = ids;
        campaign.opened = Math.round(ids.length * 0.63);
        campaign.clicked = Math.round(ids.length * 0.42);
        campaign.visited = Math.round(ids.length * 0.23);
        campaign.redeemed = Math.round(ids.length * 0.17);
        const at = campaign.sentAt;
        const take = (share: number) => ids.slice(0, Math.round(ids.length * share));

        const stages: [PromoStage, number][] = [
          ['sent', 1],
          ['opened', 0.63],
          ['clicked', 0.42],
          ['visited', 0.23],
          ['redeemed', 0.17],
        ];
        stages.forEach(([stage, share]) => {
          take(share).forEach((customerId) => {
            s.promoEvents.push({ promoId, customerId, stage, at });
          });
        });
      }

      logAction(
        campaign.businessId,
        'campaign_sent',
        `Отправлена рассылка на ${campaign.audienceSize} клиентов`,
        { campaignId, channel: campaign.channel },
      );
      return clone(campaign);
    },

    async countRecentCampaigns(businessId, customerId) {
      const s = state();
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      return s.campaigns.filter((campaign) => campaign.businessId === businessId && Boolean(campaign.sentAt) && campaign.sentAt! >= since && campaign.recipientIds?.includes(customerId)).length;
    },

    // ── Аналитика ──
    async getBusinessStats(businessId, range?: DateRange): Promise<BusinessStats> {
      const s = state();
      const period = range ?? defaultRange(30);
      const inPeriod = s.transactions.filter(
        (t) => t.businessId === businessId && inRange(t.createdAt, period),
      );
      const purchases = inPeriod.filter(
        (t) => t.kind === 'purchase' && t.status !== 'pending_confirmation' && t.status !== 'cancelled',
      );
      const anonymousSales = s.anonymousSales.filter((sale) => sale.businessId === businessId && inRange(sale.createdAt, period));

      const revenue = purchases.reduce((sum, t) => sum + t.amount, 0) + anonymousSales.reduce((sum, sale) => sum + sale.amount, 0);
      const profiles = profilesOf(businessId);

      const newCustomers = s.memberships.filter(
        (m) => m.businessId === businessId && inRange(m.firstSeen, period),
      ).length;

      const buyerIds = new Set(purchases.map((t) => t.customerId));
      const returningCustomers = [...buyerIds].filter((id) => {
        const m = s.memberships.find((x) => x.businessId === businessId && x.customerId === id);
        return m ? m.firstSeen < period.from : false;
      }).length;

      const items = new Map<string, number>();
      purchases.forEach((t) => t.items.forEach((i) => items.set(i, (items.get(i) ?? 0) + 1)));
      anonymousSales.forEach((sale) => sale.items.forEach((item) => items.set(item, (items.get(item) ?? 0) + 1)));

      const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        visits: purchases.filter((t) => new Date(t.createdAt).getDay() === weekday).length + anonymousSales.filter((sale) => new Date(sale.createdAt).getDay() === weekday).length,
      }));

      const atRisk = profiles.filter(
        (p) => p.activity === 'at_risk' || p.activity === 'lapsed',
      ).length;

      const totalSales = purchases.length + anonymousSales.length;
      const activePromo = s.promos.find((promo) => promo.businessId === businessId && promo.status === 'active');
      const activeEvents = activePromo ? s.promoEvents.filter((event) => event.promoId === activePromo.id) : [];
      const sentCount = new Set(activeEvents.filter((event) => event.stage === 'sent').map((event) => event.customerId)).size;
      const redeemedCount = new Set(activeEvents.filter((event) => event.stage === 'redeemed').map((event) => event.customerId)).size;

      return {
        totalCustomers: profiles.length,
        newCustomers,
        returningCustomers,
        repeatVisits: purchases.filter((transaction) => {
          const membership = s.memberships.find((item) => item.businessId === businessId && item.customerId === transaction.customerId);
          return (membership?.visits ?? 0) > 1;
        }).length,
        visits: totalSales,
        avgCheck: totalSales ? Math.round(revenue / totalSales) : 0,
        activeCustomers: profiles.filter((p) => p.activity === 'active').length,
        atRiskShare: profiles.length ? Math.round((atRisk / profiles.length) * 100) / 100 : 0,
        atRiskCustomers: atRisk,
        pointsAccrued: inPeriod
          .filter((t) => t.pointsDelta > 0)
          .reduce((sum, t) => sum + t.pointsDelta, 0),
        pointsRedeemed: Math.abs(
          inPeriod.filter((t) => t.pointsDelta < 0).reduce((sum, t) => sum + t.pointsDelta, 0),
        ),
        revenue,
        pointsUnspent: s.memberships.filter((membership) => membership.businessId === businessId).reduce((sum, membership) => sum + membership.points, 0),
        activePromoConversion: sentCount > 0 ? redeemedCount / sentCount : 0,
        identifiedShare: totalSales ? purchases.length / totalSales : 0,
        topItems: [...items.entries()]
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        byWeekday,
      };
    },

    async listActivityLog(businessId, limit = 30) {
      return clone(
        state()
          .activityLog.filter((e) => e.businessId === businessId)
          .slice(0, limit),
      );
    },

    // ── Онлайн-запись и депозиты ──
    async listBookings(businessId) {
      return clone(
        state()
          .bookings.filter((b) => b.businessId === businessId)
          .sort((a, b) => a.at.localeCompare(b.at)),
      );
    },

    async createBooking(input) {
      const booking: Booking = { ...input, id: uid('bkg'), status: 'pending' };
      state().bookings.push(booking);
      logAction(input.businessId, 'booking_created', `Новая запись: ${input.service}`, {
        customerId: input.customerId,
      });
      return clone(booking);
    },

    async updateBooking(id, patch) {
      const b = state().bookings.find((x) => x.id === id);
      if (!b) throw new Error(`Запись ${id} не найдена`);
      Object.assign(b, patch, { id });
      logAction(b.businessId, 'booking_updated', `Статус записи изменён: ${b.service}`, { bookingId: id, status: b.status });
      return clone(b);
    },

    async listDeposits(businessId, customerId?) {
      return clone(
        state().deposits.filter(
          (d) => d.businessId === businessId && (!customerId || d.customerId === customerId),
        ),
      );
    },

    async createDeposit(input) {
      const deposit: Deposit = { ...input, id: uid('dep'), initialBalance: input.initialBalance ?? input.balance, issuedAt: input.issuedAt ?? nowIso() };
      state().deposits.push(deposit);
      logAction(input.businessId, 'deposit_created', `Выпущен ${input.kind === 'certificate' ? 'сертификат' : input.kind === 'subscription' ? 'абонемент' : 'депозит'} «${input.title ?? 'Без названия'}»`, { depositId: deposit.id, customerId: input.customerId, balance: input.balance });
      return clone(deposit);
    },

    async adjustDeposit(id, delta) {
      const deposit = state().deposits.find((item) => item.id === id);
      if (!deposit) throw new Error('Сертификат или абонемент не найден');
      const next = deposit.balance + delta;
      if (!Number.isFinite(delta) || delta === 0 || next < 0) throw new Error('Некорректная сумма списания');
      deposit.balance = next;
      logAction(deposit.businessId, 'deposit_adjusted', `${delta < 0 ? 'Списано' : 'Начислено'} ${Math.abs(delta)} ₸ по «${deposit.title ?? 'сертификату'}»`, { depositId: id, delta, balance: next });
      return clone(deposit);
    },

    // ── Realtime ──
    subscribeTransactions(businessId, onInsert) {
      let set = listeners.get(businessId);
      if (!set) {
        set = new Set();
        listeners.set(businessId, set);
      }
      const bucket = set;
      bucket.add(onInsert);
      return () => {
        bucket.delete(onInsert);
      };
    },
  };

  const mutatingMethods = new Set<keyof Repo>([
    'updateUser',
    'createUser',
    'resetDemoData',
    'updateBusinessType',
    'updateRecommendationSetting',
    'createTool',
    'updateTool',
    'deleteTool',
    'createTemplate',
    'updateTemplate',
    'deleteTemplate',
    'updatePlan',
    'createBusiness',
    'updateBusiness',
    'changeSubscription',
    'createBranch',
    'updateBranch',
    'incrementBusinessQrStat',
    'updateLoyaltyConfig',
    'updateSiteConfig',
    'activateTool',
    'deactivateTool',
    'toggleFavorite',
    'createStaff',
    'updateStaff',
    'deleteStaff',
    'createCustomer',
    'updateCustomer',
    'rotateQrToken',
    'joinBusiness',
    'updateConsent',
    'updateMembership',
    'removeCustomerFromBusiness',
    'adjustPoints',
    'recordPurchase',
    'confirmRedeem',
    'createPromo',
    'updatePromo',
    'launchPromo',
    'createCampaign',
    'simulateSend',
    'createBooking',
    'updateBooking',
    'createDeposit',
    'adjustDeposit',
  ]);

  return new Proxy(repo, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver) as unknown;
      if (
        typeof property !== 'string' ||
        !mutatingMethods.has(property as keyof Repo) ||
        typeof original !== 'function'
      ) {
        return original;
      }
      return async (...args: unknown[]) => {
        const before = persistHook && db ? clone(db) : null;
        try {
          const result = await (original as (...callArgs: unknown[]) => unknown)(...args);
          persist();
          if (persistHook && db) await persistHook(clone(db));
          return result;
        } catch (error) {
          if (before) db = before;
          throw error;
        }
      };
    },
  });
}
