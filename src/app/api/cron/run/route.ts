/**
 * Фоновый обработчик Localy.
 *
 * Вызывающие: внешний планировщик (Railway cron, Vercel cron, curl) и кнопка
 * «Запустить обработчик» в админке платформы.
 *
 * Что делает: запускает акции, у которых наступил startsAt, закрывает
 * просроченные и рассылает birthday-сценарии. Идемпотентен: повторный вызов
 * в тот же день ничего не дублирует.
 *
 * Доступ: заголовок `x-localy-cron-secret` должен совпасть с LOCALY_CRON_SECRET.
 * Без заданного секрета маршрут работает только вне production.
 */

import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/repo';

export const dynamic = 'force-dynamic';

function authorize(request: Request): boolean {
  const secret = process.env.LOCALY_CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const supplied = request.headers.get('x-localy-cron-secret');
  return Boolean(supplied) && supplied === secret;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Требуется секрет планировщика' }, { status: 401 });
  }
  const repo = await getRepo();
  const runs = await repo.runAutomations();
  return NextResponse.json({ ok: true, runs });
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Требуется секрет планировщика' }, { status: 401 });
  }
  const repo = await getRepo();
  return NextResponse.json({ ok: true, runs: await repo.listAutomationRuns(20) });
}
