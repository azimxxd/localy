const SURFACE_RGB = [250, 246, 236] as const;

function rgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '1f5a73';
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)) as [number, number, number];
}

function luminance([red, green, blue]: readonly number[]): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(first: readonly number[], second: readonly number[]): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Сохраняет оттенок, но затемняет его для читаемого текста на светлом фоне. */
export function accessibleBrandColor(selected: string): string {
  const selectedRgb = rgb(selected);
  if (contrast(selectedRgb, SURFACE_RGB) >= 4.5) return selected;
  for (let darkness = 0.08; darkness <= 0.8; darkness += 0.04) {
    const candidate = selectedRgb.map((channel) => Math.round(channel * (1 - darkness))) as [number, number, number];
    if (contrast(candidate, SURFACE_RGB) >= 4.5) return `#${candidate.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#2b2620';
}

export function brandOnDarkColor(selected: string): string {
  const selectedRgb = rgb(selected);
  const dark = [8, 12, 5] as const;
  if (contrast(selectedRgb, dark) >= 4.5) return selected;
  for (let lightness = 0.08; lightness <= 0.88; lightness += 0.04) {
    const candidate = selectedRgb.map((channel) => Math.round(channel + (255 - channel) * lightness)) as [number, number, number];
    if (contrast(candidate, dark) >= 4.5) return `#${candidate.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#faf6ec';
}

export function contrastTextColor(background: string): '#080c05' | '#faf6ec' {
  return luminance(rgb(background)) > 0.42 ? '#080c05' : '#faf6ec';
}
