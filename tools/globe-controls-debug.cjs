const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: 'D:/OpenCodeProjects/geo-encyclopedia/server',
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3224' },
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
  await p.goto('http://127.0.0.1:3224/map', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 6000));
  const cam = () => p.evaluate(() => {
    const g = window.__geoGlobe;
    const c = g.camera();
    return c.position.x.toFixed(1) + ',' + c.position.y.toFixed(1) + ',' + c.position.z.toFixed(1);
  });
  console.log('t0:', await cam());
  await new Promise((r) => setTimeout(r, 3000));
  console.log('t3(应旋转):', await cam());
  const alt1 = await p.evaluate(() => window.__geoGlobe.pointOfView().altitude);
  await p.evaluate(() => {
    [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === '−')?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const alt2 = await p.evaluate(() => window.__geoGlobe.pointOfView().altitude);
  console.log('−按钮缩放(应增大):', alt1.toFixed(2), '->', alt2.toFixed(2), alt2 < alt1 ? '✓' : '✗');
  await b.close();
  server.kill();
})();
