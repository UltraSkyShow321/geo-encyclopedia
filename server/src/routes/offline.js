// 离线数据包: 一次性导出全部公开内容，供客户端离线使用
import fs from 'node:fs';
import path from 'node:path';
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

    return reply
      .type('application/json')
      .header('cache-control', 'no-store')
      .send({
        version: now,
        generated_at: now,
        countries,
        topics,
        landforms,
        geojson: { features },
      });
  });
}
