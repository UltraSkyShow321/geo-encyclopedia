import { parseItem, stmts } from '../db.js';

export function registerSearchRoute(app) {
  app.get('/api/search', (req) => {
    const authed = req.authed;
    const q = String(req.query.q ?? '').trim();
    if (!q) return { q, results: [] };

    const found = new Map();
    const tryFts = q.length >= 3;
    if (tryFts) {
      const escaped = q.replace(/"/g, '""');
      try {
        for (const row of stmts.ftsMatch.all(`"${escaped}"`)) {
          if (!found.has(row.slug)) found.set(row.slug, { score: row.score, from: 'fts' });
        }
      } catch {
        /* fall back to LIKE below */
      }
    }
    const like = `%${q}%`;
    for (const row of stmts.likeMatch.all(like, like, like)) {
      if (!found.has(row.slug)) found.set(row.slug, { score: -1000, from: 'like' });
    }

    const results = [];
    for (const [slug, info] of found) {
      const item = parseItem(stmts.itemBySlug.get(slug));
      if (!item) continue;
      if (item.status !== 'published' && !authed) continue;
      const plain = (item.body || '').replace(/[#*`>_~|-]/g, ' ').replace(/\s+/g, ' ').trim();
      results.push({
        slug: item.slug,
        type: item.type,
        title_zh: item.title_zh,
        title_en: item.title_en,
        flag_emoji: item.flag_emoji || '',
        continent: item.continent || '',
        excerpt: makeExcerpt(plain || '', q),
        score: info.score,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return { q, total: results.length, results: results.slice(0, 50) };
  });
}

function makeExcerpt(text, q, n = 90) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, n);
  const start = Math.max(0, i - Math.floor(n / 3));
  return (start > 0 ? '…' : '') + text.slice(start, start + n) + (start + n < text.length ? '…' : '');
}
