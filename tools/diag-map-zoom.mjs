// E2E 诊断: 批量检查国家详情页"在世界地图中的位置"的实际缩放与视野
// 用法: node tools/diag-map-zoom.mjs [服务器BASE]
import puppeteer from 'puppeteer-core';
import http from 'node:http';

const BASE = process.argv[2] || 'http://192.168.31.114:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function get(path) {
  return new Promise((res, rej) => {
    http.get(BASE + path, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej);
  });
}

(async () => {
  const list = await get('/api/countries?limit=500');
  // 抽样：各大洲 + 已知问题国（跨线/微小/大国/小国）
  const picks = ['ru', 'us', 'fj', 'ki', 'nz', 'gf', 're', 'tv', 'mc', 'sg', 'cn', 'br', 'eg', 'is', 'mt', 'bb'];
  const slugs = [];
  for (const p of picks) if (list.items.some((c) => c.slug === p)) slugs.push(p);
  // 再随机补 10 个
  const shuffled = [...list.items].sort(() => Math.random() - 0.5).slice(0, 10);
  for (const c of shuffled) if (!slugs.includes(c.slug)) slugs.push(c.slug);

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const results = [];
  for (const slug of slugs) {
    try {
      await page.goto(`${BASE}/#/countries/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 3500));
      const info = await page.evaluate(() => {
        const m = window.__leafletMap;
        if (!m) return { map: false };
        const z = m.getZoom();
        const c = m.getCenter();
        return {
          map: true,
          zoom: Math.round(z * 10) / 10,
          lat: Math.round(c.lat * 10) / 10,
          lng: Math.round(c.lng * 10) / 10,
        };
      });
      results.push([slug, info.map ? `zoom=${info.zoom} center=(${info.lat},${info.lng})` : 'NO MAP']);
      console.log(slug.padEnd(8), results[results.length - 1][1]);
    } catch (e) {
      console.log(slug.padEnd(8), 'ERR', e.message.slice(0, 60));
      results.push([slug, 'ERR']);
    }
  }

  await browser.close();
  const bad = results.filter(([, v]) => v === 'NO MAP' || /zoom=(0|1|2)(\.\d)? /.test(v + ' '));
  console.log('\nsummary:', results.length, 'tested | suspicious(no-map/world-view):', bad.length);
})();
