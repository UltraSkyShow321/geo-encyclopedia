import { parseItem, stmts } from '../db.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOptions(pool, exclude, n) {
  const filtered = pool.filter((c) => c.slug !== exclude.slug);
  return shuffle(filtered).slice(0, n - 1);
}

export function registerQuizRoute(app) {
  app.get('/api/quiz', (req) => {
    let pool = stmts.itemsAll
      .all()
      .map(parseItem)
      .filter((it) => it.type === 'country' && (req.authed || it.status === 'published'));

    const continent = String(req.query.continent ?? '');
    if (continent && continent !== '全部') {
      pool = pool.filter((c) => c.continent === continent);
    }
    const count = Math.min(Math.max(Number(req.query.count ?? 8) || 8, 1), 30);

    const questions = [];
    const targets = shuffle(pool).slice(0, count * 3);
    for (const c of targets) {
      const type = Math.floor(Math.random() * 4);
      if (type === 0) {
        const others = pickOptions(pool, c, 4);
        const options = shuffle([c, ...others]);
        questions.push({
          type: 'capital',
          question: c.flag_emoji ? `${c.flag_emoji} ${c.name_zh}的首都是哪里？` : `${c.name_zh}（${c.name_en}）的首都是哪里？`,
          options: options.map((o) => o.capital_zh || o.capital_en || '—'),
          answerIndex: options.findIndex((o) => o.slug === c.slug),
          fact: `${c.name_zh}的首都是${c.capital_zh}（${c.capital_en}）。`,
        });
      } else if (type === 1) {
        const others = pickOptions(pool, c, 4);
        const options = shuffle([c, ...others]);
        questions.push({
          type: 'continent',
          question: `${c.name_zh}（${c.name_en}）属于哪个大洲？`,
          options: options.map((o) => o.continent || '—'),
          answerIndex: options.findIndex((o) => o.slug === c.slug),
          fact: `${c.name_zh}位于${c.continent}（${c.continent_en}）。`,
        });
      } else if (type === 2) {
        const others = pickOptions(pool, c, 4);
        const options = shuffle([c, ...others]);
        questions.push({
          type: 'area',
          question: `以下哪个国家的面积最大？`,
          options: options.map((o) => o.name_zh),
          answerIndex: options.findIndex((o) => o.slug === [...options].sort((a, b) => b.area_km2 - a.area_km2)[0].slug),
          fact: `${options.sort((a, b) => b.area_km2 - a.area_km2)[0].name_zh}的面积最大（约 ${Math.round((options.sort((a, b) => b.area_km2 - a.area_km2)[0].area_km2 || 0) / 10000).toLocaleString()} 万平方公里）。`,
        });
      } else {
        const others = pickOptions(pool, c, 4);
        const options = shuffle([c, ...others]);
        const top = [...options].sort((a, b) => b.population - a.population)[0];
        questions.push({
          type: 'population',
          question: `以下哪个国家的人口最多？`,
          options: options.map((o) => o.name_zh),
          answerIndex: options.findIndex((o) => o.slug === top.slug),
          fact: `${top.name_zh}人口最多（约 ${Math.round((top.population || 0) / 1e8 * 100) / 100} 亿）。`,
        });
      }
      if (questions.length >= count) break;
    }
    return { questions };
  });
}
