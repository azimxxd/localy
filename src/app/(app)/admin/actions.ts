'use server';

/**
 * Действия админ-панели платформы.
 *
 * Вызывающие: src/components/admin/AdminTools.tsx, AdminTemplates.tsx.
 * CRUD инструментов и шаблонов — требование положения. После мутации
 * ревалидируем /admin, чтобы серверный список пересобрался.
 */

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/repo';
import type { Template, Tool } from '@/lib/types';

export async function createToolAction(input: Omit<Tool, 'id'>): Promise<void> {
  const repo = await getRepo();
  await repo.createTool(input);
  revalidatePath('/admin');
}

export async function deleteToolAction(id: string): Promise<void> {
  const repo = await getRepo();
  await repo.deleteTool(id);
  revalidatePath('/admin');
}

export async function createTemplateAction(input: Omit<Template, 'id'>): Promise<void> {
  const repo = await getRepo();
  await repo.createTemplate(input);
  revalidatePath('/admin');
}

export async function deleteTemplateAction(id: string): Promise<void> {
  const repo = await getRepo();
  await repo.deleteTemplate(id);
  revalidatePath('/admin');
}
