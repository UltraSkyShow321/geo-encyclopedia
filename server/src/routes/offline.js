// 离线数据包: 一次性导出全部公开内容，供客户端离线使用
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseItem, stmts } from '../db.js';
import { getGeoJson } from '../geojson.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function contentDir() {
  return process.env.CONTENT_DIR || path.join(__dirname, '..', '..', '..', 'content');
}

function plain(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*`>_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export function registerOfflineRoute(app) {
  // 轻量版本号（自动更新检查用）
  app.get('/api/offline-pack/version', (req, reply) => {
    const rows = stmts.itemsAll.all();
    const latest = rows.reduce((m, r) => Math.max(m, r.updated_at), 0);
    return { version: latest, updated_at: latest, count: rows.length };
  });

  // 全量离线包
  app.get('/api/offline-pack', (req, reply) => {
    const items = stmts.itemsAll.all().map(parseItem).filter((it) => it.status === 'published');
    const now = Date.now();

    const countries = [];
    const topics = [];
    for (const it of items) {
      const entry = {
        slug: it.slug,
        name_zh: it.name_zh,
        name_en: it.name_en,
        flag_emoji: it.flag_emoji || '',
        iso_alpha2: it.iso_alpha2 || '',
        iso_numeric: String(it.iso_numeric || ''),
        continent: it.continent || '',
        continent_en: it.continent_en || '',
        capital_zh: it.capital_zh || '',
        capital_en: it.capital_en || '',
        population: it.population ?? null,
        area_km2: it.area_km2 ?? null,
        currency_zh: it.currency_zh || '',
        official_language_zh: it.official_language_zh || '',
        government_zh: it.government_zh || '',
        timezone: it.timezone || '',
        neighbors: it.neighbors || [],
        un_member: !!it.un_member,
        capital_coords: it.capital_coords || null,
        bodyHtml: it.bodyHtml || '',
        summary: plain(it.body || ''),
      };
      if (it.type === 'country') countries.push(entry);
      else {
        topics.push({
          ...entry,
          title_zh: it.title_zh,
          title_en: it.title_en,
          category: it.category || 'other',
          related_countries: it.related_countries || [],
        });
      }
    }

    // 精简版 geojson（仅已发布且有 slug 的国家，已做日期线切割）
    const fc = getGeoJson();
    const features = fc.features
      .filter((f) => f.properties.slug)
      .map((f) => ({
        id: f.properties.iso_numeric,
        properties: {
          name_zh: f.properties.name_zh,
          name_en: f.properties.name_en,
          slug: f.properties.slug,
          continent: f.properties.continent,
          iso_numeric: f.properties.iso_numeric,
          population: f.properties.population,
          area_km2: f.properties.area_km2,
        },
        geometry: f.geometry,
      }));

    let landforms = [];
    try {
      const lf = path.join(contentDir(), 'metadata', 'landforms.json');
      if (fs.existsSync(lf)) landforms = JSON.parse(fs.readFileSync(lf, 'utf8'));
    } catch {
      /* ignore */
    }

    // 国旗数据（内嵌 SVG，离线/弱网也能显示）
    const flags = {};
    try {
      const webDist = process.env.WEB_DIST || path.join(process.cwd(), 'web', 'dist');
      const flagsDir = path.join(webDist, 'flags');
      if (fs.existsSync(flagsDir)) {
        for (const f of fs.readdirSync(flagsDir)) {
          if (f.endsWith('.svg')) {
            const iso2 = f.slice(0, 2);
            flags[iso2] = fs.readFileSync(path.join(flagsDir, f), 'utf8');
          }
        }
      }
    } catch {
      /* ignore */
    }

    const payload = {
      version: now,
      generated_at: now,
      countries,
      topics,
      landforms,
      flags,
      geojson: { features },
    };
    // 大响应手动 gzip（外网下载离线包提速 3-5 倍）
    if (String(req.headers['accept-encoding'] || '').includes('gzip')) {
      return reply
        .type('application/json')
        .header('content-encoding', 'gzip')
        .header('cache-control', 'no-store')
        .send(gzipSync(Buffer.from(JSON.stringify(payload))));
    }
    return reply.type('application/json').header('cache-control', 'no-store').send(payload);
  });
}
