/**
 * POST /api/ai/promo-text — заголовок и описание акции.
 *
 * Вызывающие: экран конструктора акций (кнопка «Сгенерировать текст»).
 * TS-импортёров нет — обращение по HTTP.
 *
 * Тело запроса: { businessId, kind, value, segment }
 * Ответ:        { title, body, source: 'ai' | 'template' }
 *
 * `source` возвращаем честно: на демо видно, когда текст написала модель,
 * а когда сработал шаблон. Ошибку клиенту не отдаём никогда — текст есть
 * всегда, иначе конструктор акций замрёт на пустом поле.
 */

import { BRAND_SYSTEM, generateJson, type JsonSchema } from '@/lib/ai/client';
import { promoTextTemplate, type PromoText } from '@/lib/ai/templates';
import { SEGMENT_META } from '@/lib/engine';
import { getRepo } from '@/lib/repo';
import type { PromoKind, SegmentCode } from '@/lib/types';
import { getSession } from '@/lib/auth';

interface Body {
  businessId?: string;
  kind?: PromoKind;
  value?: number;
  segment?: SegmentCode;
}

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Заголовок акции, до 40 символов' },
    body: { type: 'string', description: 'Описание для клиента, до 200 символов' },
  },
  required: ['title', 'body'],
  additionalProperties: false,
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'Некорректный JSON в теле запроса' }, { status: 400 });
  }

  const { businessId, kind, value, segment } = body;
  if (!businessId || !kind || !segment || typeof value !== 'number') {
    return Response.json(
      { error: 'Нужны поля businessId, kind, value, segment' },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) return Response.json({ error: 'Требуется вход' }, { status: 401 });
  if (session.businessId !== businessId || !['owner', 'admin', 'marketer'].includes(session.role)) {
    return Response.json({ error: 'Нет доступа к бизнесу' }, { status: 403 });
  }

  const repo = await getRepo();
  const business = await repo.getBusiness(businessId);
  if (!business) {
    return Response.json({ error: 'Заведение не найдено' }, { status: 404 });
  }

  const loyalty = await repo.getLoyaltyConfig(businessId);
  const segmentInfo = await repo.getSegment(businessId, segment);

  const templateInput = {
    businessName: business.name,
    businessType: business.typeCode,
    kind,
    value,
    segment,
    avgCheck: business.avgCheck,
    rewardTitle: loyalty.rewardTitle,
  };

  const prompt = [
    `Заведение: «${business.name}», ${business.city}.`,
    `Тип бизнеса: ${business.typeCode}. Средний чек: ${business.avgCheck} ₸.`,
    `Тип акции: ${kind}. Размер: ${value}.`,
    `Аудитория: ${SEGMENT_META[segment].title} — ${SEGMENT_META[segment].description}.`,
    `Размер аудитории: ${segmentInfo.count} человек.`,
    `Награда программы лояльности: ${loyalty.rewardTitle}.`,
    '',
    'Придумай заголовок и описание этой акции для клиентов заведения.',
  ].join('\n');

  const generated = await generateJson<PromoText>({
    system: BRAND_SYSTEM,
    prompt,
    schema: SCHEMA,
    maxTokens: 400,
  });

  // Пустые строки от модели равносильны отказу — берём шаблон
  if (generated?.title?.trim() && generated.body?.trim()) {
    return Response.json({ title: generated.title, body: generated.body, source: 'ai' });
  }

  return Response.json({ ...promoTextTemplate(templateInput), source: 'template' });
}
