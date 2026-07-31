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

export async function sendCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const repo = await getRepo();
  const campaign = await repo.createCampaign(input);
  const sent = await repo.simulateSend(campaign.id);
  revalidatePath('/dashboard/campaigns');
  if (input.promoId) revalidatePath(`/dashboard/promos/${input.promoId}`);
  return sent;
}
