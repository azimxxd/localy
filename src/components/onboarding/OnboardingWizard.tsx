'use client';

import { useActionState, useState } from 'react';
import { completeOnboarding } from '@/app/onboarding/actions';
import { Button, Card, TextInput } from '@/components/ui/kit';

const STEPS = ['О бизнесе', 'Как вы работаете', 'Цели'];
const GOALS = [
  ['create_site', 'Создать сайт'],
  ['new_customers', 'Привлечь новых клиентов'],
  ['return_customers', 'Вернуть старых клиентов'],
  ['increase_frequency', 'Увеличить частоту визитов'],
  ['increase_check', 'Увеличить средний чек'],
  ['launch_loyalty', 'Запустить бонусную программу'],
  ['collect_clients', 'Начать собирать клиентскую базу'],
  ['online_booking', 'Настроить онлайн-запись'],
  ['automate', 'Автоматизировать акции'],
];

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(completeOnboarding, {});

  return (
    <form action={action}>
      <div className="mb-5 flex gap-2" aria-label="Этапы регистрации">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${index <= step ? 'bg-brand' : 'bg-line'}`} />
            <p className={`mt-1 text-xs ${index === step ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      <Card className="space-y-4">
        <div className={step === 0 ? 'space-y-4' : 'hidden'}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Название бизнеса" name="name" placeholder="Например, Tañ Coffee" required />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Категория</span>
              <select name="typeCode" className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5" defaultValue="coffee">
                <option value="coffee">Кофейня или кондитерская</option>
                <option value="barber">Барбершоп</option>
                <option value="beauty">Салон красоты / специалист</option>
                <option value="flower">Цветочный магазин</option>
                <option value="retail">Небольшой магазин</option>
                <option value="repair">Сервисная точка</option>
              </select>
            </label>
            <TextInput label="Город" name="city" defaultValue="Алматы" required />
            <TextInput label="Адрес" name="address" placeholder="ул. Абая, 42" required />
            <label className="block md:col-span-2"><span className="mb-1 block text-sm font-medium text-ink">Логотип (необязательно)</span><input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="w-full border border-line bg-surface px-3 py-2 text-sm" onChange={(event) => { const file = event.target.files?.[0]; const error = file && file.size > 350_000 ? 'Файл должен быть меньше 350 КБ' : null; setLogoError(error); if (error) event.target.value = ''; }} /><span className="mt-1 block text-xs text-ink-soft">PNG, JPG, WebP или SVG до 350 КБ</span>{logoError ? <span role="alert" className="mt-1 block text-xs text-danger">{logoError}</span> : null}</label>
          </div>
        </div>

        <div className={step === 1 ? 'space-y-4' : 'hidden'}>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput label="Сотрудников" name="employeeCount" type="number" min="1" max="100" defaultValue="4" />
            <TextInput label="Филиалов" name="branchCount" type="number" min="1" max="10" defaultValue="1" />
            <TextInput label="Средний чек, ₸" name="avgCheck" type="number" min="100" defaultValue="2500" required />
          </div>
          <TextInput
            label="Товары или услуги"
            name="offerings"
            defaultValue="Капучино, Латте, Американо, Круассан, Чизкейк, Комбо-завтрак"
            hint="Перечислите через запятую — из них сразу будет создан каталог сайта."
            required
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Обычно возвращаются через, дней" name="repeatVisitDays" type="number" min="1" max="365" defaultValue="7" />
            <TextInput label="Что уже используете" name="currentTools" defaultValue="Instagram, WhatsApp" hint="Например: Instagram, Excel, 2GIS" />
          </div>
        </div>

        <div className={step === 2 ? 'space-y-4' : 'hidden'}>
          <div>
            <h2 className="font-semibold text-ink">Что важнее всего сейчас?</h2>
            <p className="text-sm text-ink-soft">Можно выбрать несколько целей.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {GOALS.map(([value, label], index) => (
              <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-canvas">
                <input type="checkbox" name="goals" value={value} defaultChecked={index < 3} className="h-4 w-4 accent-brand" />
                <span className="text-sm text-ink">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {state.error ? <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}

        <div className="flex justify-between border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || pending}>
            Назад
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}>
              Продолжить
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? 'Создаём бизнес…' : 'Создать бизнес и план'}
            </Button>
          )}
        </div>
      </Card>
    </form>
  );
}
