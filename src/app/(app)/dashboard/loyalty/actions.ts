'use server';

/**
 * Действия настройки лояльности.
 *
 * Вызывающие: src/components/loyalty/LoyaltyForm.tsx.
 */

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/repo';
import type { LoyaltyConfig } from '@/lib/types';
import { requireBusinessAccess } from '@/lib/auth';

export async function updateLoyalty(
  businessId: string,
  patch: Partial<LoyaltyConfig>,
): Promise<void> {
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  const percent = (patch.pointsPerCurrency ?? 0) * 100;
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) {
    throw new Error('Начисление должно быть от 0 до 30%');
  }
  if ((patch.maxRedemptionPercent ?? 0) < 0 || (patch.maxRedemptionPercent ?? 0) > 100) {
    throw new Error('Лимит списания должен быть от 0 до 100%');
  }
  if ((patch.rewardThreshold ?? 0) < 1 || !patch.rewardTitle?.trim()) {
    throw new Error('Укажите порог и название награды');
  }
  const repo = await getRepo();
  await repo.updateLoyaltyConfig(businessId, patch);
  revalidatePath('/dashboard/loyalty');
}
