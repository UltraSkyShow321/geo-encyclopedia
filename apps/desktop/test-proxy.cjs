// 代理模块纯 Node 端到端测试（不依赖 Electron）
// 运行: node test-proxy.cjs
const { spawn } = require('node:child_process');
const path = require('node:path');
const { createProxy } = require('./proxy.cjs');

(async () => {
  // 1. 启动目标服务器（系统 node）
  const PORT = 3240 + Math.floor(Math.random() * 50);
  const server = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, '..', '..', 'server'),
    env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: String(PORT) },
    stdio: 'ignore',
  });
  let ready = false;
  for (let i = 0; i < 20; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('目标服务器就绪:', ready);
  if (!ready) { server.kill(); process.exit(1); }

  // 2. 启动本地代理
  const proxy = createProxy();
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  const pp = proxy.address().port;
  console.log('本地代理端口:', pp);

  // 3. 配置代理目标
  const cfg = await fetch(`http://127.0.0.1:${pp}/__geo_server`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: `http://127.0.0.1:${PORT}` }),
  });
  console.log('配置代理:', (await cfg.json()).ok);

  // 4. 转发 /api/meta
  const meta = await fetch(`http://127.0.0.1:${pp}/api/meta`);
  const metaJson = await meta.json();
  console.log('转发 /api/meta:', meta.status, '国家数:', metaJson.totalCountries);

  // 5. 转发带 body 的 POST（登录）
  const login = await fetch(`http://127.0.0.1:${pp}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'test123' }),
  });
  const cookie = login.headers.get('set-cookie');
  console.log('转发登录(Set-Cookie 透传):', login.status, 'cookie:', !!cookie);

  // 6. 带 cookie 的请求
  const fav = await fetch(`http://127.0.0.1:${pp}/api/favorites`, { headers: { cookie: cookie.split(';')[0] } });
  console.log('带 cookie 转发 /api/favorites:', fav.status);

  // 7. 静态资源（首页 + 国旗）
  const home = await fetch(`http://127.0.0.1:${pp}/index.html`);
  const homeText = await home.text();
  console.log('静态首页:', home.status, '含#app:', homeText.includes('id="app"'));
  const flag = await fetch(`http://127.0.0.1:${pp}/flags/cn.svg`);
  console.log('静态国旗:', flag.status, flag.headers.get('content-type'));

  // 8. 404 兜底（SPA fallback）
  const spa = await fetch(`http://127.0.0.1:${pp}/countries/cn`);
  console.log('SPA fallback:', spa.status);

  server.kill();
  proxy.close();
  console.log('=== 代理全部通过 ===');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
