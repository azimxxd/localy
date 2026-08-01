'use client';

import { useState, useTransition } from 'react';
import { updateMyConsent } from '@/app/me/actions';
import type { NotificationChannel } from '@/lib/types';

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: 'telegram', label: 'Telegram' }, { id: 'email', label: 'Email' }, { id: 'sms', label: 'SMS' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'push', label: 'Localy' },
];

export default function ConsentPreferences({ businessId, initial }: { businessId: string; initial: NotificationChannel[] }) {
  const [channels, setChannels] = useState(initial); const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  return <details className="ascii-details border border-line bg-surface p-4"><summary className="text-sm font-semibold uppercase">Уведомления</summary><p className="mt-2 text-xs text-ink-soft">Вы можете отказаться от любого канала. Рассылки без согласия не отправляются.</p><div className="mt-3 flex flex-wrap gap-2">{CHANNELS.map((channel) => { const checked = channels.includes(channel.id); return <label key={channel.id} className="flex items-center gap-2 border border-line px-2 py-1.5 text-xs"><input disabled={pending} type="checkbox" checked={checked} onChange={(event) => { const enabled = event.target.checked; startTransition(async () => { try { await updateMyConsent(businessId, channel.id, enabled); setChannels((current) => enabled ? [...new Set([...current, channel.id])] : current.filter((item) => item !== channel.id)); setMessage('Настройки сохранены'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Ошибка'); } }); }} />{channel.label}</label>; })}</div>{message ? <p role="status" className="mt-2 text-xs text-brand">{message}</p> : null}</details>;
}
