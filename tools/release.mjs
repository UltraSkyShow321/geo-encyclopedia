// 创建 GitHub Release 并上传安装包资源（走 api.github.com）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/)[0].trim();
const owner = 'UltraSkyShow321';
const repo = 'geo-encyclopedia';
const API = 'https://api.github.com';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const TAG = 'v1.0.0';
const assets = [
  'geo-encyclopedia-v1.0.0-android.apk',
  'geo-encyclopedia-v1.0.0-win-setup.exe',
  'geo-encyclopedia-v1.0.0-win-portable.exe',
  'geo-encyclopedia-v1.0.0-win-portable.zip',
];

async function gh(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { authorization: `Bearer ${token}`, 'user-agent': 'geo-encyclopedia', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${url}: ${String(body).slice(0, 200)}`);
  return body;
}

async function upload(url, filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': 'geo-encyclopedia',
      'content-type': 'application/octet-stream',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// 1. 删除已存在的同 tag release（幂等）
const existing = await gh(`${API}/repos/${owner}/${repo}/releases/tags/${TAG}`).catch(() => null);
if (existing) {
  console.log('删除旧 release…');
  await gh(`${API}/repos/${owner}/${repo}/releases/${existing.id}`, { method: 'DELETE' });
}

// 2. 创建 release
const release = await gh(`${API}/repos/${owner}/${repo}/releases`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    tag_name: TAG,
    name: '世界地理百科全书 v1.0.0',
    body: `## 世界地理百科全书 v1.0.0

- 244 国档案 + 9 篇地理专题（AI 生成 + 人工校对）
- 互动地图：区划 / 地形 / 卫星 / 高德 四种底图，136 处标志性地貌标注
- 学习功能：登录、收藏笔记、测验、记忆卡片
- 中英双语、深色模式、PWA 离线
- 移动端（Android APK）与桌面端（Windows 安装包/便携版）`,
  }),
});
console.log('Release 创建:', release.html_url);

// 3. 上传资源
for (const name of assets) {
  const file = path.join(distDir, name);
  if (!fs.existsSync(file)) { console.log('跳过(不存在):', name); continue; }
    const a = await upload(`${API.replace('api.', 'uploads.')}/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, file);
  console.log(`已上传: ${name} (${(a.size / 1024 / 1024).toFixed(1)}MB)`);
}
console.log('完成');
