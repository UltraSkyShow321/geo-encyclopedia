const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: 'D:/OpenCodeProjects/geo-encyclopedia/server',
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3215' },
  stdio: 'ignore',
});
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage();
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push('[console-error] ' + m.text()); });
  p.on('pageerror', (e) => logs.push('[pageerror] ' + e.message.slice(0, 200)));
  p.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url().slice(0, 80) + ' ' + (r.failure()?.errorText || '')));
  await p.goto('http://127.0.0.1:3215/map', { waitUntil: 'domcontentloaded' });
  for (const wait of [2000, 5000, 10000]) {
    await new Promise((r) => setTimeout(r, wait));
    const s = await p.evaluate(() => ({
      canvas: document.querySelectorAll('canvas').length,
      globe: !!window.__geoGlobe,
      labels: window.__geoGlobe ? window.__geoGlobe.labelsData().length : -1,
    }));
    console.log(`t+${wait}ms:`, JSON.stringify(s));
  }
  console.log('--- 日志 ---');
  logs.slice(0, 6).forEach((l) => console.log(l));
  await b.close();
  server.kill();
})();
