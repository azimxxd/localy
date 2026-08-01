'use server';

/**
 * Действия каталога инструментов.
 *
 * Вызывающие: src/components/tools/ToolCard.tsx.
 * Активация и избранное привязаны к активному бизнесу из cookie.
 */

import { revalidatePath } from 'next/cache';
import { getActiveBusinessId } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import { requireBusinessAccess } from '@/lib/auth';

export async function activateTool(toolId: string): Promise<void> {
  const repo = await getRepo();
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  await repo.activateTool(businessId, toolId);
  revalidatePath('/tools');
}

export async function deactivateTool(toolId: string): Promise<void> {
  const repo = await getRepo();
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  await repo.deactivateTool(businessId, toolId);
  revalidatePath('/tools');
}

export async function toggleFavorite(toolId: string): Promise<void> {
  const repo = await getRepo();
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  await repo.toggleFavorite(businessId, toolId);
  revalidatePath('/tools');
}
