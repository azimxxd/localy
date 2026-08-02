'use server';

import { revalidatePath } from 'next/cache';
import { requireBusinessAccess } from '@/lib/auth';
import { getActiveBusinessId } from '@/lib/demo';
import { getRepo } from '@/lib/repo';
import type { Deposit } from '@/lib/types';

export async function createDepositAction(input: { customerId: string; kind: Deposit['kind']; title: string; balance: number }) {
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  const repo = await getRepo();
  if (!(await repo.getCustomerProfile(businessId, input.customerId))) throw new Error('Клиент не принадлежит этому бизнесу');
  const title = input.title.trim();
  if (title.length < 3 || title.length > 80) throw new Error('Название: от 3 до 80 символов');
  if (!Number.isFinite(input.balance) || input.balance < 500 || input.balance > 5_000_000) throw new Error('Сумма должна быть от 500 до 5 000 000 ₸');
  await repo.createDeposit({ businessId, customerId: input.customerId, kind: input.kind, title, balance: input.balance, initialBalance: input.balance, issuedAt: new Date().toISOString() });
  revalidatePath('/tools/tool_deposits');
}

export async function redeemDepositAction(id: string, amount: number) {
  const businessId = await getActiveBusinessId();
  await requireBusinessAccess(businessId, ['owner', 'admin']);
  const repo = await getRepo();
  const deposit = (await repo.listDeposits(businessId)).find((item) => item.id === id);
  if (!deposit) throw new Error('Сертификат не принадлежит этому бизнесу');
  if (!Number.isFinite(amount) || amount <= 0 || amount > deposit.balance) throw new Error('Сумма списания больше доступного остатка');
  await repo.adjustDeposit(id, -amount);
  revalidatePath('/tools/tool_deposits');
}
