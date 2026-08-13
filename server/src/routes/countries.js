import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, parseItem, stmts } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let capitalsCache = null;
function capitals() {
  if (capitalsCache) return capitalsCache;
  const file = path.join(process.env.CONTENT_DIR || path.join(__dirname, '..', '..', '..', 'content'), 'metadata', 'capitals.json');
  try {
    capitalsCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    capitalsCache = {};
  }
  return capitalsCache;
}

const LIST_FIELDS = [
  'slug', 'name_zh', 'name_en', 'continent', 'continent_en', 'capital_zh', 'capital_en',
  'population', 'area_km2', 'currency_zh', 'official_language_zh', 'government_zh',
  'timezone', 'flag_emoji', 'flag_url', 'iso_alpha2', 'iso_alpha3', 'iso_numeric',
  'coordinates', 'un_member', 'neighbors', 'wiki_en', 'wiki_zh',
];

function pick(item) {
  const out = { slug: item.slug, type: item.type, status: item.status };
  for (const k of LIST_FIELDS) if (item[k] !== undefined) out[k] = item[k];
  return out;
}

export function registerCountriesRoutes(app) {
  app.get('/api/countries', (req) => {
    const authed = req.authed;
    const rows = stmts.itemsAll.all().map(parseItem).filter((it) => it.type === 'country');
    const includeDrafts = authed && req.query.includeDrafts === 'true';
    let list = rows.filter((it) => includeDrafts || it.status === 'published');

    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (q) {
      list = list.filter((it) => {
        const hay = [it.name_zh, it.name_en, it.capital_zh, it.capital_en, it.continent]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const continent = String(req.query.continent ?? '');
    if (continent) list = list.filter((it) => it.continent === continent);

    const sort = String(req.query.sort ?? 'name');
    const order = String(req.query.order ?? 'asc') === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      if (sort === 'population') return (a.population ?? 0) - (b.population ?? 0) > 0 ? order : -order;
      if (sort === 'area') return (a.area_km2 ?? 0) - (b.area_km2 ?? 0) > 0 ? order : -order;
      return String(a.name_zh ?? '').localeCompare(String(b.name_zh ?? ''), 'zh') * order;
    });

    const limit = Math.min(Number(req.query.limit ?? 500) || 500, 2000);
    const offset = Number(req.query.offset ?? 0) || 0;
    const items = list.slice(offset, offset + limit).map(pick);
    return { total: list.length, items, returned: items.length };
  });

  app.get('/api/countries/:slug', (req, reply) => {
    const item = parseItem(stmts.itemBySlug.get(String(req.params.slug)));
    if (!item || item.type !== 'country') {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    if (item.status !== 'published' && !req.authed) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const fav = db.prepare('SELECT * FROM favorites WHERE slug = ?').get(item.slug);
    const coords = capitals()[item.slug];
    return {
      ...item,
      data: undefined,
      capital_coords: coords || null,
      favorites: fav ? { note: fav.note } : null,
    };
  });
}
