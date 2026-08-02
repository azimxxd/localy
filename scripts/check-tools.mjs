import { existsSync, readFileSync } from 'node:fs';

const seed = readFileSync('src/lib/mock/seed.ts', 'utf8');
const runtime = readFileSync('src/lib/tool-runtime.ts', 'utf8');
const toolSeedBlock = seed.slice(seed.indexOf('const TOOL_SEEDS'), seed.indexOf('export const TOOLS'));
const seedIds = [...toolSeedBlock.matchAll(/\['(tool_[a-z_]+)'\s*,/g)].map((match) => match[1]);
const runtimeEntries = [...runtime.matchAll(/^\s+(tool_[a-z_]+): \{ href: '([^']+)'/gm)].map((match) => ({ id: match[1], href: match[2] }));
const runtimeIds = runtimeEntries.map((entry) => entry.id);
const missing = seedIds.filter((id) => !runtimeIds.includes(id));
const extra = runtimeIds.filter((id) => !seedIds.includes(id));
if (missing.length || extra.length || new Set(seedIds).size !== seedIds.length) throw new Error(`Некорректная карта инструментов: missing=${missing.join(',')} extra=${extra.join(',')}`);

for (const { id, href } of runtimeEntries) {
  const path = href.split('?')[0];
  const candidates = [
    `src/app${path}/page.tsx`,
    `src/app/(app)${path}/page.tsx`,
    path.startsWith('/tools/tool_') ? 'src/app/(app)/tools/[id]/page.tsx' : '',
  ].filter(Boolean);
  if (!candidates.some(existsSync)) throw new Error(`${id}: маршрут ${path} не существует`);
}

console.log(`Tool catalog OK: ${seedIds.length}/${seedIds.length} инструментов имеют рабочий маршрут`);
