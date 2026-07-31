'use client';

/**
 * Поиск по клиентской базе.
 *
 * Вызывающие: src/app/(app)/dashboard/crm/page.tsx.
 * Пишет q в URL, сохраняя выбранный сегмент. Фильтрацию делает сервер при
 * ре-рендере — здесь только правка адреса.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TextInput } from '@/components/ui/kit';

export default function CrmSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <TextInput
      placeholder="Имя или телефон клиента"
      defaultValue={params.get('q') ?? ''}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        const value = e.target.value.trim();
        if (value) next.set('q', value);
        else next.delete('q');
        router.replace(`${pathname}?${next.toString()}`);
      }}
    />
  );
}
