// 下载全部国家国旗到 web/public/flags/{iso2}.png（flagcdn，自托管避免外链失效）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const countriesDir = path.join(here, '..', 'content', 'countries');
const outDir = path.join(here, '..', 'web', 'public', 'flags');
fs.mkdirSync(outDir, { recursive: true });

const slugs = [];
for (const f of fs.readdirSync(countriesDir)) {
  if (!f.endsWith('.md')) continue;
  const raw = fs.readFileSync(path.join(countriesDir, f), 'utf8');
  const iso2 = raw.match(/iso_alpha2: (\w+)/)?.[1];
  const slug = raw.match(/^slug: (\w+)/m)?.[1];
  if (iso2 && slug) slugs.push({ slug, iso2 });
}
console.log(`共 ${slugs.length} 面国旗待下载`);

let ok = 0, skip = 0, fail = 0;
async function download({ slug, iso2 }) {
  const dest = path.join(outDir, `${iso2.toLowerCase()}.svg`);
  if (fs.existsSync(dest)) { skip++; return; }
  try {
    const r = await fetch(`https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/${iso2.toLowerCase()}.svg`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(String(r.status));
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    ok++;
  } catch {
    fail++;
    console.error(`  失败 ${slug} (${iso2})`);
  }
}
const BATCH = 12;
for (let i = 0; i < slugs.length; i += BATCH) {
  await Promise.all(slugs.slice(i, i + BATCH).map(download));
  process.stdout.write(`\r  ${Math.min(i + BATCH, slugs.length)}/${slugs.length} (成功 ${ok} 跳过 ${skip} 失败 ${fail})`);
}
console.log('');
console.log(`完成: 新增 ${ok}，已有 ${skip}，失败 ${fail}`);
