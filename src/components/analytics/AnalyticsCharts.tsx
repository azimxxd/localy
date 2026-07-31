'use client';

/**
 * Графики аналитики продаж.
 *
 * Вызывающие: src/app/(app)/dashboard/analytics/page.tsx.
 * Recharts требует клиента. Данные считает движок/repo на сервере — сюда
 * приходят готовые ряды, компонент только рисует.
 */

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BRAND = '#6d3fe6';

export function WeekdayChart({ data }: { data: { name: string; visits: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: '#f1ebff' }}
          contentStyle={{ borderRadius: 12, border: '1px solid #e4e8f0', fontSize: 13 }}
        />
        <Bar dataKey="visits" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
