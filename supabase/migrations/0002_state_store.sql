-- Актуальное production-хранилище Localy. Service-role доступен только серверу;
-- браузерные anon/authenticated роли не видят состояние платформы целиком.
create table if not exists localy_state (
  id text primary key,
  data jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

alter table localy_state enable row level security;
revoke all on table localy_state from anon, authenticated;
