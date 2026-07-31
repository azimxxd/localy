'use server';

/**
 * Серверные действия кабинета владельца.
 *
 * Вызывающие: src/components/shell/Sidebar.tsx (клиентский компонент).
 * Файл с 'use server' безопасно импортировать в клиент — Next превращает
 * экспорты в RPC-ссылки, тело на клиент не утекает.
 */

import { cookies } from 'next/headers';
import { BUSINESS_COOKIE } from '@/lib/demo';

/** Переключение активного заведения в демо. Экраны читают cookie при рендере. */
export async function switchBusiness(businessId: string): Promise<void> {
  const store = await cookies();
  store.set(BUSINESS_COOKIE, businessId, { path: '/', maxAge: 60 * 60 * 24 * 30 });
}
