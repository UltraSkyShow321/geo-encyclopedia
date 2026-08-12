const { spawn } = require('node:child_process');

async function main() {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_PASSWORD: 'test123' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((r) => setTimeout(r, 2500));
  try {
    const home = await fetch('http://127.0.0.1:3000/');
    const html = await home.text();
    console.log('GET / status:', home.status, '| has #app:', html.includes('id="app"'), '| has manifest:', html.includes('manifest'));

    const deep = await fetch('http://127.0.0.1:3000/countries/cn');
    console.log('SPA fallback /countries/cn:', deep.status, '| serves index:', (await deep.text()).includes('<div id="app">'));

    const sw = await fetch('http://127.0.0.1:3000/sw.js');
    console.log('SW:', sw.status, sw.headers.get('content-type'));

    const manifest = await fetch('http://127.0.0.1:3000/manifest.webmanifest');
    console.log('MANIFEST:', manifest.status);

    const api404 = await fetch('http://127.0.0.1:3000/api/nope');
    console.log('API 404 JSON:', api404.status, await api404.json());

    console.log('STATIC TESTS PASSED');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    child.kill();
  }
}
main();
