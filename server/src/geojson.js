import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const topo = require('world-atlas/countries-110m.json');
let featureCollection = null;

export function ensureGeoJson() {
  if (featureCollection) return featureCollection;
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const cacheFile = path.join(dataDir, 'world-geojson.json');
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
  for (const row of db.prepare('SELECT slug, data FROM items WHERE type = ?').all('country')) {
    try {
      const d = JSON.parse(row.data);
      if (d.iso_numeric) itemMap.set(String(d.iso_numeric), d);
    } catch {
      /* ignore */
    }
  }
  for (const f of fc.features) {
    const id = String(f.id ?? '');
    const item = itemMap.get(id);
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
