import { db, parseItem, stmts } from '../db.js';
import { requireAuth } from '../auth.js';

export function registerMetaRoute(app) {
  app.get('/api/meta', () => {
    const rows = stmts.itemsAll.all().map(parseItem);
    const countries = rows.filter((it) => it.type === 'country' && it.status === 'published');
    const topics = rows.filter((it) => it.type === 'topic' && it.status === 'published');
    const drafts = rows.filter((it) => it.status === 'draft').length;

    const continents = new Map();
    for (const c of countries) {
      const name = c.continent || '其他';
      const rec = continents.get(name) || { name, count: 0, population: 0 };
      rec.count += 1;
      rec.population += c.population || 0;
      continents.set(name, rec);
    }

    const topicCategories = new Map();
    for (const t of topics) {
      const cat = t.category || 'other';
      topicCategories.set(cat, (topicCategories.get(cat) || 0) + 1);
    }

    return {
      totalCountries: countries.length,
      totalTopics: topics.length,
      totalDrafts: drafts,
      totalPopulation: countries.reduce((s, c) => s + (c.population || 0), 0),
      totalArea: countries.reduce((s, c) => s + (c.area_km2 || 0), 0),
      continents: [...continents.values()].sort((a, b) => b.count - a.count),
      topicCategories: [...topicCategories.entries()].map(([category, count]) => ({ category, count })),
    };
  });
}

export function registerFavoritesRoutes(app) {
  app.get('/api/favorites', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = db
      .prepare(
        `SELECT f.*, i.title_zh, i.title_en, i.data
         FROM favorites f LEFT JOIN items i ON i.slug = f.slug
         ORDER BY f.updated_at DESC`
      )
      .all();
    return rows.map((r) => {
      let meta = {};
      try {
        meta = r.data ? JSON.parse(r.data) : {};
      } catch {
        /* ignore */
      }
      return {
        slug: r.slug,
        note: r.note,
        created_at: r.created_at,
        updated_at: r.updated_at,
        title_zh: r.title_zh || r.slug,
        title_en: r.title_en || '',
        flag_emoji: meta.flag_emoji || '',
        type: meta.type || 'country',
      };
    });
  });

  app.put('/api/favorites/:slug', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const slug = String(req.params.slug);
    const item = stmts.itemBySlug.get(slug);
    if (!item) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const note = String(req.body?.note ?? '').slice(0, 20000);
    const now = Date.now();
    stmts.insertFavorite.run(slug, note, now, now);
    return { ok: true, slug, note };
  });

  app.delete('/api/favorites/:slug', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    stmts.deleteFavorite.run(String(req.params.slug));
    return { ok: true };
  });
}
