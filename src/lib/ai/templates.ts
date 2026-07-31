/**
 * Localy — шаблонные тексты акций и рассылок.
 *
 * Вызывающие: src/lib/ai/client.ts (как фолбэк), src/app/api/ai/**.
 *
 * Зачем: если ключа Anthropic нет, сеть недоступна или модель ответила
 * мусором — интерфейс всё равно показывает осмысленный текст. Демо не может
 * упасть из-за внешнего сервиса. Это чистые функции, без сети.
 */

import type { BusinessTypeCode, NotificationChannel, PromoKind, SegmentCode } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Словари
// ─────────────────────────────────────────────────────────────

/** Как называется «то, что покупают» в этой нише. */
const OFFER_NOUN: Record<BusinessTypeCode, string> = {
  coffee: 'напиток',
  barber: 'стрижку',
  beauty: 'услугу',
  flower: 'букет',
  repair: 'ремонт',
  retail: 'покупку',
};

/** Обращение к аудитории сегмента — задаёт тон текста. */
const SEGMENT_TONE: Record<SegmentCode, string> = {
  new: 'для тех, кто был у вас впервые',
  returning: 'для тех, кто вернулся',
  habit_forming: 'для тех, кто начинает приходить регулярно',
  regular: 'для постоянных гостей',
  loyal: 'для самых верных клиентов',
  declining: 'для тех, кто стал приходить реже',
  lapsed: 'для тех, кого давно не было',
  at_risk: 'для тех, кто стал заходить реже',
  high_points: 'для тех, у кого накопились бонусы',
  expiring_points: 'для тех, у кого бонусы скоро сгорят',
  promo_lovers: 'для тех, кто любит выгодные предложения',
  item_buyers: 'для тех, кто берёт одно и то же',
  high_check: 'для гостей с большим чеком',
  no_booking: 'для тех, кто давно не записывался',
  birthday_soon: 'для тех, у кого скоро день рождения',
  campaign_arrival: 'для тех, кто пришёл по прошлой акции',
  no_consent: 'для клиентов без согласия на рассылку',
};

// ─────────────────────────────────────────────────────────────
// Текст акции
// ─────────────────────────────────────────────────────────────

export interface PromoTextInput {
  businessName: string;
  businessType: BusinessTypeCode;
  kind: PromoKind;
  /** Смысл зависит от типа: проценты, тенге, бонусы или множитель. */
  value: number;
  segment: SegmentCode;
  avgCheck: number;
  rewardTitle?: string;
}

export interface PromoText {
  title: string;
  body: string;
}

/** Заголовок и описание акции без обращения к модели. */
export function promoTextTemplate(input: PromoTextInput): PromoText {
  const noun = OFFER_NOUN[input.businessType];
  const tone = SEGMENT_TONE[input.segment];
  const v = input.value;

  switch (input.kind) {
    case 'discount':
      return {
        title: `Скидка ${v}% ${tone}`,
        body: `Дарим ${v}% на ${noun} — предложение ${tone}. Покажите промокод на кассе.`,
      };
    case 'coupon':
      return {
        title: `Купон на ${v.toLocaleString('ru-RU')} ₸`,
        body: `Купон на ${v.toLocaleString('ru-RU')} ₸ — потратьте на любой ${noun}. Один купон на визит.`,
      };
    case 'points':
      return {
        title: `${v} бонусов в подарок`,
        body: `Начисляем ${v} бонусов ${tone}. Бонусами можно оплатить часть следующего визита.`,
      };
    case 'gift':
      return {
        title: 'Подарок к визиту',
        body: `Приходите — и получите подарок к вашему заказу. Предложение ${tone}.`,
      };
    case 'two_plus_one':
      return {
        title: 'Два плюс один — третий в подарок',
        body: `Берёте два — третий ${noun} за наш счёт. Работает всю неделю.`,
      };
    case 'double_points':
      return {
        title: 'Двойные бонусы',
        body: 'Бонусы за визит начисляем в двойном размере. Хороший повод зайти именно сейчас.',
      };
    case 'return_reward':
      return {
        title: `Скидка ${v}% на второй визит`,
        body: `Возвращайтесь в течение двух недель — и получите ${v}% на ${noun}.`,
      };
    case 'item_promo':
      return {
        title: `−${v}% на избранное`,
        body: `Скидка ${v}% на позиции, которые вы уже пробовали. Мы помним ваш выбор.`,
      };
    case 'winback':
      return {
        title: 'Мы соскучились',
        body: `Давно вас не видели в «${input.businessName}». Возвращайтесь — дарим ${v}% на ${noun}.`,
      };
    case 'birthday':
      return {
        title: 'Подарок на день рождения',
        body: `С днём рождения! ${input.rewardTitle ?? 'Подарок'} ждёт вас в течение недели.`,
      };
    case 'referral':
      return {
        title: 'Приведите друга',
        body: `Приведите друга — вы оба получите ${v} бонусов на счёт.`,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// Текст рассылки
// ─────────────────────────────────────────────────────────────

export interface CampaignTextInput {
  businessName: string;
  businessType: BusinessTypeCode;
  segment: SegmentCode;
  channel: NotificationChannel;
  promoTitle?: string;
  promocode?: string;
}

/**
 * Текст сообщения клиенту. `{name}` подставляется при отправке —
 * персонализация не требует отдельного вызова модели на каждого человека.
 */
export function campaignTextTemplate(input: CampaignTextInput): string {
  const noun = OFFER_NOUN[input.businessType];
  const code = input.promocode ? ` Промокод: ${input.promocode}.` : '';
  const offer = input.promoTitle ? `«${input.promoTitle}»` : 'особое предложение';

  const opening: Record<SegmentCode, string> = {
    new: `{name}, спасибо за первый визит в «${input.businessName}»!`,
    returning: '{name}, рады, что вы вернулись!',
    habit_forming: '{name}, кажется, у нас появляется добрая традиция.',
    regular: '{name}, вы часто у нас бываете — и мы это ценим.',
    loyal: '{name}, вы с нами давно, и это дорого стоит.',
    declining: '{name}, давно не виделись — будем рады новой встрече.',
    lapsed: `{name}, давно вас не было в «${input.businessName}».`,
    at_risk: '{name}, вы стали заходить реже — всё в порядке?',
    high_points: '{name}, на вашем счету накопились бонусы.',
    expiring_points: '{name}, ваши бонусы скоро сгорят.',
    promo_lovers: '{name}, для вас — новое выгодное предложение.',
    item_buyers: '{name}, мы помним ваш обычный заказ.',
    high_check: '{name}, спасибо, что выбираете нас.',
    no_booking: '{name}, давно не видели вас в записи.',
    birthday_soon: '{name}, с наступающим днём рождения!',
    campaign_arrival: '{name}, спасибо, что воспользовались нашим предложением.',
    no_consent: '{name}, у нас есть новости для вас.',
  };

  // В SMS платят за символы — режем до одного предложения
  if (input.channel === 'sms') {
    return `${input.businessName}: ${offer}.${code} Ждём вас!`;
  }

  return `${opening[input.segment]} Для вас ${offer} на ${noun}.${code} Ждём вас!`;
}
