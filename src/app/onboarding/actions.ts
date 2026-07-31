'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { BusinessGoal, BusinessTypeCode, SiteSection } from '@/lib/types';

export interface OnboardingState {
  error?: string;
}

const ALLOWED_TYPES = new Set<BusinessTypeCode>(['coffee', 'barber', 'beauty', 'flower', 'repair', 'retail']);
const ALLOWED_GOALS = new Set<BusinessGoal>([
  'create_site',
  'new_customers',
  'return_customers',
  'increase_check',
  'increase_frequency',
  'launch_loyalty',
  'collect_clients',
  'online_booking',
  'automate',
]);

function slugify(value: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
    ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ъ: '', ь: '',
  };
  return value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => translit[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'business';
}

function list(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function completeOnboarding(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await requireSession(['owner']);
  const name = String(formData.get('name') ?? '').trim();
  const typeCode = String(formData.get('typeCode') ?? '') as BusinessTypeCode;
  const city = String(formData.get('city') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const avgCheck = Number(formData.get('avgCheck'));
  const employeeCount = Number(formData.get('employeeCount'));
  const branchCount = Number(formData.get('branchCount'));
  const repeatVisitDays = Number(formData.get('repeatVisitDays'));
  const offerings = list(formData, 'offerings');
  const currentTools = list(formData, 'currentTools');
  const goals = list(formData, 'goals').filter((goal): goal is BusinessGoal =>
    ALLOWED_GOALS.has(goal as BusinessGoal),
  );
  const logoEntry = formData.get('logo');
  let logoUrl: string | null = null;
  if (logoEntry && typeof logoEntry !== 'string' && logoEntry.size > 0) {
    const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
    if (!allowedMime.has(logoEntry.type) || logoEntry.size > 350_000) return { error: 'Логотип: PNG, JPG, WebP или SVG до 350 КБ' };
    logoUrl = `data:${logoEntry.type};base64,${Buffer.from(await logoEntry.arrayBuffer()).toString('base64')}`;
  }

  if (name.length < 2 || !ALLOWED_TYPES.has(typeCode) || city.length < 2 || address.length < 3) {
    return { error: 'Заполните название, категорию, город и адрес' };
  }
  if (!Number.isFinite(avgCheck) || avgCheck < 100 || offerings.length === 0 || goals.length === 0) {
    return { error: 'Укажите средний чек, товары и хотя бы одну цель' };
  }

  const repo = await getRepo();
  const baseSlug = slugify(name);
  const slug = (await repo.getBusinessBySlug(baseSlug))
    ? `${baseSlug}-${Date.now().toString(36).slice(-4)}`
    : baseSlug;

  const business = await repo.createBusiness({
    slug,
    name,
    typeCode,
    city,
    address,
    employeeCount: Math.max(1, Math.min(100, Math.round(employeeCount || 1))),
    branchCount: Math.max(1, Math.min(10, Math.round(branchCount || 1))),
    offerings,
    repeatVisitDays: Math.max(1, Math.min(365, Math.round(repeatVisitDays || 14))),
    currentTools,
    onboardingCompleted: true,
    avgCheck: Math.round(avgCheck),
    goals,
    plan: 'basic',
    brandColor: '#2f6f5e',
    logoUrl,
  });

  const branches = await repo.listBranches(business.id);
  if (branches[0]) {
    await repo.updateBranch(branches[0].id, { address, title: 'Основная точка' });
  }
  for (let index = 1; index < (business.branchCount ?? 1); index += 1) {
    await repo.createBranch({
      businessId: business.id,
      title: `Филиал ${index + 1}`,
      address: `${city}, адрес уточняется`,
      phone: '',
    });
  }

  const rewardTitle =
    typeCode === 'coffee'
      ? 'Шестой напиток бесплатно'
      : typeCode === 'barber'
        ? 'Скидка 20% на следующую стрижку'
        : typeCode === 'flower'
          ? 'Подарок к шестому заказу'
        : 'Подарок постоянному клиенту';
  await repo.updateLoyaltyConfig(business.id, {
    pointsPerCurrency: 0.05,
    rewardThreshold: Math.max(500, Math.round(avgCheck * 0.4)),
    rewardTitle,
    expiryDays: 90,
    maxRedemptionPercent: 20,
    startBonus: 100,
    minPurchaseAmount: Math.max(300, Math.round(avgCheck * 0.2)),
    excludedItems: [],
    rewardEveryVisits: typeCode === 'coffee' ? 6 : 5,
  });

  const sections: SiteSection[] = [
    { kind: 'hero', enabled: true, title: name, body: `${city}. Копите бонусы с первого визита.` },
    { kind: 'about', enabled: true, title: 'О нас', body: 'Локальный бизнес, где вас помнят по имени.' },
    { kind: 'services', enabled: true, title: typeCode === 'coffee' ? 'Меню' : 'Товары и услуги', body: offerings.join(', ') },
    { kind: 'promos', enabled: true, title: 'Акции', body: 'Актуальные предложения для гостей.' },
    { kind: 'loyalty', enabled: true, title: 'Бонусная программа', body: `5% бонусами. Награда: ${rewardTitle}.` },
    { kind: 'booking', enabled: ['barber', 'beauty', 'repair'].includes(typeCode), title: 'Онлайн-запись', body: 'Выберите услугу и удобное время.' },
    { kind: 'lead', enabled: !['barber', 'beauty', 'repair'].includes(typeCode), title: 'Оставить заявку', body: 'Задайте вопрос или закажите обратный звонок.' },
    { kind: 'contacts', enabled: true, title: 'Контакты', body: address },
  ];
  await repo.updateSiteConfig(business.id, {
    templateId: `tpl_site_${typeCode}`,
    sections,
    published: true,
    description: `${name} — ${offerings.slice(0, 3).join(', ')}.`,
    logoUrl,
    phone: '',
    workHours: 'Ежедневно, 08:00–22:00',
    primaryColor: '#2f6f5e',
    fontStyle: 'clean',
    catalog: offerings.map((title, index) => ({
      id: `item_${index + 1}`,
      title,
      description: '',
      category: typeCode === 'coffee' ? 'Меню' : 'Основное',
      price: Math.max(500, Math.round(avgCheck * (0.45 + index * 0.08) / 100) * 100),
      imageUrl: null,
      active: true,
    })),
  });

  const recommendedToolIds = ['tool_site', 'tool_loyalty', 'tool_crm', 'tool_pos', 'tool_qr_poster'];
  await Promise.all(recommendedToolIds.map((toolId) => repo.activateTool(business.id, toolId)));
  const owner = (await repo.listStaff(business.id)).find((staff) => staff.role === 'owner');
  await repo.updateUser(session.userId, { businessId: business.id, staffId: owner?.id ?? null });

  redirect('/onboarding?done=1');
}
