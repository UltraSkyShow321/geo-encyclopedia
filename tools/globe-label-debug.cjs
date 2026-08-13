const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: 'D:/OpenCodeProjects/geo-encyclopedia/server',
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3222' },
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
  await p.goto('http://127.0.0.1:3222/map', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 6000));
  console.log('默认 altitude:', await p.evaluate(() => window.__geoGlobe?.pointOfView().altitude));
  console.log('国名元素总数:', await p.evaluate(() => document.querySelectorAll('.globe-name').length));
  const cssInfo = await p.evaluate(() => {
    const el = document.querySelector('.globe-name');
    if (!el) return '无元素';
    const cs = getComputedStyle(el);
    return `inline=${el.style.display || '未设置'} computed=${cs.display} class=${el.className} 容器类=${document.querySelector('.globe-labels-on') ? 'on' : 'off'}`;
  });
  console.log('CSS 信息:', cssInfo);
  await p.evaluate(() => window.__geoGlobe.pointOfView({ lat: 20, lng: 10, altitude: 0.9 }, 0));
  await new Promise((r) => setTimeout(r, 2000));
  console.log('放大后 容器类:', await p.evaluate(() => (document.querySelector('.globe-labels-on') ? 'on' : 'off')));
  console.log('放大后 computed=none 的元素数:', await p.evaluate(() => [...document.querySelectorAll('.globe-name')].filter((e) => getComputedStyle(e).display === 'none').length));
  await p.screenshot({ path: 'C:/Users/18360/AppData/Local/Temp/opencode/globe-zoomed-check.png' });
  await b.close();
  server.kill();
})();
