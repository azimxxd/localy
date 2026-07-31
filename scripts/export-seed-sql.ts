/**
 * Localy — экспорт демо-данных в supabase/seed.sql.
 *
 * Запуск: npx tsx scripts/export-seed-sql.ts
 *
 * Зачем: seed-данные описаны один раз в src/lib/mock/seed.ts. Писать те же
 * 120 клиентов и 1400 транзакций руками в SQL — гарантированное расхождение
 * между моком и базой. Скрипт печатает INSERT-ы под схему 0001_init.sql.
 *
 * Порядок вставки учитывает внешние ключи: справочники → бизнес → клиенты →
 * транзакции → акции → события.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateSeed } from '@/lib/mock/seed';

// ─────────────────────────────────────────────────────────────
// Литералы SQL
// ─────────────────────────────────────────────────────────────

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'null';
  return `'${v.replace(/'/g, "''")}'`;
}

/** Массив text[] в литерале Postgres. Кавычки внутри элементов экранируем. */
function arr(values: readonly string[]): string {
  if (values.length === 0) return "'{}'";
  const inner = values.map((v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
  return `'{${inner.replace(/'/g, "''")}}'`;
}

function num(v: number): string {
  return String(v);
}

function bool(v: boolean): string {
  return v ? 'true' : 'false';
}

function json(v: unknown): string {
  return v === null || v === undefined ? 'null' : `${q(JSON.stringify(v))}::jsonb`;
}

/**
 * Многострочный INSERT. Разбиваем по 500 строк: один INSERT на 1400
 * транзакций превышает лимиты некоторых SQL-клиентов.
 */
function insert(table: string, columns: string[], rows: string[][]): string {
  if (rows.length === 0) return `-- ${table}: нет данных\n`;

  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    chunks.push(
      `insert into ${table} (${columns.join(', ')}) values\n` +
        slice.map((r) => `  (${r.join(', ')})`).join(',\n') +
        ';\n',
    );
  }
  return chunks.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Сборка файла
// ─────────────────────────────────────────────────────────────

function build(): string {
  const s = generateSeed();
  const out: string[] = [];

  out.push('-- Localy — демо-данные.');
  out.push('--');
  out.push('-- СГЕНЕРИРОВАНО: npx tsx scripts/export-seed-sql.ts — правки вносить');
  out.push('-- в src/lib/mock/seed.ts, не здесь.');
  out.push(`-- Дата генерации: ${new Date().toISOString()}`);
  out.push('--');
  out.push('-- Даты сдвинуты относительно момента генерации. Если файл старше');
  out.push('-- пары недель — перегенерируйте, иначе активность клиентов «поедет».');
  out.push('');
  out.push('begin;');
  out.push('');

  out.push('-- Очистка перед вставкой — скрипт идемпотентен');
  out.push('truncate activity_log, deposits, bookings, campaigns, promo_events, promos,');
  out.push('  transactions, memberships, customers, staff, business_tools, site_configs,');
  out.push('  loyalty_configs, branches, businesses, templates, tools, business_types cascade;');
  out.push('');

  out.push(
    insert(
      'business_types',
      ['id', 'code', 'title', 'icon'],
      s.businessTypes.map((t) => [q(t.id), q(t.code), q(t.title), q(t.icon)]),
    ),
  );

  out.push(
    insert(
      'tools',
      ['id', 'title', 'description', 'category', 'kind', 'for_types', 'impact', 'icon'],
      s.tools.map((t) => [
        q(t.id),
        q(t.title),
        q(t.description),
        q(t.category),
        q(t.kind),
        arr(t.forTypes),
        num(t.impact),
        q(t.icon),
      ]),
    ),
  );

  out.push(
    insert(
      'templates',
      ['id', 'title', 'category', 'business_types', 'kind', 'body'],
      s.templates.map((t) => [
        q(t.id),
        q(t.title),
        q(t.category),
        arr(t.businessTypes),
        q(t.kind),
        q(t.body),
      ]),
    ),
  );

  out.push(
    insert(
      'businesses',
      [
        'id', 'slug', 'name', 'type_code', 'city', 'avg_check',
        'goals', 'plan', 'brand_color', 'logo_url', 'created_at',
      ],
      s.businesses.map((b) => [
        q(b.id),
        q(b.slug),
        q(b.name),
        q(b.typeCode),
        q(b.city),
        num(b.avgCheck),
        arr(b.goals),
        q(b.plan),
        q(b.brandColor),
        q(b.logoUrl),
        q(b.createdAt),
      ]),
    ),
  );

  out.push(
    insert(
      'branches',
      ['id', 'business_id', 'title', 'address', 'phone'],
      s.branches.map((b) => [q(b.id), q(b.businessId), q(b.title), q(b.address), q(b.phone)]),
    ),
  );

  out.push(
    insert(
      'loyalty_configs',
      ['business_id', 'points_per_currency', 'reward_threshold', 'reward_title', 'expiry_days'],
      s.loyaltyConfigs.map((l) => [
        q(l.businessId),
        num(l.pointsPerCurrency),
        num(l.rewardThreshold),
        q(l.rewardTitle),
        l.expiryDays === null ? 'null' : num(l.expiryDays),
      ]),
    ),
  );

  out.push(
    insert(
      'site_configs',
      ['business_id', 'template_id', 'sections', 'published'],
      s.siteConfigs.map((c) => [
        q(c.businessId),
        q(c.templateId),
        json(c.sections),
        bool(c.published),
      ]),
    ),
  );

  out.push(
    insert(
      'staff',
      ['id', 'business_id', 'branch_id', 'name', 'role', 'pin'],
      s.staff.map((st) => [
        q(st.id),
        q(st.businessId),
        q(st.branchId),
        q(st.name),
        q(st.role),
        q(st.pin),
      ]),
    ),
  );

  out.push(
    insert(
      'business_tools',
      ['business_id', 'tool_id', 'activated_at', 'is_favorite'],
      s.businessTools.map((bt) => [
        q(bt.businessId),
        q(bt.toolId),
        q(bt.activatedAt),
        bool(bt.isFavorite),
      ]),
    ),
  );

  out.push(
    insert(
      'customers',
      ['id', 'phone', 'name', 'birthday', 'qr_token', 'qr_rotated_at', 'created_at'],
      s.customers.map((c) => [
        q(c.id),
        q(c.phone),
        q(c.name),
        q(c.birthday),
        q(c.qrToken),
        q(c.qrRotatedAt),
        q(c.createdAt),
      ]),
    ),
  );

  out.push(
    insert(
      'memberships',
      [
        'business_id', 'customer_id', 'points', 'visits', 'first_seen',
        'last_seen', 'total_spent', 'consent_channels', 'favorite_items',
      ],
      s.memberships.map((m) => [
        q(m.businessId),
        q(m.customerId),
        num(m.points),
        num(m.visits),
        q(m.firstSeen),
        q(m.lastSeen),
        num(m.totalSpent),
        arr(m.consentChannels),
        arr(m.favoriteItems),
      ]),
    ),
  );

  out.push(
    insert(
      'transactions',
      [
        'id', 'business_id', 'branch_id', 'customer_id', 'staff_id',
        'amount', 'points_delta', 'kind', 'items', 'created_at',
      ],
      s.transactions.map((t) => [
        q(t.id),
        q(t.businessId),
        q(t.branchId),
        q(t.customerId),
        q(t.staffId),
        num(t.amount),
        num(t.pointsDelta),
        q(t.kind),
        arr(t.items),
        q(t.createdAt),
      ]),
    ),
  );

  out.push(
    insert(
      'promos',
      [
        'id', 'business_id', 'kind', 'title', 'value', 'segment', 'audience_size',
        'starts_at', 'ends_at', 'status', 'forecast', 'promocode', 'created_at',
      ],
      s.promos.map((p) => [
        q(p.id),
        q(p.businessId),
        q(p.kind),
        q(p.title),
        num(p.value),
        q(p.segment),
        num(p.audienceSize),
        q(p.startsAt),
        q(p.endsAt),
        q(p.status),
        json(p.forecast),
        q(p.promocode),
        q(p.createdAt),
      ]),
    ),
  );

  // Первичный ключ (promo_id, customer_id, stage) — дубли отбрасываем:
  // одна стадия могла записаться дважды при симуляции рассылки
  const seenEvents = new Set<string>();
  const events = s.promoEvents.filter((e) => {
    const key = `${e.promoId}|${e.customerId}|${e.stage}`;
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
    return true;
  });

  out.push(
    insert(
      'promo_events',
      ['promo_id', 'customer_id', 'stage', 'at'],
      events.map((e) => [q(e.promoId), q(e.customerId), q(e.stage), q(e.at)]),
    ),
  );

  out.push(
    insert(
      'campaigns',
      [
        'id', 'business_id', 'promo_id', 'channel', 'audience_segment',
        'audience_size', 'body', 'sent_at', 'simulated',
      ],
      s.campaigns.map((c) => [
        q(c.id),
        q(c.businessId),
        q(c.promoId),
        q(c.channel),
        q(c.audienceSegment),
        num(c.audienceSize),
        q(c.body),
        q(c.sentAt),
        bool(c.simulated),
      ]),
    ),
  );

  out.push(
    insert(
      'bookings',
      ['id', 'business_id', 'customer_id', 'service', 'at', 'status'],
      s.bookings.map((b) => [
        q(b.id),
        q(b.businessId),
        q(b.customerId),
        q(b.service),
        q(b.at),
        q(b.status),
      ]),
    ),
  );

  out.push(
    insert(
      'deposits',
      ['id', 'business_id', 'customer_id', 'balance', 'kind'],
      s.deposits.map((d) => [q(d.id), q(d.businessId), q(d.customerId), num(d.balance), q(d.kind)]),
    ),
  );

  out.push(
    insert(
      'activity_log',
      ['id', 'business_id', 'actor_id', 'actor_name', 'type', 'payload', 'at'],
      s.activityLog.map((e) => [
        q(e.id),
        q(e.businessId),
        q(e.actorId),
        q(e.actorName),
        q(e.type),
        json(e.payload),
        q(e.at),
      ]),
    ),
  );

  out.push('commit;');
  out.push('');

  return out.join('\n');
}

const target = join(process.cwd(), 'supabase', 'seed.sql');
const sql = build();
writeFileSync(target, sql, 'utf8');

console.log(
  `supabase/seed.sql — ${sql.split('\n').length} строк, ${(sql.length / 1024).toFixed(0)} КБ`,
);
