'use client';

/**
 * Динамический QR клиента.
 *
 * Вызывающие: src/app/me/page.tsx.
 * Токен обновляется раз в QR_ROTATION_SECONDS через server action — снятый
 * на видео/скрине код протухает. Отсчёт показываем под QR.
 */

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { rotateToken } from '@/app/me/actions';
import { QR_ROTATION_SECONDS } from '@/lib/types';

export default function ClientQr({
  customerId,
  initialToken,
  brandColor,
  rotatable,
}: {
  customerId: string;
  initialToken: string;
  brandColor: string;
  rotatable: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [left, setLeft] = useState(QR_ROTATION_SECONDS);

  useEffect(() => {
    if (!rotatable) return;
    const tick = setInterval(() => {
      setLeft((prev) => {
        if (prev > 1) return prev - 1;
        // срок вышел — просим сервер повернуть токен и начинаем отсчёт заново
        void rotateToken(customerId).then(setToken);
        return QR_ROTATION_SECONDS;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [customerId, rotatable]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-card bg-white p-4 shadow-sm">
        <QRCodeSVG value={token} size={220} level="M" fgColor={brandColor} />
      </div>
      <p className="text-sm text-ink-soft">{rotatable ? <>Обновится через <span className="tnum font-medium text-ink">{left}</span> с</> : 'Демо-код только для просмотра'}</p>
    </div>
  );
}
