/**
 * Localy — обёртка над Anthropic API.
 *
 * Вызывающие: src/app/api/ai/promo-text/route.ts, campaign-text/route.ts.
 * Только на сервере — ключ в браузер не попадает.
 *
 * Правило продукта: модель пишет ТЕКСТЫ, но не считает ЦИФРЫ. Прогнозы,
 * сегменты и рекомендации — детерминированные функции из src/lib/engine.
 * Поэтому падение этого файла не ломает продукт: вызывающий берёт шаблон
 * из src/lib/ai/templates.ts и идёт дальше.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Опус 5 — самая способная модель на момент разработки. */
const MODEL = 'claude-opus-5';

/** Тексты короткие, ждать дольше нет смысла — интерфейс не должен подвисать. */
const TIMEOUT_MS = 20_000;

let client: Anthropic | null = null;

/** null = ключа нет, работаем на шаблонах. Это нормальный режим, не ошибка. */
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({
      timeout: TIMEOUT_MS, // в TypeScript SDK таймаут в миллисекундах
      maxRetries: 1, // один повтор; дальше уходим на шаблон
    });
  }
  return client;
}

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Схема ответа в формате JSON Schema. Только объекты с фиксированными полями.
 * Индексная подпись — требование типов SDK для поля format.schema.
 */
export interface JsonSchema {
  [key: string]: unknown;
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required: string[];
  additionalProperties: false;
}

/**
 * Один запрос к модели со структурированным ответом.
 *
 * Возвращает null при любой проблеме — нет ключа, таймаут, отказ модели,
 * непарсящийся ответ. Вызывающий обязан иметь фолбэк; исключения наружу
 * не летят намеренно.
 */
export async function generateJson<T>(params: {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      // Тексты акций — короткая задача, глубокие размышления не нужны
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: params.schema },
      },
      messages: [{ role: 'user', content: params.prompt }],
    });

    // Классификаторы могли отклонить запрос — content тогда пустой
    if (response.stop_reason === 'refusal') return null;
    // Обрыв по лимиту токенов даёт невалидный JSON
    if (response.stop_reason === 'max_tokens') return null;

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    // Логируем и молча уходим на шаблон: демо важнее, чем этот текст
    if (error instanceof Anthropic.RateLimitError) {
      console.warn('[ai] лимит запросов, работаем на шаблонах');
    } else if (error instanceof Anthropic.APIConnectionError) {
      console.warn('[ai] нет связи с Anthropic, работаем на шаблонах');
    } else if (error instanceof Anthropic.APIError) {
      console.warn(`[ai] ошибка API ${error.status}: ${error.message}`);
    } else {
      console.warn('[ai] не удалось разобрать ответ модели:', error);
    }
    return null;
  }
}

/** Общая часть системного промпта: кто мы и для кого пишем. */
export const BRAND_SYSTEM = [
  'Ты копирайтер платформы Localy — сервиса лояльности для малого офлайн-бизнеса в Казахстане.',
  'Пишешь короткие тексты акций и сообщений клиентам на русском языке.',
  '',
  'Правила:',
  '— Пиши как живой человек из этого заведения, а не как рассылка банка.',
  '— Без восклицательных знаков подряд, без КАПСА, без эмодзи.',
  '— Никаких обещаний, которых нет во входных данных: не выдумывай сроки, цены и условия.',
  '— Заголовок до 40 символов, текст до 200 символов.',
  '— Отвечай строго объектом JSON по заданной схеме, без пояснений вокруг.',
].join('\n');
