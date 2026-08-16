// 离线模式 E2E：先在线下载离线包 → 断网 → 验证全部核心功能可用
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:3260';

const results = [];
function pass(name) { results.push(['PASS', name]); console.log('✅ PASS', name); }
function fail(name, e) { results.push(['FAIL', name]); console.log('❌ FAIL', name, e?.message || e); }

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3260' },
  stdio: 'ignore',
});

let page, browser;

async function main() {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--disable-web-security'],
  });
  page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 150)); });

  // ========= 在线阶段：触发离线包下载 + SW 激活 =========
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 10000)); // 自动检查更新下载离线包
    const hasPack = await page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('geo-offline');
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('pack', 'readonly');
          const g = tx.objectStore('pack').get('current');
          g.onsuccess = () => resolve(!!g.result);
          g.onerror = () => resolve(false);
        } catch { resolve(false); }
      };
      req.onerror = () => resolve(false);
    }));
    if (hasPack) pass('离线包已下载到本地');
    else fail('离线包已下载到本地');
    // 确保 SW 激活并接管（clientsClaim）
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 3000));
    const swActive = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((rs) => rs.some((r) => r.active && r.active.state === 'activated')));
    if (swActive) pass('Service Worker 已激活');
    else fail('Service Worker 已激活');
  } catch (e) { fail('在线阶段', e); }

  // ========= 断网阶段 =========
  try {
    await page.setOfflineMode(true);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 5000));
    const diag = await page.evaluate(() => ({
      appHtml: document.getElementById('app')?.innerHTML.length || -1,
      body: document.body.textContent.slice(0, 120),
      hasVue: !!document.querySelector('#app > *'),
    }));
    console.log('离线首页诊断:', JSON.stringify(diag));

    // 首页：离线有数据即可（数据可能来自 SW 缓存或离线包）
    const stats = await page.evaluate(() => document.querySelectorAll('main .text-2xl.font-bold').length >= 4);
    if (stats) pass('首页离线可用（统计数据显示）');
    else fail('首页离线可用', { stats });

    // 国家列表（真实点击导航）
    const navOk = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((x) => x.textContent.trim() === '国家');
      a?.click();
      return !!a;
    });
    console.log('点击导航链接:', navOk);
    await new Promise((r) => setTimeout(r, 8000));
    const listDiag = await page.evaluate(() => new Promise((resolve) => {
      const out = { body: document.body.textContent.slice(100, 320), hash: location.hash };
      const req = indexedDB.open('geo-offline');
      req.onsuccess = () => {
        try {
          const g = req.result.transaction('pack', 'readonly').objectStore('pack').get('current');
          g.onsuccess = () => { out.packCountries = g.result?.countries?.length ?? -1; resolve(out); };
          g.onerror = () => { out.packCountries = 'err'; resolve(out); };
        } catch (e) { out.packCountries = 'ex:' + e.message; resolve(out); }
      };
      req.onerror = () => { out.packCountries = 'open-err'; resolve(out); };
    }));
    console.log('列表诊断:', JSON.stringify(listDiag));
    const cards = await page.$$eval('a[href^="#/countries/"]', (els) => els.length);
    if (cards >= 10) pass(`国家列表离线 (${cards} 张)`);
    else fail('国家列表离线', cards);

    // 国家详情（离线正文 + 本地轮廓图）
    await page.evaluate(() => { location.hash = '#/countries/cn'; });
    await new Promise((r) => setTimeout(r, 8000));
    const article = await page.evaluate(() => document.querySelector('article')?.textContent.length || 0);
    const outline = await page.evaluate(() => ({
      hasDataImg: !!document.querySelector('img[src*="data:image/svg"]'),
      hasFlag: !!document.querySelector('img[src*="flags"]'),
      outlineSection: document.body.textContent.includes('国家轮廓'),
      bodyLen: document.body.textContent.length,
    }));
    console.log('详情诊断:', JSON.stringify(outline));
    if (article > 500) pass(`国家详情离线 (正文 ${article} 字)`);
    else fail('国家详情离线', article);
    if (outline.hasDataImg || outline.hasFlag) pass('离线详情视觉内容（轮廓/国旗）');
    else fail('离线详情视觉内容', JSON.stringify(outline));

    // 搜索
    await page.evaluate(() => { location.hash = '#/search?q=' + encodeURIComponent('尼罗河'); });
    await new Promise((r) => setTimeout(r, 8000));
    const searchHits = await page.evaluate(() => document.querySelectorAll('a[href^="#/"]').length);
    if (searchHits >= 1) pass('离线搜索命中');
    else fail('离线搜索命中', searchHits);

    // 地图离线降级
    await page.evaluate(() => { location.hash = '#/map'; });
    await new Promise((r) => setTimeout(r, 8000));
    const mapDiag = await page.evaluate(() => ({
      hasLeaflet: !!document.querySelector('.leaflet-container'),
      outlinePaths: document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive').length,
      hasBanner: document.body.textContent.includes('离线模式'),
      body: document.body.textContent.slice(0, 160),
      hash: location.hash,
    }));
    console.log('地图诊断:', JSON.stringify(mapDiag));
    const mapOffline = await page.evaluate(() => document.body.textContent.includes('离线模式'));
    if (mapDiag.outlinePaths > 0) pass(`地图离线降级（轮廓 ${mapDiag.outlinePaths} 个）`);
    else if (mapOffline) pass('地图离线降级（横幅提示）');
    else fail('地图离线降级', JSON.stringify(mapDiag));

    // 测验离线
    await page.evaluate(() => { location.hash = '#/quiz'; });
    await new Promise((r) => setTimeout(r, 3000));
    await new Promise((r) => setTimeout(r, 2000));
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((e) => e.textContent.includes('开始测验'))?.click(); });
    await new Promise((r) => setTimeout(r, 8000));
    const quizOk = await page.evaluate(() => document.body.textContent.includes('进度'));
    if (quizOk) pass('离线测验可用');
    else fail('离线测验可用');
  } catch (e) { fail('断网阶段', e); }

  const passed = results.filter((r) => r[0] === 'PASS').length;
  console.log(`\n离线测试: ${passed}/${results.length} 通过`);
  console.log('页面错误:', errors.slice(0, 5));
  await browser.close();
  server.kill();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('启动失败:', e.message); process.exit(1); });
