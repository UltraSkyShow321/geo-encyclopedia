const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  // 1. 用与服务器相同的 loader 读取用户 .env 中的密码（仅用于测试，不打印）
  const { execSync } = require('node:child_process');
  const loaderOut = execSync(`node -e "import('./src/env.js').then(()=>console.log(process.env.ADMIN_PASSWORD||''))"`, {
    cwd: __dirname,
    encoding: 'utf8',
  }).trim();
  const password = loaderOut || null;
  if (!password) {
    console.error('无法从 .env 读取密码');
    process.exit(1);
  }

  // 2. 启动服务器（不带任何环境变量，模拟用户的 npm run dev 场景）
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: __dirname,
    env: { ...process.env, ADMIN_PASSWORD: undefined },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((r) => setTimeout(r, 2500));

  try {
    const login = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    console.log('用 .env 密码登录:', login.status === 200 ? '成功 ✅' : `失败 (${login.status})`);

    const wrong = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'definitely-wrong-password' }),
    });
    console.log('错误密码登录:', wrong.status === 401 ? '正确拒绝 ✅' : `异常 (${wrong.status})`);
  } finally {
    child.kill();
  }
}
main();
