// 深度诊断单个国家的地图组件状态
import puppeteer from 'puppeteer-core';

const BASE = process.argv[3] || 'http://192.168.31.114:3000';
const slug = process.argv[2] || 'cn';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 300)));
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url().slice(0, 120) + ' ' + r.failure()?.errorText));
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(`${BASE}/#/countries/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 6000));

  const info = await page.evaluate(() => {
    const maps = document.querySelectorAll('.leaflet-container');
    const m = window.__leafletMap;
    let detail = { leafletContainers: maps.length };
    if (m) {
      const b = m.getBounds();
      detail = {
        ...detail,
        zoom: m.getZoom(),
        center: [Math.round(m.getCenter().lat * 10) / 10, Math.round(m.getCenter().lng * 10) / 10],
        boundsSize: [Math.round((b.getEast() - b.getWest()) * 10) / 10, Math.round((b.getNorth() - b.getSouth()) * 10) / 10],
        containerH: m.getContainer()?.clientHeight,
        layers: Object.keys(m._layers).length,
      };
    }
    // 找到详情页地图容器的实际 DOM
    const sections = [...document.querySelectorAll('section')];
    const locSection = sections.find((s) => s.querySelector('.leaflet-container'));
    detail.sectionFound = !!locSection;
    if (locSection) {
      const lc = locSection.querySelector('.leaflet-container');
      detail.rect = JSON.parse(JSON.stringify(lc.getBoundingClientRect()));
    }
    return detail;
  });
  console.log('STATE:', JSON.stringify(info, null, 1));
  console.log('ERRORS (' + errors.length + '):');
  errors.slice(0, 12).forEach((e) => console.log(' ', e));
  await browser.close();
})();
