'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getRepo } from '@/lib/repo';

function validate(title: string, address: string) {
  if (title.trim().length < 2) throw new Error('Укажите название филиала');
  if (address.trim().length < 5) throw new Error('Укажите полный адрес');
}

export async function createBranchAction(input: { businessId: string; title: string; address: string; phone: string }): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  validate(input.title, input.address);
  await (await getRepo()).createBranch({ businessId: input.businessId, title: input.title.trim(), address: input.address.trim(), phone: input.phone.trim() });
  revalidatePath('/dashboard/branches');
}

export async function updateBranchAction(input: { businessId: string; branchId: string; title: string; address: string; phone: string }): Promise<void> {
  await requireBusinessAccess(input.businessId, ['owner', 'admin']);
  validate(input.title, input.address);
  const repo = await getRepo();
  if (!(await repo.listBranches(input.businessId)).some((item) => item.id === input.branchId)) throw new Error('Филиал не найден');
  await repo.updateBranch(input.branchId, { title: input.title.trim(), address: input.address.trim(), phone: input.phone.trim() });
  revalidatePath('/dashboard/branches');
}
