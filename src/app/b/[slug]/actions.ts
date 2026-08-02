'use server';

import { revalidatePath } from 'next/cache';
import { normalizePhone } from '@/lib/phone-verification';
import { enforceRateLimit, requestRateLimitKey } from '@/lib/rate-limit';
import { getRepo } from '@/lib/repo';

export interface PublicBookingState { error?: string; success?: string }

export async function createPublicBooking(slug: string, _state: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const name = String(formData.get('name') ?? '').trim(); const phone = String(formData.get('phone') ?? '').trim(); const service = String(formData.get('service') ?? '').trim(); const atRaw = String(formData.get('at') ?? '').trim();
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10) return { error: 'Укажите имя и корректный телефон' };
  if (!service) return { error: 'Выберите услугу' };
  const at = new Date(atRaw);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) return { error: 'Выберите будущую дату и время' };
  if (at.getTime() > Date.now() + 180 * 86_400_000) return { error: 'Запись доступна не более чем на 180 дней вперёд' };
  if (!(await enforceRateLimit(await requestRateLimitKey(`public-booking:${slug}`), 5, 15 * 60_000))) return { error: 'Слишком много заявок. Попробуйте позже.' };
  const repo = await getRepo(); const business = await repo.getBusinessBySlug(slug); if (!business || business.active === false) return { error: 'Бизнес временно недоступен' };
  const site = await repo.getSiteConfig(business.id); if (!site?.published || !site.sections.some((section) => section.kind === 'booking' && section.enabled)) return { error: 'Онлайн-запись не подключена' };
  const normalizedPhone = normalizePhone(phone); let customer = await repo.findCustomerByPhone(normalizedPhone); if (!customer) customer = await repo.createCustomer({ name, phone: normalizedPhone, birthday: null });
  await repo.joinBusiness(business.id, customer.id); await repo.updateMembership(business.id, customer.id, { source: 'website_booking' });
  try {
    await repo.createBooking({ businessId: business.id, customerId: customer.id, service, at: at.toISOString(), kind: 'booking' });
  } catch (error) {
    // Слот мог занять другой клиент, пока форма была открыта.
    return { error: error instanceof Error ? error.message : 'Не удалось записать' };
  }
  revalidatePath('/dashboard/bookings'); revalidatePath('/dashboard/crm'); revalidatePath(`/b/${slug}`);
  return { success: `Заявка на «${service}» отправлена. Мы свяжемся с вами для подтверждения.` };
}

export async function createPublicLead(slug: string, _state: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const name = String(formData.get('name') ?? '').trim(); const phone = String(formData.get('phone') ?? '').trim(); const message = String(formData.get('message') ?? '').trim();
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10) return { error: 'Укажите имя и корректный телефон' };
  if (message.length < 3 || message.length > 500) return { error: 'Опишите запрос (3–500 символов)' };
  if (!(await enforceRateLimit(await requestRateLimitKey(`public-lead:${slug}`), 5, 15 * 60_000))) return { error: 'Слишком много заявок. Попробуйте позже.' };
  const repo = await getRepo(); const business = await repo.getBusinessBySlug(slug); if (!business || business.active === false) return { error: 'Бизнес временно недоступен' };
  const site = await repo.getSiteConfig(business.id); if (!site?.published || !site.sections.some((section) => section.kind === 'lead' && section.enabled)) return { error: 'Форма заявки не подключена' };
  const normalizedPhone = normalizePhone(phone); let customer = await repo.findCustomerByPhone(normalizedPhone); if (!customer) customer = await repo.createCustomer({ name, phone: normalizedPhone, birthday: null });
  await repo.joinBusiness(business.id, customer.id); await repo.updateMembership(business.id, customer.id, { source: 'website_lead' });
  await repo.createBooking({ businessId: business.id, customerId: customer.id, service: 'Заявка с сайта', note: message, at: new Date().toISOString(), kind: 'lead' });
  revalidatePath('/dashboard/bookings'); revalidatePath('/dashboard/crm');
  return { success: 'Заявка отправлена. Мы свяжемся с вами.' };
}
