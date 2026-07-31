/**
 * Localy — реализация Repo поверх сгенерированных демо-данных.
 *
 * Вызывающие: getRepo() из src/lib/repo/index.ts. Напрямую не импортировать.
 *
 * Живёт в памяти процесса. Записи (покупка, акция, рассылка) видны до
 * перезапуска dev-сервера — этого достаточно и для разработки экранов,
 * и для записи демо-видео. Тот же контракт потом закрывает supabase.ts.
 *
 * Схемы данных — только из src/lib/types.ts, своих не заводит.
 */

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
  type ActivityLogEntry,
  type Booking,
  type Business,
  type BusinessStats,
  type Campaign,
  type Customer,
  type CustomerProfile,
  type LoyaltyConfig,
  type Membership,
  type NotificationChannel,
  type PlatformStats,
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
} from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Состояние
// ─────────────────────────────────────────────────────────────

let db: SeedData | null = null;

function state(): SeedData {
  if (!db) db = generateSeed();
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
  if (!membership || !customer) return null;

  return buildCustomerProfile({
    customer,
    membership,
    transactions: transactionsOf(businessId, customerId),
    loyalty: loyaltyOf(businessId),
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

  return {
    loyalty: loyaltyOf(businessId),
    redeemedPromosByCustomer,
    lastBookingByCustomer,
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

export function createMockRepo(): Repo {
  const repo: Repo = {
    // ── Справочники платформы ──
    async listBusinessTypes() {
      return clone(state().businessTypes);
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
        activeBusinesses: s.businesses.length,
        totalCustomers: s.customers.length,
        totalTransactions: s.transactions.length,
        popularTools,
        businessesByType: [...byType.entries()].map(([typeCode, count]) => ({ typeCode, count })),
      };
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
      s.loyaltyConfigs.push({
        businessId: business.id,
        pointsPerCurrency: 0.05,
        rewardThreshold: 1000,
        rewardTitle: 'Награда постоянному клиенту',
        expiryDays: 90,
      });
      s.branches.push({
        id: uid('brn'),
        businessId: business.id,
        title: 'Основная точка',
        address: business.city,
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

    async listBranches(businessId) {
      return clone(state().branches.filter((b) => b.businessId === businessId));
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
      // В демо просроченный токен не отклоняем: между сканом и записью покупки
      // на видео проходит больше QR_ROTATION_SECONDS. В проде — проверка срока.
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

      const membership: Membership = {
        businessId,
        customerId,
        points: 0,
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

      out.sort((a, b) => b.membership.lastSeen.localeCompare(a.membership.lastSeen));

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
      const customer = s.customers.find((c) => c.qrToken === input.qrToken);
      if (!customer) throw new Error('QR-код не распознан');

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
      const accrued = Math.round(input.amount * loyalty.pointsPerCurrency);
      const pointsDelta = accrued - redeem;

      const transaction: Transaction = {
        id: uid('trx'),
        businessId: input.businessId,
        branchId: input.branchId,
        customerId: customer.id,
        staffId: input.staffId,
        amount: input.amount,
        pointsDelta,
        kind: 'purchase',
        items: input.items,
        createdAt: nowIso(),
      };
      s.transactions.push(transaction);

      membership.points += pointsDelta;
      membership.visits += 1;
      membership.lastSeen = transaction.createdAt;
      membership.totalSpent += input.amount;
      input.items.forEach((item) => {
        if (!membership.favoriteItems.includes(item)) membership.favoriteItems.push(item);
      });

      logAction(input.businessId, 'purchase', `Покупка ${input.amount} ₸ — ${customer.name}`, {
        customerId: customer.id,
        amount: input.amount,
      });
      emitTransaction(transaction);

      return {
        transaction: clone(transaction),
        membership: clone(membership),
        requiresConfirmation: redeem > REDEEM_CONFIRM_THRESHOLD,
        rewardUnlocked: membership.points >= loyalty.rewardThreshold,
      };
    },

    async confirmRedeem(transactionId) {
      // В демо подтверждение не откатывает транзакцию — она уже записана.
      // Флаг requiresConfirmation нужен интерфейсу кассы, чтобы показать
      // экран подтверждения клиенту. В проде здесь двухфазная запись.
      const t = state().transactions.find((x) => x.id === transactionId);
      if (!t) throw new Error(`Транзакция ${transactionId} не найдена`);
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
      const segment = segmentsOf(input.businessId).find((x) => x.code === input.segment);

      return forecastPromo({
        kind: input.kind,
        value: input.value,
        segment: input.segment,
        audienceSize: segment?.count ?? 0,
        avgCheck: business?.avgCheck ?? 3000,
        pointsPerCurrency: loyaltyOf(input.businessId).pointsPerCurrency,
      });
    },

    async createPromo(input: CreatePromoInput) {
      const segment = segmentsOf(input.businessId).find((x) => x.code === input.segment);
      const forecast = await repo.forecastPromo(input);

      const promo: Promo = {
        id: uid('promo'),
        businessId: input.businessId,
        kind: input.kind,
        title: input.title,
        value: input.value,
        segment: input.segment,
        audienceSize: segment?.count ?? 0,
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

    /**
     * Запуск акции. Сразу проставляем стадию «получили» всем, кто в сегменте
     * и дал согласие хотя бы на один канал — воронка начинает заполняться,
     * не дожидаясь реальных визитов.
     */
    async launchPromo(id) {
      const s = state();
      const promo = s.promos.find((p) => p.id === id);
      if (!promo) throw new Error(`Акция ${id} не найдена`);

      promo.status = 'active';
      const segment = segmentsOf(promo.businessId).find((x) => x.code === promo.segment);
      const recipients = (segment?.customerIds ?? []).filter((cid) => {
        const m = s.memberships.find(
          (x) => x.businessId === promo.businessId && x.customerId === cid,
        );
        return (m?.consentChannels.length ?? 0) > 0;
      });

      promo.audienceSize = recipients.length;
      const at = nowIso();
      recipients.forEach((customerId) => {
        s.promoEvents.push({ promoId: promo.id, customerId, stage: 'sent', at });
      });

      logAction(promo.businessId, 'promo_launched', `Запущена акция «${promo.title}»`, {
        promoId: promo.id,
        audienceSize: recipients.length,
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
      const segment = segmentsOf(input.businessId).find((x) => x.code === input.audienceSegment);
      const campaign: Campaign = {
        id: uid('cmp'),
        businessId: input.businessId,
        promoId: input.promoId,
        channel: input.channel,
        audienceSegment: input.audienceSegment,
        audienceSize: segment?.count ?? 0,
        body: input.body,
        sentAt: null,
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

      const promoId = campaign.promoId;
      if (promoId) {
        const segment = segmentsOf(campaign.businessId).find(
          (x) => x.code === campaign.audienceSegment,
        );
        const ids = segment?.customerIds ?? [];
        const at = campaign.sentAt;
        const take = (share: number) => ids.slice(0, Math.round(ids.length * share));

        const stages: [PromoStage, number][] = [
          ['sent', 1],
          ['opened', 0.63],
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
      const promoIds = new Set(s.promos.filter((p) => p.businessId === businessId).map((p) => p.id));

      return s.promoEvents.filter(
        (e) =>
          e.stage === 'sent' &&
          e.customerId === customerId &&
          promoIds.has(e.promoId) &&
          e.at >= since,
      ).length;
    },

    // ── Аналитика ──
    async getBusinessStats(businessId, range?: DateRange): Promise<BusinessStats> {
      const s = state();
      const period = range ?? defaultRange(30);
      const inPeriod = s.transactions.filter(
        (t) => t.businessId === businessId && inRange(t.createdAt, period),
      );
      const purchases = inPeriod.filter((t) => t.kind === 'purchase');

      const revenue = purchases.reduce((sum, t) => sum + t.amount, 0);
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

      const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        visits: purchases.filter((t) => new Date(t.createdAt).getDay() === weekday).length,
      }));

      const atRisk = profiles.filter(
        (p) => p.activity === 'at_risk' || p.activity === 'lapsed',
      ).length;

      // Доля покупок, привязанных к клиентской карте. В моке анонимных чеков
      // нет — оцениваем по зрелости заведения: чем больше активировано
      // инструментов, тем выше привязка. В проде считается из кассовых данных.
      const activated = s.businessTools.filter(
        (bt) => bt.businessId === businessId && bt.activatedAt !== null,
      ).length;

      return {
        newCustomers,
        returningCustomers,
        visits: purchases.length,
        avgCheck: purchases.length ? Math.round(revenue / purchases.length) : 0,
        activeCustomers: profiles.filter((p) => p.activity === 'active').length,
        atRiskShare: profiles.length ? Math.round((atRisk / profiles.length) * 100) / 100 : 0,
        pointsAccrued: inPeriod
          .filter((t) => t.pointsDelta > 0)
          .reduce((sum, t) => sum + t.pointsDelta, 0),
        pointsRedeemed: Math.abs(
          inPeriod.filter((t) => t.pointsDelta < 0).reduce((sum, t) => sum + t.pointsDelta, 0),
        ),
        revenue,
        identifiedShare: Math.min(0.92, 0.35 + activated * 0.03),
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
      return clone(b);
    },

    async listDeposits(businessId, customerId?) {
      return clone(
        state().deposits.filter(
          (d) => d.businessId === businessId && (!customerId || d.customerId === customerId),
        ),
      );
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

  return repo;
}
