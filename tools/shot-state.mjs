// 抓取特定页面状态的截图（用于视觉验证）
// 用法: node tools/shot-state.mjs <名称> <url> [等待选择器]
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
const url = process.argv[3];
const waitSel = process.argv[4] || 'canvas';

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3211' },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3211' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
try { await page.waitForSelector(waitSel, { timeout: 20000 }); } catch {}
// 额外动作: --click 文本
const clicks = [];
for (let i = 4; i < process.argv.length; i++) {
  if (process.argv[i] === '--click') clicks.push(process.argv[i + 1]);
}
for (const txt of clicks) {
  try {
    await page.waitForFunction(
      (t) => [...document.querySelectorAll('button')].some((e) => e.textContent.trim().includes(t)),
      { timeout: 15000 }, txt
    );
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().includes(t));
      b?.click();
    }, txt);
    await new Promise((r) => setTimeout(r, 2500));
  } catch {}
}
// 额外动作: --globe-view lat,lng,alt（3D 地球仪视角）
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--globe-view') {
    const [lat, lng, alt] = process.argv[i + 1].split(',').map(Number);
    try {
      await page.evaluate(([ltt, lngg, al]) => {
        const g = window.__geoGlobe;
        if (g) g.pointOfView({ lat: ltt, lng: lngg, altitude: al }, 800);
      }, [lat, lng, alt]);
      await new Promise((r) => setTimeout(r, 3000));
    } catch {}
  }
}
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: path.join(root, 'logs', 'screenshots', name + '.png') });
console.log('saved', name + '.png');
await browser.close();
server.kill();
