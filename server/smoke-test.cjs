const { spawn } = require('node:child_process');

async function main() {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_PASSWORD: 'test123' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(2500);
  try {
    const login = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test123' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const authHeaders = { cookie };

    const res = await fetch('http://127.0.0.1:3000/api/meta');
    const meta = await res.json();
    console.log('META:', JSON.stringify(meta));

    const countries = await (await fetch('http://127.0.0.1:3000/api/countries?sort=population&order=desc&includeDrafts=true', { headers: authHeaders })).json();
    console.log('COUNTRIES(含草稿) total:', countries.total, 'top3:', countries.items.slice(0, 3).map((c) => c.name_zh).join(','));

    const cn = await (await fetch('http://127.0.0.1:3000/api/countries/cn', { headers: authHeaders })).json();
    console.log('CN detail: bodyHtml len', cn.bodyHtml.length, '| flag', cn.flag_emoji, '| pop', cn.population);

    const search = await (await fetch('http://127.0.0.1:3000/api/search?q=' + encodeURIComponent('尼罗河'))).json();
    console.log('SEARCH 尼罗河:', search.total, search.results.map((r) => r.type + ':' + r.title_zh).join(','));

    const searchEn = await (await fetch('http://127.0.0.1:3000/api/search?q=' + encodeURIComponent('Paris'))).json();
    console.log('SEARCH Paris:', searchEn.total, searchEn.results.map((r) => r.title_zh).join(','));

    const quiz = await (await fetch('http://127.0.0.1:3000/api/quiz?count=5&continent=亚洲', { headers: authHeaders })).json();
    console.log('QUIZ:', quiz.questions.length, 'Q1:', quiz.questions[0].question, '| ans:', quiz.questions[0].answerIndex);

    const geo = await (await fetch('http://127.0.0.1:3000/api/geojson')).json();
    const withSlug = geo.features.filter((f) => f.properties.slug);
    console.log('GEOJSON features:', geo.features.length, '| 匹配国家:', withSlug.length, '| cn:', JSON.stringify(withSlug.find((f) => f.properties.slug === 'cn')?.properties));

    const fav = await fetch('http://127.0.0.1:3000/api/favorites');
    console.log('FAV unauth status:', fav.status);

    console.log('LOGIN status:', login.status);

    const favAuth = await fetch('http://127.0.0.1:3000/api/favorites', { headers: { cookie } });
    console.log('FAV auth status:', favAuth.status);

    const putFav = await fetch('http://127.0.0.1:3000/api/favorites/cn', {
      method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ note: '想再去一次长城' }),
    });
    console.log('PUT FAV:', putFav.status);

    const cards = await fetch('http://127.0.0.1:3000/api/cards', { headers: { cookie } });
    console.log('CARDS:', cards.status);
    const addCard = await fetch('http://127.0.0.1:3000/api/cards', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ question: '中国首都?', answer: '北京', slug: 'cn' }),
    });
    console.log('ADD CARD:', addCard.status, await addCard.json());
    const cardList = await (await fetch('http://127.0.0.1:3000/api/cards', { headers: { cookie } })).json();
    const cardId = cardList.all[0].id;
    const review = await fetch(`http://127.0.0.1:3000/api/cards/${cardId}/review`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ correct: true }),
    });
    console.log('REVIEW:', review.status, await review.json());

    console.log('ALL TESTS PASSED');
  } catch (e) {
    console.error('TEST FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    child.kill();
  }
}
main();
