'use client';

/**
 * ASCII-арт страницы: руки Адама и Творца, тянущиеся друг к другу.
 *
 * Вызывающие: src/app/page.tsx.
 *
 * Исходник — фрагмент фрески Микеланджело (public/adam-hands.jpg, Wikimedia
 * Commons, общественное достояние). Он один раз сэмплируется в сетку ячеек:
 * тон даёт заливку символа, градиент — контур, без которого фреска
 * расплывается в ровную «крупу». Дальше каждый кадр плотность превращается в
 * символ из рампы и в оттенок античной палитры — живой ASCII-шейдер без WebGL
 * и без библиотек.
 *
 * Руки разнесены к краям двумя кусками: центральные CORRIDOR ширины остаются
 * пустыми, в них читается заголовок. Движение даёт не картинка, а два
 * дешёвых поля поверх неё: медленное дыхание и световая волна, идущая от одной
 * руки к другой. Символы рисуются пакетами по оттенкам — один fillStyle на
 * пакет вместо переключения стиля на каждой ячейке.
 */

import { useEffect, useRef } from 'react';

const IMAGE_SRC = '/adam-hands.jpg';

/** Окна в исходнике: левая рука и правая, ровно по шву между пальцами. */
const SOURCE_SPLIT = [
  { sx0: 0.08, sx1: 0.48 },
  { sx0: 0.5, sx1: 0.9 },
];

/**
 * Доля ширины, отданная тексту. Руки живут только в боковых полях, в коридор
 * не заходят ни одним символом — заголовок читается по чистому фону.
 */
const CORRIDOR = 0.38;

/** Уже этого боковое поле не вмещает кисть — арт не рисуем вовсе. */
const MIN_SIDE_PX = 150;

/** Вертикальный центр полосы с руками, в долях высоты холста. */
const BAND_CENTER = 0.46;

/** Тон штукатурки в инвертированной яркости: всё светлее — фон, а не рука. */
const WALL_LEVEL = 0.26;

/** Шаг сетки, px. Мельче — детальнее и дороже: ячеек растёт квадратично. */
const CELL = 9;
const FONT_SIZE = 10;
/** Дальше 2× ретина не даёт видимой разницы, но стоит кадров. */
const DPR_CAP = 2;

/** Рампа от разреженного к плотному. Пробел не рисуем вовсе. */
const RAMP = ' .:-=+*%#@';

/**
 * Оттенки синхронно с рампой: разреженный край — охра, масса — эгейская синь,
 * самая глубь — чернильный камень. Палитра повторяет токены античной темы.
 */
const SHADES = [
  'rgba(107,97,82,0.30)',
  'rgba(169,124,44,0.36)',
  'rgba(31,90,115,0.42)',
  'rgba(31,90,115,0.56)',
  'rgba(22,68,87,0.68)',
  'rgba(43,38,32,0.76)',
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export default function AsciiHands({ className }: { className?: string }) {
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
    /** Плотность исходника в ячейке, 0..1: 0 — бумага, 1 — самая тёмная точка руки. */
    let field = new Float32Array(0);
    let image: HTMLImageElement | null = null;
    let raf = 0;

    /** Одна ячейка на пиксель — сюда drawImage масштабирует кадр перед чтением. */
    const sampler = document.createElement('canvas');
    const samplerCtx = sampler.getContext('2d', { willReadFrequently: true });

    /**
     * Растушёвывает края куска в белый.
     *
     * Без этого рез фрески даёт ровный перепад тона, детектор контура ловит
     * его как линию — и по холсту идут прямые «рамки» вокруг кусков.
     */
    function feather(dx: number, dy: number, dw: number, dh: number): void {
      const fx = dw * 0.16;
      const fy = dh * 0.16;
      /** [x, y, w, h, непрозрачность в начале градиента, в конце] */
      const ramps: [number, number, number, number, number, number][] = [
        [dx, dy, dw, fy, 1, 0],
        [dx, dy + dh - fy, dw, fy, 0, 1],
        [dx, dy, fx, dh, 1, 0],
        [dx + dw - fx, dy, fx, dh, 0, 1],
      ];

      for (let n = 0; n < ramps.length; n++) {
        const [x, y, w, h, from, to] = ramps[n];
        const vertical = n < 2;
        const grad = vertical
          ? samplerCtx!.createLinearGradient(0, y, 0, y + h)
          : samplerCtx!.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, `rgba(255,255,255,${from})`);
        grad.addColorStop(1, `rgba(255,255,255,${to})`);
        samplerCtx!.fillStyle = grad;
        samplerCtx!.fillRect(x, y, w, h);
      }
    }

    /**
     * Пересчитывает поле плотностей под текущий размер холста.
     *
     * Фреска рисуется двумя кусками: левая рука уходит к левому краю, правая —
     * к правому, между ними остаётся пустой коридор, в котором живёт заголовок.
     * Пропорции каждого куска сохраняются — руки не растягиваются.
     */
    function sample(): void {
      if (!image || !samplerCtx || cols < 1 || rows < 1) return;

      sampler.width = cols;
      sampler.height = rows;
      // Белый фон = нулевая плотность вне кусков фрески
      samplerCtx.fillStyle = '#ffffff';
      samplerCtx.fillRect(0, 0, cols, rows);

      // Боковое поле = всё, что осталось от коридора под текст. Кисть чуть
      // выходит за край холста: обрез запястья честнее, чем ужатая ладонь.
      const side = (cols * (1 - CORRIDOR)) / 2;
      const bleed = side * 0.08;

      if (side * CELL >= MIN_SIDE_PX) {
        for (let p = 0; p < SOURCE_SPLIT.length; p++) {
          const { sx0, sx1 } = SOURCE_SPLIT[p];
          const sx = sx0 * image.width;
          const sw = (sx1 - sx0) * image.width;
          const dx = p === 0 ? -bleed : cols - side;
          const dw = side + bleed;
          // Ячейки квадратные, поэтому пропорция куска считается напрямую
          const dh = (dw * image.height) / sw;
          const dy = BAND_CENTER * rows - dh / 2;
          samplerCtx.drawImage(image, sx, 0, sw, image.height, dx, dy, dw, dh);
          feather(dx, dy, dw, dh);
        }
      }

      const data = samplerCtx.getImageData(0, 0, cols, rows).data;
      const dark = new Float32Array(cols * rows);

      for (let i = 0; i < cols * rows; i++) {
        const lum =
          (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
        dark[i] = 1 - lum;
      }

      field = new Float32Array(cols * rows);

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          // Штукатурка и кожа различаются слабо — тон берём узким окном
          const shade = smoothstep(WALL_LEVEL, WALL_LEVEL + 0.34, dark[k]);

          // Контур: без него фреска расплывается в ровную «крупу», а с ним
          // читаются пальцы, костяшки и линия предплечья.
          let edge = 0;
          if (i > 0 && i < cols - 1 && j > 0 && j < rows - 1) {
            const gx = dark[k + 1] - dark[k - 1];
            const gy = dark[k + cols] - dark[k - cols];
            edge = smoothstep(0.04, 0.26, Math.hypot(gx, gy));
          }

          field[k] = Math.min(1, shade * 0.9 + edge * 0.6);
        }
      }
    }

    /**
     * CSS-размер задают классы w-full/h-full — здесь только синхронизируем
     * растр под фактический размер. Меряем сам canvas: измерение
     * самокорректируется на каждом срабатывании ResizeObserver.
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

      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      sample();
      return true;
    }

    function draw(t: number): void {
      ctx!.clearRect(0, 0, width, height);
      if (field.length === 0) return;

      // Canvas не понимает CSS-переменные — стек шрифтов дублирует --font-sans
      ctx!.font = `${FONT_SIZE}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';

      // Волна света идёт от кисти к кисти и возвращается
      const sweep = Math.sin(t * 0.42) * 0.55;

      const buckets: number[][] = SHADES.map(() => []);

      for (let j = 0; j < rows; j++) {
        const ny = ((j * CELL) / height) * 2 - 1;
        for (let i = 0; i < cols; i++) {
          const base = field[j * cols + i];
          if (base <= 0.02) continue;

          const nx = ((i * CELL) / width) * 2 - 1;

          // Дыхание: плотность едва колышется, символы пересобираются
          const breath = reduceMotion
            ? 0
            : Math.sin(nx * 5.4 - ny * 3.1 + t * 0.55) * 0.035 * base;
          // Гребень света: узкая полоса подсветки, скользящая по горизонтали
          const glow = reduceMotion ? 0 : Math.exp(-Math.pow((nx - sweep) * 2.6, 2)) * 0.16 * base;

          const v = base + breath + glow;
          if (v <= 0.04) continue;

          const ramp = Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)));
          const shade = Math.min(SHADES.length - 1, Math.floor(v * SHADES.length));
          // Нечётные ряды со сдвигом — сетка не читается как таблица
          const px = i * CELL + (j % 2 ? CELL / 2 : 0);
          buckets[shade].push(ramp, px, j * CELL);
        }
      }

      for (let b = 0; b < buckets.length; b++) {
        const cells = buckets[b];
        if (cells.length === 0) continue;
        ctx!.fillStyle = SHADES[b];
        for (let k = 0; k < cells.length; k += 3) {
          ctx!.fillText(RAMP[cells[k]], cells[k + 1], cells[k + 2]);
        }
      }
    }

    const start = performance.now();
    function frame(now: number): void {
      if (width >= 2) draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      const ok = resize();
      if (reduceMotion && ok) draw(0);
    });

    const img = new Image();
    img.decoding = 'async';
    img.src = IMAGE_SRC;
    img.onload = () => {
      image = img;
      // Размер холста мог устояться раньше загрузки — тогда поле ещё пустое
      sample();
      const ready = resize();
      // Первый кадр рисуем сразу: во вкладке вне экрана rAF не срабатывает,
      // и без этого арт остался бы пустым до возвращения на вкладку.
      if (ready) draw(0);
      // Проявление — на CSS: рисовать фазу появления покадрово незачем
      canvas!.style.opacity = '1';
      if (!reduceMotion && !raf) raf = requestAnimationFrame(frame);
    };

    observer.observe(canvas);

    // Вкладка не на экране — кадры не считаем
    function onVisibility(): void {
      if (reduceMotion) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && image) {
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      img.onload = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ opacity: 0, transition: 'opacity 900ms ease-out' }}
      aria-hidden
    />
  );
}
