'use client';

import { useState, useTransition } from 'react';
import { inviteStaff, updateStaffAccess } from '@/app/(app)/dashboard/staff/actions';
import { Badge, Button, Card, TextInput } from '@/components/ui/kit';
import type { Branch, Staff, StaffRole } from '@/lib/types';

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Владелец', admin: 'Администратор', marketer: 'Маркетолог', manager: 'Управляющий', cashier: 'Кассир',
};

const MANAGED: StaffRole[] = ['admin', 'marketer', 'manager', 'cashier'];

export default function StaffManager({ businessId, staff, branches, viewerRole }: { businessId: string; staff: Staff[]; branches: Branch[]; viewerRole: 'owner' | 'admin' }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('Localy2026');
  const [role, setRole] = useState<StaffRole>('cashier');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');

  function run(action: () => Promise<void>, success: string) {
    setMessage(null);
    startTransition(async () => {
      try { await action(); setMessage(success); setOpen(false); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие'); }
    });
  }

  return <div className="space-y-4">
    <div className="flex justify-end"><Button onClick={() => setOpen((value) => !value)}>{open ? 'Закрыть' : 'Пригласить сотрудника'}</Button></div>
    {open ? <Card className="space-y-3">
      <h2 className="font-semibold text-ink">Новый сотрудник</h2>
      <div className="grid gap-3 md:grid-cols-2"><TextInput label="Имя" value={name} onChange={(e) => setName(e.target.value)} /><TextInput label="Рабочий email" type="email" value={login} onChange={(e) => setLogin(e.target.value)} /><TextInput label="Временный пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="text-sm"><span className="mb-1 block font-medium text-ink">Роль</span><select className="w-full border border-line px-3 py-2.5" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{MANAGED.filter((item) => viewerRole === 'owner' || item !== 'admin').map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
      <label className="text-sm"><span className="mb-1 block font-medium text-ink">Филиал</span><select className="w-full border border-line px-3 py-2.5" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}</select></label></div>
      <Button disabled={pending} onClick={() => run(() => inviteStaff({ businessId, name, login, password, role, branchId: branchId || null }), 'Сотрудник приглашён')}>Создать доступ</Button>
    </Card> : null}
    {message ? <p role="status" className="border border-line bg-canvas px-3 py-2 text-sm text-ink">{message}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2">{staff.map((person) => <StaffRow key={person.id} businessId={businessId} person={person} branches={branches} viewerRole={viewerRole} pending={pending} run={run} />)}</div>
  </div>;
}

function StaffRow({ businessId, person, branches, viewerRole, pending, run }: { businessId: string; person: Staff; branches: Branch[]; viewerRole: 'owner' | 'admin'; pending: boolean; run: (action: () => Promise<void>, success: string) => void }) {
  const [role, setRole] = useState(person.role);
  const [branchId, setBranchId] = useState(person.branchId ?? '');
  const canEdit = person.role !== 'owner' && (viewerRole === 'owner' || person.role !== 'admin');
  return <Card className="space-y-3 p-4">
    <div className="flex justify-between gap-2"><div><p className="font-medium text-ink">{person.name}</p><p className="text-xs text-ink-soft">{person.active === false ? 'Доступ отключён' : 'Доступ активен'}</p></div><Badge tone={person.active === false ? 'muted' : person.role === 'owner' ? 'brand' : 'success'}>{ROLE_LABELS[person.role]}</Badge></div>
    {canEdit ? <><select aria-label="Роль" className="w-full border border-line px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>{MANAGED.filter((item) => viewerRole === 'owner' || item !== 'admin').map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select><select aria-label="Филиал" className="w-full border border-line px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Все филиалы</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}</select><div className="flex gap-2"><Button className="flex-1" variant="secondary" disabled={pending} onClick={() => run(() => updateStaffAccess({ businessId, staffId: person.id, role, branchId: branchId || null, active: person.active === false }), person.active === false ? 'Доступ включён' : 'Доступ отключён')}>{person.active === false ? 'Включить' : 'Отключить'}</Button><Button className="flex-1" disabled={pending} onClick={() => run(() => updateStaffAccess({ businessId, staffId: person.id, role, branchId: branchId || null, active: person.active !== false }), 'Роль сохранена')}>Сохранить</Button></div></> : <p className="text-xs text-ink-soft">Защищённая учётная запись владельца</p>}
  </Card>;
}
