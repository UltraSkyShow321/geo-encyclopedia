// 拉取国家结构化数据，生成 content/countries/{slug}.md 骨架
// 数据源（均为本网络环境可达的公开源）:
//   1. mledoze/countries (jsdelivr CDN) — 基础字段: ISO/名称/首都/货币/语言/面积/旗帜/邻国/坐标/UN 会员
//   2. i18n-iso-countries zh.json (jsdelivr CDN) — ISO 3166 中文国名
//   3. World Bank API — 最新人口 (SP.POP.TOTL, 2023 优先, 2022 兜底)
// 用法: node tools/fetch-country-data.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const countriesDir = path.join(root, 'content', 'countries');
const force = process.argv.includes('--force');

const COUNTRIES_URL = 'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json';
const ZH_NAMES_URL = 'https://cdn.jsdelivr.net/npm/i18n-iso-countries@7/langs/zh.json';
const WB_POP_URL = (year) =>
  `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=300&date=${year}`;

const CONTINENT_ZH = {
  Asia: '亚洲',
  Africa: '非洲',
  Europe: '欧洲',
  Oceania: '大洋洲',
  Antarctic: '南极洲',
  Americas: '其他',
};

const BODY_TEMPLATE = `## 地理概况

> 待生成：位置、地形、气候、边界等要点

## 历史沿革

> 待生成：重要历史节点

## 经济

> 待生成：经济结构、支柱产业

## 文化与人口

> 待生成：民族、语言、宗教、文化特色
`;

function frontmatter(meta) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
    else if (typeof v === 'string' && /[:#\[\]'"&]/.test(v)) lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function continentOf(c) {
  if (c.region === 'Americas') {
    const sub = c.subregion || '';
    if (sub.includes('North') || sub.includes('Central') || sub.includes('Caribbean')) return '北美洲';
    if (sub.includes('South')) return '南美洲';
  }
  return CONTINENT_ZH[c.region] || '其他';
}

async function fetchWorldBankPopulation() {
  const byIso3 = new Map();
  for (const year of [2023, 2022]) {
    const res = await fetch(WB_POP_URL(year), { headers: { 'User-Agent': 'GeoEncyclopedia/0.1' } });
    if (!res.ok) continue;
    const json = await res.json();
    for (const row of json[1] || []) {
      if (row.value !== null && !byIso3.has(row.countryiso3code)) {
        byIso3.set(row.countryiso3code, Math.round(row.value));
      }
    }
    if ([...byIso3.values()].filter(Boolean).length > 100) break;
  }
  return byIso3;
}

async function main() {
  const [countriesRes, zhRes] = await Promise.all([
    fetch(COUNTRIES_URL, { headers: { 'User-Agent': 'GeoEncyclopedia/0.1' } }),
    fetch(ZH_NAMES_URL, { headers: { 'User-Agent': 'GeoEncyclopedia/0.1' } }),
  ]);
  if (!countriesRes.ok) throw new Error(`countries.json HTTP ${countriesRes.status}`);
  if (!zhRes.ok) throw new Error(`zh.json HTTP ${zhRes.status}`);
  const data = await countriesRes.json();
  const zhNames = (await zhRes.json()).countries;
  console.log(`基础数据 ${data.length} 条，中文名映射 ${Object.keys(zhNames).length} 条`);

  console.log('拉取世界银行人口数据…');
  const wbPop = await fetchWorldBankPopulation();
  console.log(`  获得人口数据 ${wbPop.size} 国`);

  const keep = data.filter(
    (c) =>
      c.cca2 &&
      (c.unMember === true || c.independent === true || c.status === 'officially-assigned') &&
      c.region !== 'Antarctic'
  );
  console.log(`过滤后保留 ${keep.length} 个（排除南极属地与非主权领地）`);

  const iso3ToSlug = new Map();
  for (const c of data) iso3ToSlug.set(c.cca3, (c.cca2 || c.cca3).toLowerCase());

  fs.mkdirSync(countriesDir, { recursive: true });
  let written = 0;
  let skipped = 0;
  const seen = new Set();
  for (const c of keep) {
    let slug = (c.cca2 || c.cca3).toLowerCase();
    if (seen.has(slug)) slug = `${slug}-${c.cca3.toLowerCase()}`;
    seen.add(slug);

    const file = path.join(countriesDir, `${slug}.md`);
    if (fs.existsSync(file) && !force) {
      skipped++;
      continue;
    }

    const nameZh = zhNames[c.cca2] || c.name?.common || slug;
    const nameEn = c.name?.common || slug;
    const currency = Object.values(c.currencies || {})[0];
    const languages = Object.values(c.languages || {}).slice(0, 4).join('、');
    const neighbors = (c.borders || []).map((b) => iso3ToSlug.get(b)).filter(Boolean);

    const meta = {
      slug,
      type: 'country',
      name_zh: nameZh,
      name_en: nameEn,
      iso_alpha2: c.cca2,
      iso_alpha3: c.cca3,
      iso_numeric: c.ccn3,
      continent: continentOf(c),
      continent_en: c.subregion || c.region || '',
      capital_zh: c.capital?.[0] || '',
      capital_en: c.capital?.[0] || '',
      population: wbPop.get(c.cca3) || undefined,
      area_km2: c.area ? Math.round(c.area) : undefined,
      currency_zh: currency ? `${currency.name}（${Object.keys(c.currencies)[0]}）` : '',
      official_language_zh: languages,
      flag_emoji: c.flag || '',
      flag_url: c.flags?.svg || '',
      coordinates: c.latlng || undefined,
      neighbors: neighbors.length ? [...new Set(neighbors)] : undefined,
      un_member: c.unMember === true,
      status: 'draft',
      ai_generated: false,
    };

    fs.writeFileSync(file, `${frontmatter(meta)}\n${BODY_TEMPLATE}`, 'utf8');
    written++;
  }
  console.log(`完成：新增 ${written} 个文件，跳过已有 ${skipped} 个文件`);
  console.log(`输出目录: ${countriesDir}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
