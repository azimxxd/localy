/**
 * Localy — презентационные примитивы.
 *
 * Вызывающие: все экраны в src/app и модульные компоненты.
 * Здесь нет состояния и hooks — файл безопасно импортировать и в серверные,
 * и в клиентские компоненты. Интерактив живёт в компонентах экранов.
 */

import { cn } from '@/lib/cn';

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'muted';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink',
  success: 'bg-ok-soft text-ok',
  warning: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  muted: 'bg-canvas text-ink-soft',
};

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tnum">{value}</p>
      {sub ? <p className="mt-1 text-xs text-ink-soft">{sub}</p> : null}
    </Card>
  );
}

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-ink',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-ink-soft hover:bg-canvas',
  danger: 'bg-danger text-white hover:brightness-95',
};

/** Классы кнопки — для случаев, когда нужен <a>/<Link> вместо <button>. */
export function btnClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(BTN_BASE, BTN_VARIANT[variant], className);
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: { variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={btnClass(variant, className)} {...props} />;
}

export function TextInput({
  label,
  hint,
  className,
  ...props
}: { label?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-medium text-ink">{label}</span> : null}
      <input
        className={cn(
          'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none',
          'placeholder:text-ink-soft focus:border-brand focus:ring-2 focus:ring-brand-soft',
          className,
        )}
        {...props}
      />
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden
    />
  );
}
