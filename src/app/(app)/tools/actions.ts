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
  const [tool, business] = await Promise.all([repo.getTool(toolId), repo.getBusiness(businessId)]);
  if (!tool || !business) throw new Error('Инструмент или бизнес не найден');
  if (tool.forTypes.length > 0 && !tool.forTypes.includes(business.typeCode)) throw new Error('Этот инструмент не подходит категории бизнеса');
  await repo.activateTool(businessId, toolId);
  revalidatePath('/tools');
}

export async function deactivateTool(toolId: string): Promise<void> {
  const repo = await getRepo();
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  if (!(await repo.getTool(toolId))) throw new Error('Инструмент не найден');
  await repo.deactivateTool(businessId, toolId);
  revalidatePath('/tools');
}

export async function toggleFavorite(toolId: string): Promise<void> {
  const repo = await getRepo();
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  if (!(await repo.getTool(toolId))) throw new Error('Инструмент не найден');
  await repo.toggleFavorite(businessId, toolId);
  revalidatePath('/tools');
}
