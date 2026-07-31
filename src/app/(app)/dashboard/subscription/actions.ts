'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';
import type { PlanTier } from '@/lib/types';

export async function changePlanAction(input: { businessId: string; plan: PlanTier }): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner']);
  const repo = await getRepo();
  if (!(await repo.listPlans()).some((item) => item.tier === input.plan)) throw new Error('Тариф не найден');
  await repo.changeSubscription(input.businessId, input.plan);
  revalidatePath('/dashboard/subscription');
  revalidatePath('/dashboard');
}
