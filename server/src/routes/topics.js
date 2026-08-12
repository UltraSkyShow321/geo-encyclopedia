import { parseItem, stmts } from '../db.js';

export function registerTopicsRoutes(app) {
  app.get('/api/topics', (req) => {
    const authed = req.authed;
    const rows = stmts.itemsAll.all()
      .map(parseItem)
      .filter((it) => it.type === 'topic' && (authed || it.status === 'published'));
    const categories = {};
    for (const it of rows) {
      const cat = it.category || 'other';
      (categories[cat] ||= []).push({
        slug: it.slug,
        title_zh: it.title_zh,
        title_en: it.title_en,
        category: cat,
        summary: plainSummary(it.body || ''),
        related_countries: it.related_countries || [],
        status: it.status,
      });
    }
    return {
      categories: Object.entries(categories).map(([category, items]) => ({ category, items })),
      total: rows.length,
    };
  });

  app.get('/api/topics/:slug', (req, reply) => {
    const item = parseItem(stmts.itemBySlug.get(String(req.params.slug)));
    if (!item || item.type !== 'topic') {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    if (item.status !== 'published' && !req.authed) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const countries = (item.related_countries || [])
      .map((s) => parseItem(stmts.itemBySlug.get(s)))
      .filter((c) => c && (req.authed || c.status === 'published'))
      .map((c) => ({
        slug: c.slug,
        name_zh: c.name_zh,
        name_en: c.name_en,
        flag_emoji: c.flag_emoji,
      }));
    const relatedTopics = (item.related_topics || [])
      .map((s) => parseItem(stmts.itemBySlug.get(s)))
      .filter((t) => t && (req.authed || t.status === 'published'))
      .map((t) => ({ slug: t.slug, title_zh: t.title_zh, title_en: t.title_en }));
    return { ...item, data: undefined, countries, relatedTopics };
  });
}

function plainSummary(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*`>_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
