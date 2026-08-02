-- Старые нормализованные demo-таблицы сохраняются для совместимости миграций,
-- но приложение читает только localy_state. Закрываем весь public schema.
alter table localy_state enable row level security;
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
declare table_name text;
begin
  for table_name in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create table if not exists rate_limit_buckets (
  key text not null,
  window_start bigint not null,
  count integer not null default 1 check (count > 0),
  primary key (key, window_start)
);

alter table rate_limit_buckets enable row level security;
revoke all on table rate_limit_buckets from anon, authenticated;

create or replace function consume_rate_limit(p_key text, p_limit integer, p_window_ms bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window bigint;
  next_count integer;
begin
  if p_limit < 1 or p_window_ms < 1000 then
    raise exception 'invalid rate limit';
  end if;
  current_window := floor((extract(epoch from clock_timestamp()) * 1000)::numeric / p_window_ms) * p_window_ms;
  insert into rate_limit_buckets(key, window_start, count)
  values (p_key, current_window, 1)
  on conflict (key, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into next_count;
  delete from rate_limit_buckets where window_start < current_window - (p_window_ms * 4);
  return next_count <= p_limit;
end;
$$;

revoke all on function consume_rate_limit(text, integer, bigint) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, integer, bigint) to service_role;
