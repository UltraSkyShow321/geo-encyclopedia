// 桌面版端到端冒烟测试（offscreen）
// 运行: npx electron smoke.cjs
const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { createProxy } = require('./main.cjs');

const errors = [];
app.disableHardwareAcceleration();

const SERVER_PORT = 3230 + Math.floor(Math.random() * 100);
// 用系统 Node 启动后端（Electron 内置 Node 20 无 node:sqlite，不能作为后端运行时）
const server = spawn('node', ['src/index.js'], {
  cwd: path.join(__dirname, '..', '..', 'server'),
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: String(SERVER_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

app.whenReady().then(async () => {
  // 等待目标服务器就绪
  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/health`);
      if (r.ok) { serverReady = true; break; }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('目标服务器就绪:', serverReady, '端口', SERVER_PORT);
  if (!serverReady) { console.log('服务器日志:', serverLog.slice(0, 400) || '(无输出)'); server.kill(); app.quit(); return; }

  const proxy = createProxy();
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  const port = proxy.address().port;
  console.log('本地代理端口:', port);

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_e, _l, msg) => {
    errors.push('[console] ' + String(msg).slice(0, 160));
  });

  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await new Promise((r) => setTimeout(r, 6000));

  const firstScreen = await win.webContents.executeJavaScript(
    `document.body.textContent.includes('服务器地址') || document.body.textContent.includes('Server URL')`
  ).catch((e) => 'ERR:' + e.message);
  console.log('首次启动显示设置页:', firstScreen);

  const appHtml = await win.webContents.executeJavaScript(
    `(document.getElementById('app') ? document.getElementById('app').innerHTML.length : -1)`
  ).catch((e) => 'ERR:' + e.message);
  console.log('#app 内容长度:', appHtml);

  // 配置服务器地址（模拟设置页操作）
  await win.webContents.executeJavaScript(
    `fetch('/__geo_server', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url:'http://127.0.0.1:${SERVER_PORT}' }) }).then(r => r.json())`
  ).catch((e) => 'ERR:' + e.message);
  await new Promise((r) => setTimeout(r, 1000));

  const metaOk = await win.webContents.executeJavaScript(
    `fetch('/api/meta').then(async r => ({ ok: r.ok, status: r.status, body: (await r.text()).slice(0, 120) }))`
  ).catch((e) => 'ERR:' + e.message);
  console.log('代理 /api/meta:', JSON.stringify(metaOk));

  await win.webContents.executeJavaScript(`location.hash = '#/countries/cn'`).catch(() => {});
  await new Promise((r) => setTimeout(r, 7000));

  const flagOk = await win.webContents.executeJavaScript(
    `(() => { const img = document.querySelector('img[src*="flags"]'); return img ? img.complete && img.naturalWidth > 0 : false; })()`
  ).catch((e) => 'ERR:' + e.message);
  console.log('国旗图片加载:', flagOk);

  const bodyLen = await win.webContents.executeJavaScript(`document.body.textContent.length`).catch((e) => 'ERR:' + e.message);
  console.log('页面文本长度:', bodyLen);

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', '..', 'logs', 'screenshots', 'desktop-country.png'), img.toPNG());
  console.log('截图已保存: logs/screenshots/desktop-country.png');
  console.log('控制台消息:', errors.slice(0, 8));
  server.kill();
  app.quit();
});
