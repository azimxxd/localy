'use server';

/**
 * Действия настройки лояльности.
 *
 * Вызывающие: src/components/loyalty/LoyaltyForm.tsx.
 */

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/repo';
import type { LoyaltyConfig } from '@/lib/types';

export async function updateLoyalty(
  businessId: string,
  patch: Partial<LoyaltyConfig>,
): Promise<void> {
  const repo = await getRepo();
  await repo.updateLoyaltyConfig(businessId, patch);
  revalidatePath('/dashboard/loyalty');
}
