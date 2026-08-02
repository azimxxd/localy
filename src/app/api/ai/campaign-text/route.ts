/**
 * POST /api/ai/campaign-text — текст сообщения клиентам.
 *
 * Вызывающие: экран рассылок (кнопка «Написать сообщение»).
 * TS-импортёров нет — обращение по HTTP.
 *
 * Тело запроса: { businessId, segment, channel, promoId? }
 * Ответ:        { body, audienceSize, source: 'ai' | 'template' }
 *
 * В тексте оставляем плейсхолдер {name} — подстановка имени происходит
 * при отправке, а не тут. Иначе на каждого клиента пришлось бы делать
 * отдельный запрос к модели.
 */

import { BRAND_SYSTEM, generateJson, type JsonSchema } from '@/lib/ai/client';
import { campaignTextTemplate } from '@/lib/ai/templates';
import { SEGMENT_META } from '@/lib/engine';
import { getRepo } from '@/lib/repo';
import { MAX_CAMPAIGNS_PER_MONTH, type NotificationChannel, type SegmentCode } from '@/lib/types';
import { getSession } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

interface Body {
  businessId?: string;
  segment?: SegmentCode;
  channel?: NotificationChannel;
  promoId?: string;
}

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'string',
      description: 'Текст сообщения клиенту. Должен начинаться с обращения {name},',
    },
  },
  required: ['body'],
  additionalProperties: false,
};

/** Лимит символов по каналу — SMS платная, Telegram нет. */
const CHANNEL_LIMIT: Record<NotificationChannel, number> = {
  sms: 140,
  push: 160,
  telegram: 300,
  whatsapp: 300,
  email: 500,
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'Некорректный JSON в теле запроса' }, { status: 400 });
  }

  const { businessId, segment, channel, promoId } = body;
  if (!businessId || !segment || !channel) {
    return Response.json({ error: 'Нужны поля businessId, segment, channel' }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return Response.json({ error: 'Требуется вход' }, { status: 401 });
  if (session.businessId !== businessId || !['owner', 'admin', 'marketer'].includes(session.role)) {
    return Response.json({ error: 'Нет доступа к бизнесу' }, { status: 403 });
  }
  if (!(await enforceRateLimit(`ai-campaign:${session.userId}`, 20, 60 * 60_000))) {
    return Response.json({ error: 'Лимит генераций исчерпан. Повторите через час.' }, { status: 429 });
  }

  const repo = await getRepo();
  const business = await repo.getBusiness(businessId);
  if (!business) {
    return Response.json({ error: 'Заведение не найдено' }, { status: 404 });
  }

  const segmentInfo = await repo.getSegment(businessId, segment);
  const promo = promoId ? await repo.getPromo(promoId) : null;

  const templateInput = {
    businessName: business.name,
    businessType: business.typeCode,
    segment,
    channel,
    promoTitle: promo?.title,
    promocode: promo?.promocode,
  };

  const limit = CHANNEL_LIMIT[channel];
  const prompt = [
    `Заведение: «${business.name}», ${business.city}. Тип: ${business.typeCode}.`,
    `Канал: ${channel}. Максимум ${limit} символов.`,
    `Аудитория: ${SEGMENT_META[segment].title} — ${SEGMENT_META[segment].description}.`,
    `Получателей: ${segmentInfo.count}.`,
    promo
      ? `Акция: «${promo.title}», промокод ${promo.promocode}. Тип: ${promo.kind}, размер: ${promo.value}.`
      : 'Конкретной акции нет — напиши сообщение-напоминание о заведении.',
    '',
    'Напиши одно сообщение клиенту. Начни с «{name},» — имя подставится при отправке.',
    `Не превышай ${limit} символов вместе с плейсхолдером.`,
    `Помни: клиент получает не больше ${MAX_CAMPAIGNS_PER_MONTH} сообщений в месяц — не будь навязчивым.`,
  ].join('\n');

  const generated = await generateJson<{ body: string }>({
    system: BRAND_SYSTEM,
    prompt,
    schema: SCHEMA,
    maxTokens: 400,
  });

  // Слишком длинный текст режется каналом на полуслове — лучше шаблон
  const text = generated?.body?.trim();
  if (text && text.length <= limit * 1.2) {
    return Response.json({ body: text, audienceSize: segmentInfo.count, source: 'ai' });
  }

  return Response.json({
    body: campaignTextTemplate(templateInput),
    audienceSize: segmentInfo.count,
    source: 'template',
  });
}
