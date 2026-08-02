'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { CatalogItem, SiteSection } from '@/lib/types';

export interface SiteEditorInput {
  businessId: string;
  name: string;
  description: string;
  coverUrl: string | null;
  logoUrl: string | null;
  galleryUrls: string[];
  templateId: string;
  primaryColor: string;
  phone: string;
  workHours: string;
  socials: string;
  fontStyle: 'clean' | 'editorial' | 'friendly';
  catalogTitle: string;
  sections: SiteSection[];
  catalog: CatalogItem[];
  published: boolean;
}

export async function saveBusinessSite(input: SiteEditorInput): Promise<{ ok: true }> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  if (input.name.trim().length < 2) throw new Error('Название слишком короткое');
  if (!/^#[0-9a-f]{6}$/i.test(input.primaryColor)) throw new Error('Некорректный цвет');
  if (input.catalog.some((item) => !item.title.trim() || !Number.isFinite(item.price) || item.price < 0)) {
    throw new Error('Проверьте названия и цены в каталоге');
  }
  const assets = [input.coverUrl, input.logoUrl, ...input.galleryUrls].filter((value): value is string => Boolean(value));
  if (assets.length > 8 || assets.some((value) => value.length > 500_000 || (!value.startsWith('data:image/') && !/^https:\/\//i.test(value)))) {
    throw new Error('Изображение слишком большое или имеет неверный формат');
  }

  const repo = await getRepo();
  const socials = input.socials.split(',').map((value) => value.trim()).filter(Boolean);
  const socialValue = (platform: string) => {
    const match = socials.find((value) => value.toLowerCase().includes(platform));
    if (!match) return '';
    return match.replace(new RegExp(`^${platform}\\s*[:—-]?\\s*`, 'i'), '').trim() || platform;
  };
  await repo.updateBusiness(input.businessId, {
    name: input.name.trim(),
    brandColor: input.primaryColor,
    offerings: input.catalog.filter((item) => item.active).map((item) => item.title),
  });
  await repo.updateSiteConfig(input.businessId, {
    templateId: input.templateId,
    description: input.description.trim(),
    coverUrl: input.coverUrl,
    logoUrl: input.logoUrl,
    galleryUrls: input.galleryUrls,
    primaryColor: input.primaryColor,
    phone: input.phone.trim(),
    workHours: input.workHours.trim(),
    telegram: socialValue('telegram'),
    whatsapp: socialValue('whatsapp'),
    instagram: socialValue('instagram'),
    socials,
    fontStyle: input.fontStyle,
    catalogTitle: input.catalogTitle.trim() || 'Каталог',
    sections: input.sections.map((section) => ({
      ...section,
      title: section.title.trim(),
      body: section.body.trim(),
    })),
    catalog: input.catalog.map((item) => ({ ...item, title: item.title.trim(), description: item.description.trim(), category: item.category.trim() || 'Основное', price: Math.round(item.price) })),
    published: input.published,
  });
  revalidatePath('/dashboard/site');
  const business = await repo.getBusiness(input.businessId);
  if (business) revalidatePath(`/b/${business.slug}`);
  return { ok: true };
}
