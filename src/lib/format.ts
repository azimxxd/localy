/**
 * Localy — форматирование чисел и дат для интерфейса.
 *
 * Вызывающие: экраны в src/app и компоненты в src/components.
 *
 * Зона времени зафиксирована: сервер и браузер обязаны отрендерить одну и
 * ту же строку, иначе React ругается на расхождение при гидрации. Бизнес
 * казахстанский, поэтому Asia/Almaty — это ещё и правильный ответ.
 */

const TZ = 'Asia/Almaty';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const timeFmt = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});
const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: TZ });
const dayShortFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});

/** «2 400 ₸». Суммы в тенге всегда целые. */
export function kzt(value: number): string {
  return `${money.format(Math.round(value))} ₸`;
}

/** «1 240» — без единицы, единица подписывается рядом в вёрстке. */
export function num(value: number): string {
  return money.format(Math.round(value));
}

/** «73%» из доли 0..1. */
export function percent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

export function timeShort(iso: string): string {
  return timeFmt.format(new Date(iso));
}

export function dateLong(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function dateShort(iso: string): string {
  return dayShortFmt.format(new Date(iso));
}

/** Русская форма слова по числу: plural(3, ['визит','визита','визитов']). */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** «сегодня», «вчера», «11 дней назад» — как говорят про клиента в CRM. */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
}

/** 0 = воскресенье, как в Date.getDay(). */
export const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
