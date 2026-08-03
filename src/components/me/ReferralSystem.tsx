'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@/components/ui/kit';

interface ReferralBusiness {
  id: string;
  name: string;
  slug: string;
}

export default function ReferralSystem({
  referralCode,
  businesses,
}: {
  referralCode: string;
  businesses: ReferralBusiness[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function copyValue(value: string, key: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Реферальная система
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="max-h-[min(90dvh,720px)] w-full max-w-lg overflow-y-auto shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-system-title"
            aria-describedby="referral-system-description"
          >
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="ascii-kicker">Пригласите друга</p>
                  <h2 id="referral-system-title" className="mt-1 font-display text-2xl text-ink">
                    Реферальная система
                  </h2>
                </div>
                <button
                  type="button"
                  className="border border-line px-2.5 py-1 text-lg leading-none text-ink-soft hover:border-brand hover:text-brand"
                  aria-label="Закрыть окно"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>

              <p id="referral-system-description" className="mt-4 text-sm text-ink-soft">
                Поделитесь кодом или ссылкой. После первой покупки приглашённого бонусы получите оба.
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 border border-brand/40 bg-brand-soft px-3 py-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-soft">Ваш код</p>
                  <p className="tnum mt-1 text-2xl font-bold tracking-[0.14em] text-brand">{referralCode}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 px-3 py-2 text-xs"
                  onClick={() => copyValue(referralCode, 'code')}
                >
                  {copied === 'code' ? 'Скопировано' : 'Скопировать код'}
                </Button>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs uppercase tracking-wide text-ink-soft">Ссылки для друзей</p>
                {businesses.map((business) => {
                  const href = `/join/${business.slug}?ref=${encodeURIComponent(referralCode)}`;
                  const key = `link:${business.id}`;
                  return (
                    <div key={business.id} className="flex items-center gap-2 border border-line px-3 py-2">
                      <Link href={href} className="min-w-0 flex-1 truncate text-sm text-brand hover:underline">
                        «{business.name}»
                      </Link>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-ink-soft hover:text-brand"
                        onClick={() => copyValue(`${window.location.origin}${href}`, key)}
                      >
                        {copied === key ? 'Готово' : 'Копировать'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="secondary" className="mt-5 w-full" onClick={() => setOpen(false)}>
                Закрыть
              </Button>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
