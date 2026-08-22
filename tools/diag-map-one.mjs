// 逐国独立诊断：每个国家全新浏览器实例，抓取最终视图 + 错误
import puppeteer from 'puppeteer-core';

const BASE = 'http://192.168.31.114:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ['cn', 'us', 'ru', 'fj', 'mc', 'sg', 're', 'tv', 'jp', 'br'];

(async () => {
  for (const slug of slugs) {
    const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 150)));
    try {
      await page.goto(`${BASE}/#/countries/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 等待地图 fitBounds 完成（轮询 zoom 变化，最多 20s）
      let info = null;
      let stable = 0, last = '';
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        info = await page.evaluate(() => {
          const m = window.__leafletMap;
          if (!m) return null;
          return { zoom: m.getZoom(), lat: Math.round(m.getCenter().lat), lng: Math.round(m.getCenter().lng) };
        });
        const cur = info ? `${info.zoom},${info.lat},${info.lng}` : 'null';
        if (cur === last && info) { stable++; if (stable >= 6 && i >= 10) break; } else stable = 0;
        last = cur;
      }
      console.log(slug.padEnd(6), info ? `zoom=${info.zoom} center=(${info.lat},${info.lng})` : 'NO MAP', errors.length ? `| ${errors[0]}` : '');
    } catch (e) {
      console.log(slug.padEnd(6), 'GOTO-ERR', e.message.slice(0, 80));
    }
    await browser.close();
  }
})();
