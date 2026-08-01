'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/kit';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export default function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  useEffect(() => stop, []);

  async function start() {
    setError(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setError('В этом браузере нет встроенного QR-сканера. Введите код вручную.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setActive(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            onScan(codes[0].rawValue);
            stop();
            return;
          }
        } catch {
          // Кадр мог смениться во время распознавания — пробуем следующий.
        }
        frameRef.current = requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      setError('Камера недоступна. Разрешите доступ или используйте ручной поиск.');
      stop();
    }
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} playsInline muted className={active ? 'aspect-square w-full rounded-xl bg-ink object-cover' : 'hidden'} />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {active ? <Button type="button" variant="secondary" className="w-full" onClick={stop}>Закрыть камеру</Button> : <Button type="button" variant="secondary" className="w-full" onClick={() => void start()}>Сканировать камерой</Button>}
    </div>
  );
}
