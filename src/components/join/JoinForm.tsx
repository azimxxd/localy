'use client';

import { useActionState } from 'react';
import { registerAndJoin } from '@/app/join/[slug]/actions';
import { Button, TextInput } from '@/components/ui/kit';

export default function JoinForm({ slug }: { slug: string }) {
  const action = registerAndJoin.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.values;
  return (
    <form action={formAction} className="space-y-3">
      {state.verificationRequired && values ? (
        <>
          <input type="hidden" name="name" value={values.name} />
          <input type="hidden" name="phone" value={values.phone} />
          <input type="hidden" name="birthday" value={values.birthday} />
          {values.consent ? <input type="hidden" name="consent" value="on" /> : null}
          <p className="border border-line bg-canvas p-3 text-sm text-ink-soft">
            Код отправлен на {values.phone}. Он действует 5 минут.
          </p>
          {state.devCode ? <p data-dev-code={state.devCode} className="border border-warn bg-warn-soft p-3 text-sm text-ink">Локальный код: <strong className="tnum">{state.devCode}</strong></p> : null}
          <TextInput label="Код из SMS" name="verificationCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        </>
      ) : (
        <>
          <TextInput label="Ваше имя" name="name" autoComplete="name" placeholder="Арман" defaultValue={values?.name} required />
          <TextInput label="Телефон" name="phone" type="tel" autoComplete="tel" placeholder="+7 777 123 45 67" defaultValue={values?.phone} required />
          <TextInput label="Дата рождения (необязательно)" name="birthday" type="date" defaultValue={values?.birthday} />
          <label className="flex items-start gap-2 bg-canvas p-3 text-sm text-ink-soft">
            <input name="consent" type="checkbox" defaultChecked={values?.consent ?? true} className="mt-0.5 accent-brand" />
            <span>Получать редкие сообщения о наградах и акциях. Отказаться можно в любой момент.</span>
          </label>
        </>
      )}
      {state.error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Проверяем…' : state.verificationRequired ? 'Подтвердить номер' : 'Получить код'}</Button>
    </form>
  );
}
