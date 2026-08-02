-- Localy — начальная схема.
--
-- Соответствие: таблицы повторяют типы из src/lib/types.ts один-в-один,
-- snake_case вместо camelCase. Читающий код — src/lib/repo/supabase.ts.
--
-- Денежные суммы — integer в тенге, без копеек.
-- Все даты — timestamptz.
--
-- RLS в демо-режиме НЕ включается: аутентификации в MVP нет, изоляция
-- бизнесов держится на уровне запросов. В продакшене политики
-- обязательны — это отдельная миграция, отмечена в техническом описании.

-- ─────────────────────────────────────────────────────────────
-- Перечисления
-- ─────────────────────────────────────────────────────────────

create type business_type_code as enum ('coffee', 'barber', 'beauty', 'repair', 'retail');
create type tool_category as enum ('marketing', 'sales', 'retention', 'analytics', 'automation');
create type tool_kind as enum ('module', 'automation', 'template', 'integration');
create type template_kind as enum ('promo', 'campaign', 'site');
create type plan_tier as enum ('free', 'basic', 'pro');
create type business_goal as enum (
  'new_customers', 'return_customers', 'increase_check', 'increase_frequency', 'automate'
);
create type staff_role as enum ('owner', 'admin', 'marketer', 'cashier', 'manager');
create type notification_channel as enum ('telegram', 'email', 'sms', 'whatsapp', 'push');
create type transaction_kind as enum ('purchase', 'accrue', 'redeem', 'reward');
create type segment_code as enum (
  'new', 'returning', 'regular', 'loyal', 'lapsed', 'at_risk', 'high_points',
  'expiring_points', 'promo_lovers', 'item_buyers', 'high_check', 'no_booking', 'birthday_soon'
);
create type promo_kind as enum (
  'discount', 'coupon', 'points', 'gift', 'two_plus_one', 'double_points',
  'return_reward', 'item_promo', 'winback', 'birthday', 'referral'
);
create type promo_status as enum ('draft', 'scheduled', 'active', 'finished');
create type promo_stage as enum ('sent', 'opened', 'visited', 'redeemed');
create type booking_status as enum ('pending', 'confirmed', 'done', 'cancelled');
create type deposit_kind as enum ('deposit', 'subscription', 'certificate');

-- ─────────────────────────────────────────────────────────────
-- Справочники платформы (управляются админ-панелью)
-- ─────────────────────────────────────────────────────────────

create table business_types (
  id    text primary key,
  code  business_type_code not null unique,
  title text not null,
  icon  text not null
);

create table tools (
  id          text primary key,
  title       text not null,
  description text not null,
  category    tool_category not null,
  kind        tool_kind not null,
  -- Пустой массив = инструмент осмыслен для всех ниш
  for_types   business_type_code[] not null default '{}',
  impact      smallint not null check (impact between 1 and 5),
  icon        text not null
);

create index tools_category_idx on tools (category);

create table templates (
  id             text primary key,
  title          text not null,
  category       tool_category not null,
  business_types business_type_code[] not null default '{}',
  kind           template_kind not null,
  body           text not null
);

-- ─────────────────────────────────────────────────────────────
-- Бизнес
-- ─────────────────────────────────────────────────────────────

create table businesses (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  type_code   business_type_code not null,
  city        text not null,
  -- Средний чек — база для симулятора прогноза акций
  avg_check   integer not null check (avg_check >= 0),
  goals       business_goal[] not null default '{}',
  plan        plan_tier not null default 'free',
  brand_color text not null default '#7C4DFF',
  logo_url    text,
  created_at  timestamptz not null default now()
);

create table branches (
  id          text primary key,
  business_id text not null references businesses (id) on delete cascade,
  title       text not null,
  address     text not null,
  phone       text not null default ''
);

create index branches_business_idx on branches (business_id);

create table loyalty_configs (
  business_id         text primary key references businesses (id) on delete cascade,
  -- Бонусов за 1 тенге. 0.05 = 5% от суммы покупки
  points_per_currency numeric(6, 4) not null default 0.05,
  reward_threshold    integer not null default 1000,
  reward_title        text not null,
  -- null = бонусы не сгорают
  expiry_days         integer
);

create table site_configs (
  business_id text primary key references businesses (id) on delete cascade,
  template_id text not null,
  -- SiteSection[]: kind, enabled, title, body
  sections    jsonb not null default '[]',
  published   boolean not null default false
);

create table business_tools (
  business_id  text not null references businesses (id) on delete cascade,
  tool_id      text not null references tools (id) on delete cascade,
  -- null = инструмент только в избранном, ещё не активирован
  activated_at timestamptz,
  is_favorite  boolean not null default false,
  primary key (business_id, tool_id)
);

create index business_tools_tool_idx on business_tools (tool_id);

create table staff (
  id          text primary key,
  business_id text not null references businesses (id) on delete cascade,
  branch_id   text references branches (id) on delete set null,
  name        text not null,
  role        staff_role not null,
  -- Короткий код входа в демо-режиме. Не пароль, не хешируется.
  pin         text not null
);

create index staff_business_idx on staff (business_id);

-- ─────────────────────────────────────────────────────────────
-- Клиент — ГЛОБАЛЬНЫЙ, один на всю платформу
-- ─────────────────────────────────────────────────────────────

-- Ядро продукта: один человек — один аккаунт — один QR на все заведения.
-- Балансы и история раздельные, они живут в memberships.
create table customers (
  id            text primary key,
  phone         text not null unique,
  name          text not null,
  birthday      date,
  -- Динамический токен QR, ротируется раз в QR_ROTATION_SECONDS
  qr_token      text not null unique,
  qr_rotated_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table memberships (
  business_id      text not null references businesses (id) on delete cascade,
  customer_id      text not null references customers (id) on delete cascade,
  points           integer not null default 0,
  visits           integer not null default 0,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  total_spent      integer not null default 0,
  -- Пустой массив = не писать вообще
  consent_channels notification_channel[] not null default '{}',
  favorite_items   text[] not null default '{}',
  primary key (business_id, customer_id)
);

create index memberships_customer_idx on memberships (customer_id);
create index memberships_last_seen_idx on memberships (business_id, last_seen desc);

create table transactions (
  id           text primary key,
  business_id  text not null references businesses (id) on delete cascade,
  branch_id    text references branches (id) on delete set null,
  customer_id  text not null references customers (id) on delete cascade,
  staff_id     text references staff (id) on delete set null,
  -- Для redeem/reward = 0
  amount       integer not null default 0,
  -- + начисление, − списание
  points_delta integer not null default 0,
  kind         transaction_kind not null,
  items        text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index transactions_business_time_idx on transactions (business_id, created_at desc);
create index transactions_customer_idx on transactions (business_id, customer_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Акции и рассылки
-- ─────────────────────────────────────────────────────────────

create table promos (
  id            text primary key,
  business_id   text not null references businesses (id) on delete cascade,
  kind          promo_kind not null,
  title         text not null,
  -- Смысл зависит от типа: проценты, тенге, бонусы или множитель
  value         integer not null default 0,
  segment       segment_code not null,
  audience_size integer not null default 0,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        promo_status not null default 'draft',
  -- PromoForecast: прогноз, посчитанный ДО запуска
  forecast      jsonb,
  promocode     text not null,
  created_at    timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create index promos_business_idx on promos (business_id, created_at desc);

create table promo_events (
  promo_id    text not null references promos (id) on delete cascade,
  customer_id text not null references customers (id) on delete cascade,
  stage       promo_stage not null,
  at          timestamptz not null default now(),
  primary key (promo_id, customer_id, stage)
);

create index promo_events_stage_idx on promo_events (promo_id, stage);

create table campaigns (
  id               text primary key,
  business_id      text not null references businesses (id) on delete cascade,
  promo_id         text references promos (id) on delete set null,
  channel          notification_channel not null,
  audience_segment segment_code not null,
  audience_size    integer not null default 0,
  body             text not null,
  sent_at          timestamptz,
  -- В MVP реальной отправки нет — интерфейс полный, отправка симулируется
  simulated        boolean not null default true
);

create index campaigns_business_idx on campaigns (business_id, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- Запись, депозиты, аудит
-- ─────────────────────────────────────────────────────────────

create table bookings (
  id          text primary key,
  business_id text not null references businesses (id) on delete cascade,
  customer_id text not null references customers (id) on delete cascade,
  service     text not null,
  at          timestamptz not null,
  status      booking_status not null default 'pending'
);

-- В MVP реальные деньги НЕ хранятся — это демонстрация модели.
create table deposits (
  id          text primary key,
  business_id text not null references businesses (id) on delete cascade,
  customer_id text not null references customers (id) on delete cascade,
  balance     integer not null default 0,
  kind        deposit_kind not null
);

create index deposits_business_idx on deposits (business_id);

create table activity_log (
  id          text primary key,
  business_id text not null references businesses (id) on delete cascade,
  actor_id    text references staff (id) on delete set null,
  actor_name  text not null,
  type        text not null,
  payload     jsonb not null default '{}',
  at          timestamptz not null default now()
);

create index activity_log_business_idx on activity_log (business_id, at desc);

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────

-- Кассир пробивает покупку → экран владельца обновляется сам.
-- Это главный кадр демо-видео, поэтому публикация обязательна.
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table memberships;
