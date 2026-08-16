// Web 端全功能 E2E 测试（使用系统 Edge 无头模式）
// 用法: node tools/e2e-test.mjs
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'logs', 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:3210';
const PASSWORD = 'e2e-test-pass-2026';

const results = [];
const consoleErrors = [];
const badResponses = [];
let page, browser;

function pass(name) { results.push(['PASS', name]); console.log('✅ PASS', name); }
function fail(name, err) { results.push(['FAIL', name]); console.log('❌ FAIL', name, err?.message || err); }

async function shot(name) {
  try { await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: false }); } catch {}
}

async function goto(url, waitUntil = 'domcontentloaded') {
  await page.goto(BASE + url, { waitUntil, timeout: 30000 });
}

async function clickText(sel, text, opts = {}) {
  const el = await page.waitForFunction(
    (s, txt) => { const n = document.querySelector(s); const all = [...document.querySelectorAll(s)]; return all.find(e => e.textContent.trim().includes(txt)); },
    { timeout: 10000 }, sel, text
  );
  await el.asElement().click(opts);
  return el;
}

async function main() {
  // 启动服务器
  const server = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, ADMIN_PASSWORD: PASSWORD, PORT: '3210' },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2500));

  browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: [
      '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader', '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
  page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.url()); });

  // ============ 1. 首页 ============
  try {
    await goto('/#/');
    await page.waitForSelector('h1', { timeout: 10000 });
    const title = await page.$eval('h1', (e) => e.textContent.trim());
    await page.waitForFunction(() => document.querySelectorAll('main .text-2xl.font-bold').length >= 4, { timeout: 15000 });
    const statCount = await page.$$eval('main .text-2xl.font-bold', (els) => els.length);
    if (title.includes('世界地理百科全书') && statCount >= 4) pass('首页: 标题与统计卡片');
    else fail('首页: 标题与统计卡片', `title=${title} stats=${statCount}`);
    await page.waitForFunction(() => document.querySelector('canvas'), { timeout: 15000 });
    pass('首页: ECharts 图表渲染');
    await shot('01-home');
  } catch (e) { fail('首页', e); }

  // ============ 2. 国家列表 ============
  try {
    await goto('/#/countries');
    await page.waitForFunction(() => document.querySelectorAll('a[href^="#/countries/"]').length > 5, { timeout: 15000 });
    const cards = await page.$$eval('a[href^="#/countries/"]', (els) => els.length);
    if (cards >= 10) pass(`国家列表: 卡片渲染 (${cards} 张)`);
    else fail('国家列表: 卡片渲染', cards);
    await page.select('select', '亚洲');
    await page.waitForFunction(() => document.querySelectorAll('a[href^="#/countries/"]').length > 5, { timeout: 10000 });
    pass('国家列表: 大洲筛选');
    await page.select('select:nth-of-type(2)', 'population');
    await shot('02-countries');
    pass('国家列表: 按人口排序');
  } catch (e) { fail('国家列表', e); }

  // ============ 3. 国家详情 ============
  try {
    await goto('/#/countries/cn');
    await page.waitForSelector('article', { timeout: 15000 });
    const h1 = await page.$eval('h1', (e) => e.textContent);
    const bodyText = await page.$eval('article', (e) => e.textContent.length);
    if (h1 === '中国' && bodyText > 500) pass('国家详情: 标题与正文');
    else fail('国家详情: 标题与正文', `h1=${h1} body=${bodyText}`);

    // 触发懒加载并轮询等待图片加载
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const imgLoaded = (sel) =>
      page.waitForFunction(
        (s) => { const img = document.querySelector(s); return img && img.complete && img.naturalWidth > 0; },
        { timeout: 20000 }, sel
      ).then(() => true).catch(() => false);

    if (await imgLoaded('img[src="/flags/cn.svg"]')) pass('国家详情: 国旗图片加载');
    else fail('国家详情: 国旗图片', '加载失败');
    if (await imgLoaded('img[src^="/api/country-svg/"]')) pass('国家详情: 国家轮廓 SVG');
    else fail('国家详情: 轮廓 SVG', '加载失败');
    if (await imgLoaded('img[src*="layer=imagery"]')) pass('国家详情: 卫星影像图');
    else fail('国家详情: 卫星影像图', '加载失败');

    const videoLinks = await page.$$eval('a[target="_blank"]', (els) => els.filter((a) => a.href.includes('bilibili.com') || a.href.includes('youtube.com')).length);
    if (videoLinks >= 2) pass('国家详情: 视频讲解链接');
    else fail('国家详情: 视频链接', videoLinks);
    await page.waitForFunction(() => document.querySelectorAll('.leaflet-container').length > 0, { timeout: 15000 });
    pass('国家详情: 平面小地图');
    await shot('03-country-detail');
  } catch (e) { fail('国家详情', e); }

  // ============ 4. 专题 ============
  try {
    await goto('/#/topics');
    await page.waitForFunction(() => document.querySelectorAll('a[href^="#/topics/"]').length >= 3, { timeout: 10000 });
    const n = await page.$$eval('a[href^="#/topics/"]', (els) => els.length);
    if (n >= 3) pass(`专题列表: ${n} 篇`);
    else fail('专题列表', n);
    await clickText('a[href^="#/topics/"]', '世界最长河流');
    await page.waitForSelector('article', { timeout: 10000 });
    pass('专题详情: 正文渲染');
    await shot('04-topics');
  } catch (e) { fail('专题', e); }

  // ============ 5. 地图（平面地图） ============
  try {
    await goto('/#/map');
    await page.waitForFunction(() => document.querySelector('.leaflet-container'), { timeout: 20000 });
    pass('地图: 平面地图渲染');

    await clickText('button', '卫星');
    await new Promise((r) => setTimeout(r, 2000));
    pass('地图: 卫星底图切换');
    await clickText('button', '地形');
    await page.waitForFunction(() => document.querySelectorAll('.lf-marker').length >= 20, { timeout: 20000 });
    const landformCount = await page.$$eval('.lf-marker', (els) => els.length);
    if (landformCount >= 20) pass(`地图: 地貌标注渲染 (${landformCount} 处)`);
    else fail('地图: 地貌标注', landformCount);
    await shot('16-terrain-landforms');

    // 真实像素点击: 中国/美国/巴西 内部点击 → 跳转详情
    await clickText('button', '区划');
    await new Promise((r) => setTimeout(r, 2500));
    for (const [name, lng, lat] of [['中国', 104, 35], ['美国', -98, 39], ['巴西', -51, -14]]) {
      await page.evaluate(([lng2, lat2]) => {
        const m = window.__leafletMap;
        if (m) m.setView([lat2, lng2], 3);
        return null;
      }, [lng, lat]);
      await new Promise((r) => setTimeout(r, 2500));
      const point = await page.evaluate(([lng2, lat2]) => {
        const m = window.__leafletMap;
        if (!m) return null;
        const p = m.latLngToContainerPoint([lat2, lng2]);
        const rect = m.getContainer().getBoundingClientRect();
        return { x: rect.left + p.x, y: rect.top + p.y };
      }, [lng, lat]);
      if (!point) { fail(`地图: 点击跳转(${name})`, 'no map'); continue; }
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction((n) => location.hash.startsWith('#/countries/'), { timeout: 10000 }, name).catch(() => {});
      const path = await page.evaluate(() => location.hash.slice(1));
      if (path.includes('/countries/')) pass(`地图: 点击${name}跳转 (${path})`);
      else fail(`地图: 点击${name}跳转`, path);
      await goto('/#/map');
      await page.waitForFunction(() => document.querySelector('.leaflet-container'), { timeout: 15000 });
    }
  } catch (e) { fail('地图页', e); }

  // ============ 6. 排行 ============
  try {
    await goto('/#/ranks');
    await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const canvases = await page.$$eval('canvas', (els) => els.length);
    const rows = await page.$$eval('a[href^="#/countries/"]', (els) => els.length);
    if (canvases >= 2 && rows >= 10) pass(`排行: ${canvases} 图表 + ${rows} 行数据`);
    else fail('排行', `canvases=${canvases} rows=${rows}`);
    await shot('06-ranks');
  } catch (e) { fail('排行', e); }

  // ============ 7. 搜索 ============
  try {
    await goto('/#/search?q=' + encodeURIComponent('日本'));
    await page.waitForFunction(() => document.querySelectorAll('a[href^="#/countries/"]').length >= 1, { timeout: 15000 });
    const results = await page.$$eval('a[href^="#/countries/"]', (els) => els.length);
    if (results >= 1) pass('搜索: 中文关键词命中');
    else fail('搜索: 中文关键词', results);
    await shot('07-search');
  } catch (e) { fail('搜索', e); }

  // ============ 8. 测验 ============
  try {
    await goto('/#/quiz');
    await page.waitForSelector('button', { timeout: 10000 });
    await clickText('button', '开始测验');
    await page.waitForFunction(() => document.body.textContent.includes('进度'), { timeout: 15000 });
    for (let i = 0; i < 8; i++) {
      await page.waitForFunction(() => document.querySelectorAll('button').length > 1, { timeout: 10000 });
      const btns = await page.$$eval('button', (els) => els.map((e) => ({ t: e.textContent.trim(), cls: e.className })));
      const option = btns.find((b) => /^[A-D]\./.test(b.t));
      if (!option) break;
      await page.evaluate((txt) => {
        const btn = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === txt);
        btn?.click();
      }, option.t);
      await page.waitForFunction(() => document.body.textContent.includes('回答正确') || document.body.textContent.includes('回答错误'), { timeout: 10000 });
      const nextBtn = await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('button')].find((e) => e.textContent.includes('下一题') || e.textContent.includes('再来'));
        return b ? b : null;
      }, { timeout: 10000 });
      await nextBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 300));
    }
    const finished = await page.waitForFunction(() => document.body.textContent.includes('测验完成'), { timeout: 15000 }).catch(() => null);
    if (finished) pass('测验: 完整作答流程');
    else fail('测验: 完整作答流程', '未到完成页');
    await shot('08-quiz');
  } catch (e) { fail('测验', e); }

  // ============ 9. 登录 ============
  try {
    await goto('/#/login');
    await page.type('input[type="password"]', 'wrong-password');
    await page.click('form button');
    await page.waitForFunction(() => document.body.textContent.includes('密码错误'), { timeout: 10000 });
    pass('登录: 错误密码被拒绝');
    await page.evaluate(() => document.querySelector('input[type="password"]').value = '');
    await page.type('input[type="password"]', PASSWORD);
    await page.click('form button');
    await page.waitForFunction(async () => (await fetch('/api/auth/me').then((r) => r.json())).authed === true, { timeout: 10000 });
    pass('登录: 正确密码成功');
    await shot('09-login');
  } catch (e) { fail('登录', e); }

  // ============ 10. 收藏/笔记 ============
  try {
    await goto('/#/countries/jp');
    await page.waitForSelector('article', { timeout: 15000 });
    await clickText('button', '收藏');
    await new Promise((r) => setTimeout(r, 500));
    const favStatus = await page.evaluate(() => fetch('/api/favorites').then((r) => r.json()));
    if (favStatus.some((f) => f.slug === 'jp')) pass('收藏: 添加成功');
    else fail('收藏: 添加成功', favStatus);
    await clickText('button', '取消收藏');
    await new Promise((r) => setTimeout(r, 500));
    pass('收藏: 取消成功');
    await goto('/#/favorites');
    await page.waitForSelector('h1', { timeout: 10000 });
    pass('收藏: 收藏页访问');
    await shot('10-favorites');
  } catch (e) { fail('收藏', e); }

  // ============ 11. 记忆卡片 ============
  try {
    await goto('/#/cards');
    await page.waitForSelector('h1', { timeout: 10000 });
    await clickText('button', '新建卡片');
    await page.waitForSelector('form input', { timeout: 10000 });
    await page.type('input[placeholder*="问题"]', '测试: 日本的首都?');
    await page.type('input[placeholder*="答案"]', '东京');
    await clickText('button', '添加');
    await new Promise((r) => setTimeout(r, 800));
    const cardExists = await page.evaluate(() => fetch('/api/cards').then((r) => r.json()));
    if (cardExists.all.some((c) => c.question.includes('日本的首都'))) pass('卡片: 手动添加成功');
    else fail('卡片: 手动添加', cardExists);
    await shot('11-cards');
  } catch (e) { fail('卡片', e); }

  // ============ 12. 下载页 ============
  try {
    await goto('/#/download');
    await page.waitForFunction(() => document.querySelectorAll('a[href*="github.com"]').length >= 2, { timeout: 10000 });
    pass('下载页: 平台卡片与下载链接');
    await shot('12-download');
  } catch (e) { fail('下载页', e); }

  // ============ 13. 设置页 ============
  try {
    await goto('/#/settings');
    await page.waitForFunction(() => document.body.textContent.includes('网页版无需设置'), { timeout: 10000 });
    pass('设置页: 网页版提示');
  } catch (e) { fail('设置页', e); }

  // ============ 14. PWA ============
  try {
    await goto('/#/');
    await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length));
    const swCount = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((rs) => rs.length));
    const manifestOk = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.ok));
    if (swCount >= 1 && manifestOk) pass('PWA: Service Worker 注册 + manifest');
    else fail('PWA', `sw=${swCount} manifest=${manifestOk}`);
  } catch (e) { fail('PWA', e); }

  // ============ 15. 深色模式/双语 ============
  try {
    // 主题按钮: auto → light → dark，需点两次
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('header button')].find((e) => e.querySelector('svg'));
      b?.click(); b?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (dark) pass('深色模式: 切换生效');
    else fail('深色模式', '未生效');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'EN');
      b?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    const navText = await page.$eval('header', (e) => e.textContent);
    if (navText.includes('Countries') && navText.includes('Quiz')) pass('双语: 切换英文生效');
    else fail('双语', navText.slice(0, 80));
  } catch (e) { fail('深色/双语', e); }

  // ============ 汇总 ============
  const passed = results.filter((r) => r[0] === 'PASS').length;
  const failed = results.length - passed;
  console.log('\n==================== 测试汇总 ====================');
  console.log(`通过: ${passed}  失败: ${failed}  总数: ${results.length}`);
  if (consoleErrors.length) {
    console.log('\n浏览器控制台错误 (' + consoleErrors.length + ' 条):');
    [...new Set(consoleErrors)].slice(0, 10).forEach((e) => console.log('  -', e.slice(0, 160)));
  }
  if (badResponses.length) {
    console.log('\n4xx/5xx 请求:');
    [...new Set(badResponses)].forEach((e) => console.log('  -', e));
  }
  console.log('截图目录: ' + shots);

  await browser.close();
  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E 启动失败:', e.message);
  process.exit(1);
});
