/**
 * Localy — реализация Repo поверх Supabase.
 *
 * Вызывающие: getRepo() из src/lib/repo/index.ts, только когда заданы
 * LOCALY_REPO=supabase и заданы ключи Supabase.
 *
 * СТАТУС: заглушка. Таблицы и миграции — /supabase/migrations, методы
 * переносятся сюда группами из mock.ts по мере готовности схемы.
 * Пока переменных окружения нет, приложение работает на моке и этот
 * файл не загружается.
 *
 * Прокси вместо шестидесяти заглушек-методов: любой вызов падает с
 * понятным сообщением, а не отдаёт тихий undefined. Схем данных не
 * заводит — контракт целиком в types.ts и repo/index.ts.
 */

import type { Repo } from '@/lib/repo';

export function createSupabaseRepo(): Repo {
  return new Proxy({} as Repo, {
    get(_target, prop) {
      return () => {
        throw new Error(
          `Supabase-репозиторий пока не реализован: ${String(prop)}(). ` +
            'Уберите переменные NEXT_PUBLIC_SUPABASE_* — приложение вернётся на мок-данные.',
        );
      };
    },
  });
}
