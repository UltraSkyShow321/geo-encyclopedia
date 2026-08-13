import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 50m 高精度边界（与瓦片对齐度更好）
const topo = require('world-atlas/countries-50m.json');
let featureCollection = null;

export function ensureGeoJson() {
  if (featureCollection) return featureCollection;
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const cacheFile = path.join(dataDir, 'world-geojson-50m.json');
  if (fs.existsSync(cacheFile)) {
    try {
      featureCollection = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      return featureCollection;
    } catch {
      /* rebuild below */
    }
  }

  const { feature } = require('topojson-client');
  const fc = feature(topo, topo.objects.countries);
  const itemMap = new Map();
  const itemsByName = new Map();
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, '');
  for (const row of db.prepare('SELECT slug, data FROM items WHERE type = ?').all('country')) {
    try {
      const d = JSON.parse(row.data);
      if (d.iso_numeric) itemMap.set(String(d.iso_numeric), d);
      // 名称兜底映射（部分领土无 ISO 数字编码）
      if (d.name_en) itemsByName.set(norm(d.name_en), d);
      if (d.name_zh) itemsByName.set(norm(d.name_zh), d);
    } catch {
      /* ignore */
    }
  }
  // 跨日期变更线(±180°)的多边形会绕地球一圈渲染成横条，需在 180° 处切开
  function splitRingAtDateline(ring) {
    let crosses = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (Math.abs(b[0] - a[0]) > 180) { crosses = true; break; }
    }
    if (!crosses) return [ring];
    const parts = [[]];
    let cur = parts[0];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const n = ring[(i + 1) % ring.length];
      cur.push(p);
      if (Math.abs(n[0] - p[0]) > 180) {
        // 在 ±180 处插值切割点
        const crossLon = p[0] > 0 ? 180 : -180;
        const t = (crossLon - p[0]) / (n[0] - p[0]);
        const lat = p[1] + (n[1] - p[1]) * t;
        cur.push([crossLon, lat]);
        parts.push([]);
        cur = parts[parts.length - 1];
        cur.push([-crossLon, lat]);
      }
    }
    return parts
      .filter((r) => r.length >= 3)
      .map((r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]));
  }

  function splitGeometry(geom) {
    if (geom.type === 'Polygon') {
      const parts = splitRingAtDateline(geom.coordinates[0]);
      if (parts.length === 1) return geom;
      return { type: 'MultiPolygon', coordinates: parts.map((r) => [r]) };
    }
    if (geom.type === 'MultiPolygon') {
      const out = [];
      for (const poly of geom.coordinates) {
        const parts = splitRingAtDateline(poly[0]);
        for (const r of parts) out.push([r]);
      }
      if (out.length === 1) return { type: 'Polygon', coordinates: out[0] };
      return { type: 'MultiPolygon', coordinates: out };
    }
    return geom;
  }

  for (const f of fc.features) {
    f.geometry = splitGeometry(f.geometry);
  }
  for (const f of fc.features) {
    // ISO 数字码统一补零到 3 位（巴西=076，但 topojson id 是数字 76）
    const id = String(f.id ?? '').padStart(3, '0');
    let item = itemMap.get(id);
    if (!item) {
      // 名称兜底：部分国家/地区无 ISO 数字编码（如科索沃）
      const rawName = String(f.properties?.name ?? '');
      const lookup = [norm(rawName)];
      // 常用别名
      const aliases = { kosovo: 'kosovo', 'w. sahara': 'westernsahara', 'n. cyprus': 'northerncyprus' };
      if (aliases[norm(rawName)]) lookup.push(aliases[norm(rawName)]);
      for (const key of lookup) {
        if (itemsByName.has(key)) { item = itemsByName.get(key); break; }
      }
    }
    f.properties = {
      name_en: f.properties?.name ?? '',
      iso_numeric: id,
      slug: item?.slug ?? '',
      name_zh: item?.name_zh ?? '',
      continent: item?.continent ?? '',
      population: item?.population ?? null,
      area_km2: item?.area_km2 ?? null,
    };
  }
  featureCollection = fc;
  fs.writeFileSync(cacheFile, JSON.stringify(fc));
  return fc;
}

export function getGeoJson() {
  return featureCollection ?? ensureGeoJson();
}
