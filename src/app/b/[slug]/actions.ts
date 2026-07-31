'use server';

import { revalidatePath } from 'next/cache';
import { createCustomerSession } from '@/lib/auth';
import { getRepo } from '@/lib/repo';

export interface PublicBookingState { error?: string; success?: string }

export async function createPublicBooking(slug: string, _state: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const name = String(formData.get('name') ?? '').trim(); const phone = String(formData.get('phone') ?? '').trim(); const service = String(formData.get('service') ?? '').trim(); const atRaw = String(formData.get('at') ?? '').trim();
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10) return { error: 'Укажите имя и корректный телефон' };
  if (!service) return { error: 'Выберите услугу' };
  const at = new Date(atRaw);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) return { error: 'Выберите будущую дату и время' };
  if (at.getTime() > Date.now() + 180 * 86_400_000) return { error: 'Запись доступна не более чем на 180 дней вперёд' };
  const repo = await getRepo(); const business = await repo.getBusinessBySlug(slug); if (!business || business.active === false) return { error: 'Бизнес временно недоступен' };
  const site = await repo.getSiteConfig(business.id); if (!site?.published || !site.sections.some((section) => section.kind === 'booking' && section.enabled)) return { error: 'Онлайн-запись не подключена' };
  let customer = await repo.findCustomerByPhone(phone); if (!customer) customer = await repo.createCustomer({ name, phone, birthday: null });
  await repo.joinBusiness(business.id, customer.id); await repo.updateMembership(business.id, customer.id, { source: 'website_booking' });
  await repo.createBooking({ businessId: business.id, customerId: customer.id, service, at: at.toISOString(), kind: 'booking' });
  await createCustomerSession(customer.id); revalidatePath('/dashboard/bookings'); revalidatePath('/dashboard/crm');
  return { success: `Заявка на «${service}» отправлена. Мы свяжемся с вами для подтверждения.` };
}

export async function createPublicLead(slug: string, _state: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const name = String(formData.get('name') ?? '').trim(); const phone = String(formData.get('phone') ?? '').trim(); const message = String(formData.get('message') ?? '').trim();
  if (name.length < 2 || phone.replace(/\D/g, '').length < 10) return { error: 'Укажите имя и корректный телефон' };
  if (message.length < 3 || message.length > 500) return { error: 'Опишите запрос (3–500 символов)' };
  const repo = await getRepo(); const business = await repo.getBusinessBySlug(slug); if (!business || business.active === false) return { error: 'Бизнес временно недоступен' };
  const site = await repo.getSiteConfig(business.id); if (!site?.published || !site.sections.some((section) => section.kind === 'lead' && section.enabled)) return { error: 'Форма заявки не подключена' };
  let customer = await repo.findCustomerByPhone(phone); if (!customer) customer = await repo.createCustomer({ name, phone, birthday: null });
  await repo.joinBusiness(business.id, customer.id); await repo.updateMembership(business.id, customer.id, { source: 'website_lead' });
  await repo.createBooking({ businessId: business.id, customerId: customer.id, service: 'Заявка с сайта', note: message, at: new Date().toISOString(), kind: 'lead' });
  await createCustomerSession(customer.id); revalidatePath('/dashboard/bookings'); revalidatePath('/dashboard/crm');
  return { success: 'Заявка отправлена. Мы свяжемся с вами.' };
}
