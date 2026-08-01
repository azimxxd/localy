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
import type { BusinessType, Plan, RecommendationRuleSetting, Template, Tool } from '@/lib/types';
import { requireSession } from '@/lib/auth';

export async function createToolAction(input: Omit<Tool, 'id'>): Promise<void> {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  await repo.createTool(input);
  revalidatePath('/admin');
}

export async function deleteToolAction(id: string): Promise<void> {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  await repo.deleteTool(id);
  revalidatePath('/admin');
}

export async function createTemplateAction(input: Omit<Template, 'id'>): Promise<void> {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  await repo.createTemplate(input);
  revalidatePath('/admin');
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  await repo.deleteTemplate(id);
  revalidatePath('/admin');
}

export async function updateTemplateAction(id: string, patch: Partial<Pick<Template, 'title' | 'body' | 'category' | 'kind' | 'businessTypes'>>): Promise<void> {
  await requireSession(['platform_admin']);
  await (await getRepo()).updateTemplate(id, patch);
  revalidatePath('/admin');
}

export async function updateToolAction(id: string, patch: Partial<Pick<Tool, 'title' | 'description' | 'category' | 'kind' | 'impact' | 'forTypes'>>): Promise<void> {
  await requireSession(['platform_admin']);
  await (await getRepo()).updateTool(id, patch);
  revalidatePath('/admin');
}

export async function toggleBusinessAction(id: string, active: boolean): Promise<void> {
  await requireSession(['platform_admin']);
  const repo = await getRepo();
  if (!(await repo.getBusiness(id))) throw new Error('Бизнес не найден');
  await repo.updateBusiness(id, { active });
  revalidatePath('/admin');
  revalidatePath(`/admin/businesses/${id}`);
}

export async function toggleUserAction(id: string, active: boolean): Promise<void> {
  const session = await requireSession(['platform_admin']);
  if (id === session.userId && !active) throw new Error('Нельзя отключить собственную учётную запись');
  await (await getRepo()).updateUser(id, { active });
  revalidatePath('/admin');
}

export async function updatePlanAction(tier: Plan['tier'], patch: { priceKzt: number; customers: number; campaignsPerMonth: number; staff: number; branches: number; activePromos: number }): Promise<void> {
  await requireSession(['platform_admin']);
  const values = Object.values(patch);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Лимиты и цена должны быть положительными числами');
  await (await getRepo()).updatePlan(tier, { priceKzt: Math.round(patch.priceKzt), limits: { customers: Math.round(patch.customers), campaignsPerMonth: Math.round(patch.campaignsPerMonth), staff: Math.round(patch.staff), branches: Math.round(patch.branches), activePromos: Math.round(patch.activePromos) } });
  revalidatePath('/admin');
  revalidatePath('/dashboard/subscription');
}

export async function resetDemoAction(): Promise<void> {
  await requireSession(['platform_admin']);
  await (await getRepo()).resetDemoData();
  revalidatePath('/', 'layout');
}

export async function updateBusinessTypeAction(id: string, patch: Pick<BusinessType, 'title' | 'icon' | 'defaultRepeatVisitDays' | 'activityThresholds'>): Promise<void> {
  await requireSession(['platform_admin']);
  if (patch.title.trim().length < 2) throw new Error('Название категории слишком короткое');
  const { declining, atRisk, lapsed } = patch.activityThresholds;
  if (!Number.isFinite(patch.defaultRepeatVisitDays) || patch.defaultRepeatVisitDays < 1 || patch.defaultRepeatVisitDays > 365) throw new Error('Цикл визита должен быть от 1 до 365 дней');
  if (!(declining >= 1 && declining < atRisk && atRisk < lapsed && lapsed <= 10)) throw new Error('Пороги должны возрастать: 1 ≤ снижение < риск < уход ≤ 10');
  await (await getRepo()).updateBusinessType(id, { title: patch.title.trim(), icon: patch.icon.trim() || 'store', defaultRepeatVisitDays: Math.round(patch.defaultRepeatVisitDays), activityThresholds: { declining, atRisk, lapsed } });
  revalidatePath('/admin');
  revalidatePath('/onboarding');
}

export async function updateRecommendationSettingAction(
  id: string,
  patch: Pick<RecommendationRuleSetting, 'actionText' | 'priority' | 'active'>,
): Promise<void> {
  await requireSession(['platform_admin']);
  const actionText = patch.actionText.trim();
  if (actionText.length < 5) throw new Error('Текст действия слишком короткий');
  if (!Number.isInteger(patch.priority) || patch.priority < 1 || patch.priority > 5) {
    throw new Error('Приоритет должен быть от 1 до 5');
  }
  await (await getRepo()).updateRecommendationSetting(id, { ...patch, actionText });
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/recommendations');
}
