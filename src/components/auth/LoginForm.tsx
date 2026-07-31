'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/app/login/actions';
import { Button, TextInput } from '@/components/ui/kit';

const DEMO_ACCOUNTS = [
  { login: 'owner@localy.kz', label: 'Владелец', hint: 'Весь кабинет бизнеса' },
  { login: 'admin@localy.kz', label: 'Администратор', hint: 'Без критичных настроек' },
  { login: 'marketing@localy.kz', label: 'Маркетолог', hint: 'Сегменты и кампании' },
  { login: 'cashier@localy.kz', label: 'Кассир', hint: 'Только касса' },
  { login: 'platform@localy.kz', label: 'Админ Localy', hint: 'Управление платформой' },
];

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  const [login, setLogin] = useState(DEMO_ACCOUNTS[0].login);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            type="button"
            key={account.login}
            onClick={() => setLogin(account.login)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              login === account.login
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-surface hover:bg-canvas'
            }`}
          >
            <span className="block text-sm font-semibold text-ink">{account.label}</span>
            <span className="block text-xs text-ink-soft">{account.hint}</span>
          </button>
        ))}
      </div>

      <form action={action} className="space-y-3">
        <TextInput
          label="Логин"
          name="login"
          type="email"
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          required
        />
        <TextInput
          label="Пароль"
          name="password"
          type="password"
          defaultValue="Localy2026"
          autoComplete="current-password"
          required
        />
        {state.error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Входим…' : 'Войти в Localy'}
        </Button>
      </form>
      <p className="text-center text-xs text-ink-soft">
        Демо-пароль для всех ролей: <strong className="text-ink">Localy2026</strong>
      </p>
    </div>
  );
}
