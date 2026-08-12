import { db, stmts } from '../db.js';
import { requireAuth } from '../auth.js';

const DAY = 86400 * 1000;
const INTERVALS = [0, 1, 3, 7, 15, 30];

export function registerCardsRoutes(app) {
  app.get('/api/cards', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = stmts.cardsAll.all();
    const now = Date.now();
    return {
      due: rows.filter((c) => c.next_review <= now),
      all: rows,
      dueCount: rows.filter((c) => c.next_review <= now).length,
    };
  });

  app.post('/api/cards', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const question = String(req.body?.question ?? '').trim();
    const answer = String(req.body?.answer ?? '').trim();
    if (!question || !answer) {
      reply.code(400).send({ error: 'question and answer required' });
      return;
    }
    const slug = String(req.body?.slug ?? '');
    if (slug && !stmts.itemBySlug.get(slug)) {
      reply.code(404).send({ error: 'item not found' });
      return;
    }
    const info = stmts.insertCard.run(
      slug || null,
      question.slice(0, 500),
      answer.slice(0, 2000),
      Date.now(),
      0,
      0,
      Date.now()
    );
    return { ok: true, id: Number(info.lastInsertRowid) };
  });

  app.post('/api/cards/:id/review', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number(req.params.id);
    const card = stmts.cardById.get(id);
    if (!card) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const correct = req.body?.correct === true;
    const dayIndex = Math.max(0, INTERVALS.indexOf(card.interval_days));
    const next = correct ? Math.min(dayIndex + 1, INTERVALS.length - 1) : 0;
    stmts.updateCard.run(Date.now() + INTERVALS[next] * DAY, INTERVALS[next], correct ? card.streak + 1 : 0, id);
    return { ok: true, next_review: Date.now() + INTERVALS[next] * DAY, interval_days: INTERVALS[next] };
  });

  app.delete('/api/cards/:id', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    stmts.deleteCard.run(Number(req.params.id));
    return { ok: true };
  });

  app.delete('/api/cards', (req, reply) => {
    if (!requireAuth(req, reply)) return;
    db.prepare('DELETE FROM cards').run();
    return { ok: true };
  });
}
