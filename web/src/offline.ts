// 离线数据包层：IndexedDB 存储 + 自动更新 + 离线查询接口
import { apiBase } from './api';

export interface OfflineCountry {
  slug: string; name_zh: string; name_en: string; flag_emoji: string;
  iso_alpha2: string; iso_numeric: string; continent: string; continent_en: string;
  capital_zh: string; capital_en: string; population: number | null; area_km2: number | null;
  currency_zh: string; official_language_zh: string; government_zh: string; timezone: string;
  neighbors: string[]; un_member: boolean; capital_coords: [number, number] | null;
  bodyHtml: string; summary: string;
}
export interface OfflineTopic {
  slug: string; title_zh: string; title_en: string; category: string;
  bodyHtml: string; summary: string; related_countries: string[];
}
export interface OfflinePack {
  version: number; generated_at: number;
  countries: OfflineCountry[];
  topics: OfflineTopic[];
  landforms: any[];
  flags: Record<string, string>;
  geojson: { features: any[] };
}

const DB_NAME = 'geo-offline';
const STORE = 'pack';
const KEY = 'current';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;
let cache: OfflinePack | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<any> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(key: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 获取离线包（内存 → IndexedDB） */
export async function getOfflinePack(): Promise<OfflinePack | null> {
  if (cache) return cache;
  try {
    cache = await idbGet(KEY);
    return cache || null;
  } catch {
    return null;
  }
}

export async function getOfflineMeta(): Promise<{ version: number; updated_at: number } | null> {
  try {
    return (await idbGet(META)) || null;
  } catch {
    return null;
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** 下载并保存离线包（首次/更新） */
export async function downloadOfflinePack(): Promise<{ ok: boolean; pack?: OfflinePack }> {
  const res = await fetch(apiBase() + '/api/offline-pack');
  if (!res.ok) throw new Error(`离线包下载失败 HTTP ${res.status}`);
  const pack = (await res.json()) as OfflinePack;
  await idbPut(KEY, pack);
  await idbPut(META, { version: pack.version, updated_at: Date.now() });
  cache = pack;
  return { ok: true, pack };
}

/** 自动检查并更新（联网时调用；版本不同则静默下载）。失败自动重试 */
export async function checkOfflineUpdate(attempt = 0): Promise<boolean> {
  if (!isOnline()) return false;
  try {
    const res = await fetch(apiBase() + '/api/offline-pack/version', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return false;
    const v = await res.json();
    const meta = await getOfflineMeta();
    if (meta && meta.version >= v.version) return false;
    await downloadOfflinePack();
    return true;
  } catch {
    // 网络抖动重试一次
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 5000));
      return checkOfflineUpdate(attempt + 1);
    }
    return false;
  }
}

/** 离线数据查询 */
export const offline = {
  async countries(): Promise<OfflineCountry[]> {
    return (await getOfflinePack())?.countries || [];
  },
  async country(slug: string): Promise<OfflineCountry | null> {
    return (await getOfflinePack())?.countries.find((c) => c.slug === slug) || null;
  },
  async topics(): Promise<OfflineTopic[]> {
    return (await getOfflinePack())?.topics || [];
  },
  async topic(slug: string): Promise<OfflineTopic | null> {
    return (await getOfflinePack())?.topics.find((t) => t.slug === slug) || null;
  },
  async landforms(): Promise<any[]> {
    return (await getOfflinePack())?.landforms || [];
  },
  async geojson(): Promise<any | null> {
    return (await getOfflinePack())?.geojson || null;
  },
  async search(q: string): Promise<{ slug: string; type: string; title_zh: string; title_en: string; flag_emoji: string; excerpt: string }[]> {
    const pack = await getOfflinePack();
    if (!pack) return [];
    const key = q.toLowerCase();
    const out: any[] = [];
    for (const c of pack.countries) {
      if (c.name_zh.toLowerCase().includes(key) || c.name_en.toLowerCase().includes(key) || c.summary.toLowerCase().includes(key)) {
        out.push({ slug: c.slug, type: 'country', title_zh: c.name_zh, title_en: c.name_en, flag_emoji: c.flag_emoji || '', excerpt: excerptOf(c.summary, q) });
      }
    }
    for (const t of pack.topics) {
      if (t.title_zh.toLowerCase().includes(key) || t.title_en.toLowerCase().includes(key) || t.summary.toLowerCase().includes(key)) {
        out.push({ slug: t.slug, type: 'topic', title_zh: t.title_zh, title_en: t.title_en, flag_emoji: '', excerpt: excerptOf(t.summary, q) });
      }
    }
    return out.slice(0, 50);
  },
  async quiz(continent: string, count: number): Promise<any[]> {
    let pool = (await getOfflinePack())?.countries || [];
    if (continent && continent !== '全部') pool = pool.filter((c) => c.continent === continent);
    if (!pool.length) return [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const questions: any[] = [];
    for (const c of shuffled.slice(0, count * 3)) {
      const type = Math.floor(Math.random() * 4);
      const others = shuffled.filter((o) => o.slug !== c.slug).slice(0, 3);
      const options = [...others, c].sort(() => Math.random() - 0.5);
      if (type === 0) {
        questions.push({
          type: 'capital',
          question: `${c.name_zh}的首都是哪里？`,
          options: options.map((o) => o.capital_zh || o.capital_en || '—'),
          answerIndex: options.findIndex((o) => o.slug === c.slug),
          fact: `${c.name_zh}的首都是${c.capital_zh}（${c.capital_en}）。`,
        });
      } else if (type === 1) {
        questions.push({
          type: 'continent',
          question: `${c.name_zh}（${c.name_en}）属于哪个大洲？`,
          options: options.map((o) => o.continent || '—'),
          answerIndex: options.findIndex((o) => o.slug === c.slug),
          fact: `${c.name_zh}位于${c.continent}。`,
        });
      } else if (type === 2) {
        const top = [...options].sort((a, b) => (b.area_km2 || 0) - (a.area_km2 || 0))[0];
        questions.push({
          type: 'area',
          question: '以下哪个国家的面积最大？',
          options: options.map((o) => o.name_zh),
          answerIndex: options.findIndex((o) => o.slug === top.slug),
          fact: `${top.name_zh}面积最大。`,
        });
      } else {
        const top = [...options].sort((a, b) => (b.population || 0) - (a.population || 0))[0];
        questions.push({
          type: 'population',
          question: '以下哪个国家的人口最多？',
          options: options.map((o) => o.name_zh),
          answerIndex: options.findIndex((o) => o.slug === top.slug),
          fact: `${top.name_zh}人口最多。`,
        });
      }
      if (questions.length >= count) break;
    }
    return questions;
  },
};

function excerptOf(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 60);
  const s = Math.max(0, i - 20);
  return (s > 0 ? '…' : '') + text.slice(s, s + 80) + '…';
}

/** 从 geojson 特征生成国家轮廓 SVG（离线用，等比投影 + 日期线安全） */
export function countryOutlineSvg(feature: any): string {
  const rings: number[][][] = [];
  const geom = feature.geometry;
  if (geom.type === 'Polygon') rings.push(geom.coordinates[0]);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p: any) => rings.push(p[0]));
  const shifted = rings.map((r) => r.map(([lon, lat]: number[]) => [lon < 0 ? lon + 360 : lon, lat]));
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const r of shifted) for (const [x, y] of r) {
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  if (!isFinite(xmax - xmin) || xmax <= xmin || ymax <= ymin) return '';
  const W = 600, rawH = 300;
  const k = Math.min(W / (xmax - xmin), rawH / (ymax - ymin));
  const H = Math.max(rawH, Math.ceil((ymax - ymin) * k) + 4);
  const ox = (W - (xmax - xmin) * k) / 2;
  const oy = (H - (ymax - ymin) * k) / 2;
  const px = (x: number) => (ox + (x - xmin) * k).toFixed(1);
  const py = (y: number) => (H - oy - (y - ymin) * k).toFixed(1);
  const paths = shifted.map((r) => {
    let d = '';
    for (const [i, p] of r.entries()) d += (i === 0 ? 'M' : 'L') + px(p[0]) + ' ' + py(p[1]) + ' ';
    return d + 'Z';
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${paths.join(' ')}" fill="#6366f1" fill-opacity="0.85" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}
