'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Button, Card } from '@/components/ui/kit';

const LAYOUTS = {
  counter: { label: 'На кассу', title: 'Копите бонусы с каждой покупки', hint: 'Наведите камеру и получите стартовые бонусы' },
  table: { label: 'На стол', title: 'Один QR — все ваши награды', hint: 'Вступите в клуб гостей за 20 секунд' },
  door: { label: 'На дверь', title: 'Мы в Localy', hint: 'Сканируйте: бонусы, акции и награды в одном месте' },
};

export default function BusinessQrCard({ value, businessName, color }: { value: string; businessName: string; color: string }) {
  const [layout, setLayout] = useState<keyof typeof LAYOUTS>('counter');
  const [large, setLarge] = useState(false);
  const copy = LAYOUTS[layout];

  function download() {
    const svg = document.getElementById('localy-business-qr');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${businessName.toLowerCase().replace(/\s+/g, '-')}-localy-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]).map((key) => (
          <button type="button" key={key} onClick={() => setLayout(key)} className={`rounded-xl border px-3 py-2 text-sm ${layout === key ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-soft'}`}>{LAYOUTS[key].label}</button>
        ))}
      </div>
      <Card className="mx-auto max-w-md overflow-hidden p-0 print:border-0 print:shadow-none">
        <div className="px-6 py-5 text-center text-white" style={{ background: color }}><p className="text-sm font-medium opacity-80">{businessName}</p><h2 className="mt-1 text-2xl font-bold">{copy.title}</h2></div>
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <QRCodeSVG id="localy-business-qr" value={value} size={large ? 330 : 230} level="H" fgColor="#15231f" includeMargin />
          <p className="mt-3 max-w-xs text-sm text-ink-soft">{copy.hint}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Работает на Localy</p>
        </div>
      </Card>
      <div className="flex flex-wrap justify-center gap-2 print:hidden"><Button type="button" onClick={download}>Скачать SVG</Button><Button type="button" variant="secondary" onClick={() => setLarge((value) => !value)}>{large ? 'Обычный размер' : 'Открыть крупно'}</Button><Button type="button" variant="secondary" onClick={() => window.print()}>Печать</Button></div>
      <p className="break-all text-center text-xs text-ink-soft">{value}</p>
    </div>
  );
}
