'use client';

/**
 * Графики аналитики продаж.
 *
 * Вызывающие: src/app/(app)/dashboard/analytics/page.tsx.
 * Recharts требует клиента. Данные считает движок/repo на сервере — сюда
 * приходят готовые ряды, компонент только рисует.
 */

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BRAND = '#c7ff00';

export function WeekdayChart({ data }: { data: { name: string; visits: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#919a78', fontFamily: 'monospace' }} axisLine={{ stroke: '#384329' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#919a78', fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: '#1c290d' }}
          contentStyle={{ borderRadius: 0, border: '1px solid #c7ff00', background: '#11180c', color: '#e4e9d3', fontSize: 13, fontFamily: 'monospace' }}
        />
        <Bar dataKey="visits">
          {data.map((_, i) => (
            <Cell key={i} fill={BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
