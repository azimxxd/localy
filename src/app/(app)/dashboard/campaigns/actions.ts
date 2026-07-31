'use server';

/**
 * Действия рассылок.
 *
 * Вызывающие: src/components/campaigns/CampaignBuilder.tsx.
 * Реальной отправки в MVP нет: createCampaign + simulateSend заполняют
 * воронку правдоподобными долями, владельцу сразу есть что смотреть.
 */

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/repo';
import type { CreateCampaignInput } from '@/lib/repo';
import type { Campaign } from '@/lib/types';
import { requireBusinessAccess } from '@/lib/auth';

export async function sendCampaign(input: CreateCampaignInput): Promise<Campaign> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const repo = await getRepo();
  const body = input.body.trim();
  if (body.length < 5 || body.length > 1000) throw new Error('Текст рассылки должен содержать от 5 до 1000 символов');
  if (input.promoId) {
    const promo = await repo.getPromo(input.promoId);
    if (!promo || promo.businessId !== input.businessId) throw new Error('Акция не найдена');
  }
  await repo.getSegment(input.businessId, input.audienceSegment);
  const campaign = await repo.createCampaign({ ...input, body });
  const sent = await repo.simulateSend(campaign.id);
  revalidatePath('/dashboard/campaigns');
  if (input.promoId) revalidatePath(`/dashboard/promos/${input.promoId}`);
  return sent;
}

export async function sendCampaignTest(input: Pick<CreateCampaignInput, 'businessId' | 'channel' | 'body'>): Promise<{ deliveredAt: string; preview: string }> {
  const session = await requireBusinessAccess(input.businessId, ['owner', 'admin', 'marketer']);
  const body = input.body.trim();
  if (body.length < 5 || body.length > 1000) throw new Error('Сначала напишите текст от 5 до 1000 символов');
  return { deliveredAt: new Date().toISOString(), preview: body.replaceAll('{name}', session.name || 'Тестовый клиент') };
}
