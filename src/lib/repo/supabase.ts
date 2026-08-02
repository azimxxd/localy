/**
 * Localy — реализация Repo поверх Supabase.
 *
 * Вызывающие: getRepo() из src/lib/repo/index.ts, только когда заданы
 * LOCALY_REPO=supabase и заданы ключи Supabase.
 *
 * Данные хранятся в одной versioned JSONB-записи. Бизнес-правила остаются
 * едиными с локальным адаптером, а optimistic lock не даёт двум инстансам
 * молча перезаписать изменения друг друга.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Repo } from '@/lib/repo';
import { generateSeed, type SeedData } from '@/lib/mock/seed';
import { createMockRepo } from '@/lib/repo/mock';

interface StateRow {
  data: SeedData;
  version: number;
}

export async function createSupabaseRepo(): Promise<Repo> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Для LOCALY_REPO=supabase нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const loaded = await client.from('localy_state').select('data, version').eq('id', 'primary').maybeSingle<StateRow>();
  if (loaded.error) throw new Error(`Не удалось загрузить Localy из Supabase: ${loaded.error.message}`);

  let data = loaded.data?.data ?? generateSeed();
  let version = loaded.data?.version ?? 0;
  if (!loaded.data) {
    const inserted = await client.from('localy_state').insert({ id: 'primary', data, version: 1 }).select('version').single<{ version: number }>();
    if (inserted.error) throw new Error(`Не удалось инициализировать Localy в Supabase: ${inserted.error.message}`);
    version = inserted.data.version;
  }

  return createMockRepo({
    initialState: data,
    persistLocal: false,
    async onPersist(nextData) {
      const nextVersion = version + 1;
      const updated = await client
        .from('localy_state')
        .update({ data: nextData, version: nextVersion, updated_at: new Date().toISOString() })
        .eq('id', 'primary')
        .eq('version', version)
        .select('version')
        .maybeSingle<{ version: number }>();
      if (updated.error) throw new Error(`Не удалось сохранить Localy в Supabase: ${updated.error.message}`);
      if (!updated.data) throw new Error('Конфликт записи Localy: данные изменены другим сервером, повторите действие');
      data = nextData;
      version = updated.data.version;
    },
  });
}
