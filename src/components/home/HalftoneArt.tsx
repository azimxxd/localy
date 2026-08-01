'use client';

/**
 * Анимированный halftone-арт для главной страницы.
 *
 * Вызывающие: src/app/page.tsx.
 *
 * Рисуем поле точек, размер которых задаёт «горный» рельеф из трёх синусов
 * разной частоты. Рельеф медленно дышит — картинка живая, но не отвлекает.
 * К центру плотность гасится маской, иначе заголовок не читался бы поверх.
 *
 * Всё на canvas 2D, без библиотек: анимация на главной не должна тянуть в
 * бандл лишние килобайты. Точки рисуются пакетами по оттенкам — один fill()
 * на оттенок вместо тысяч, иначе кадр не укладывается в бюджет.
 */

import { useEffect, useRef } from 'react';

/** Шаг сетки, px. Мельче — красивее и дороже. */
const SPACING = 14;
const MAX_RADIUS = 3.2;
/** Дальше 2× ретина не даёт видимой разницы, но стоит кадров. */
const DPR_CAP = 2;
/** Точки мельче этого не рисуем — визуального вклада нет. */
const MIN_RADIUS = 0.28;

/** Пастельные оттенки от разреженного края к плотной массе. */
const SHADES = [
  'rgba(133,127,114,0.30)',
  'rgba(124,114,152,0.40)',
  'rgba(107,89,196,0.46)',
  'rgba(107,89,196,0.60)',
  'rgba(76,63,150,0.70)',
  'rgba(42,39,33,0.74)',
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Плотность точки в нормированных координатах (-1..1).
 * Выше гребня — пусто, ниже — тем плотнее, чем глубже.
 */
function density(nx: number, ny: number, t: number): number {
  // К краям гребень поднимается: масса обрамляет заголовок слева и справа,
  // а не лежит одной полосой по низу.
  const ridge =
    0.12 -
    Math.pow(Math.abs(nx), 1.6) * 0.44 +
    Math.sin(nx * 2.15 + t * 0.2) * 0.1 +
    Math.sin(nx * 4.7 - t * 0.13) * 0.055 +
    Math.sin(nx * 9.3 + t * 0.31) * 0.022;

  const depth = ny - ridge;
  if (depth <= 0) return 0;

  // Рябь не даёт массе выглядеть сплошной заливкой
  const ripple = Math.sin(nx * 7.5 - ny * 5.2 + t * 0.85) * 0.06;
  const v = depth * 1.75 + ripple;

  // Гасим центр — там живёт заголовок
  const ex = nx / 0.62;
  const ey = (ny + 0.02) / 0.72;
  const mask = smoothstep(0.5, 1.25, Math.hypot(ex, ey));

  return v * mask;
}

export default function HalftoneArt({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let field = new Float32Array(0);
    let raf = 0;

    /**
     * CSS-размер задают классы w-full/h-full — здесь только синхронизируем
     * растр под фактический размер. Меряем сам canvas, а не родителя:
     * измерение самокорректируется на каждом срабатывании ResizeObserver.
     */
    function resize(): boolean {
      const rect = canvas!.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      // Раскладка ещё не устоялась — ждём следующего наблюдения
      if (w < 2 || h < 2) return false;
      if (w === width && h === height) return true;

      width = w;
      height = h;

      const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / SPACING) + 1;
      rows = Math.ceil(height / SPACING) + 1;
      field = new Float32Array(cols * rows);
      return true;
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height);

      for (let j = 0; j < rows; j++) {
        const py = j * SPACING;
        const ny = (py / height) * 2 - 1;
        for (let i = 0; i < cols; i++) {
          const px = i * SPACING;
          const nx = (px / width) * 2 - 1;
          field[j * cols + i] = density(nx, ny, t);
        }
      }

      // Один проход на оттенок: тысячи arc() в одном пути, один fill()
      for (let b = 0; b < SHADES.length; b++) {
        const lo = b / SHADES.length;
        const hi = b === SHADES.length - 1 ? Infinity : (b + 1) / SHADES.length;
        ctx!.beginPath();
        let drawn = false;

        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const v = field[j * cols + i];
            if (v < lo || v >= hi) continue;
            const r = Math.min(1, v) * MAX_RADIUS;
            if (r < MIN_RADIUS) continue;
            // Нечётные ряды со сдвигом — сетка не читается как таблица
            const px = i * SPACING + (j % 2 ? SPACING / 2 : 0);
            ctx!.moveTo(px + r, j * SPACING);
            ctx!.arc(px, j * SPACING, r, 0, Math.PI * 2);
            drawn = true;
          }
        }

        if (drawn) {
          ctx!.fillStyle = SHADES[b];
          ctx!.fill();
        }
      }
    }

    const start = performance.now();
    function frame(now: number) {
      if (width >= 2) draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    }

    const ready = resize();
    if (reduceMotion) {
      if (ready) draw(0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      const ok = resize();
      if (reduceMotion && ok) draw(0);
    });
    observer.observe(canvas);

    // Вкладка не на экране — кадры не считаем
    function onVisibility() {
      if (reduceMotion) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
