'use client';

import { useActionState } from 'react';
import { registerAndJoin } from '@/app/join/[slug]/actions';
import { Button, TextInput } from '@/components/ui/kit';

export default function JoinForm({ slug }: { slug: string }) {
  const action = registerAndJoin.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <TextInput label="Ваше имя" name="name" autoComplete="name" placeholder="Арман" required />
      <TextInput label="Телефон" name="phone" type="tel" autoComplete="tel" placeholder="+7 777 123 45 67" required />
      <TextInput label="Дата рождения (необязательно)" name="birthday" type="date" />
      <label className="flex items-start gap-2 rounded-xl bg-canvas p-3 text-sm text-ink-soft">
        <input name="consent" type="checkbox" defaultChecked className="mt-0.5 accent-brand" />
        <span>Получать редкие сообщения о наградах и акциях. Отказаться можно в любой момент.</span>
      </label>
      {state.error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Создаём карту…' : 'Получить универсальный QR'}</Button>
    </form>
  );
}
