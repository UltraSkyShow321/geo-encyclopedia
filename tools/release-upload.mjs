// 上传缺失的 Release 资源（幂等：跳过已上传的文件）
// 用法: node tools/release-upload.mjs <token文件> [--replace]
//   --replace: 删除已存在的同名旧资产后重新上传
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tokenFile = process.argv[2];
const replace = process.argv.includes('--replace');
const raw = fs.readFileSync(tokenFile, 'utf8');
// token 文件每行格式: <token> [备注]（取行首第一个词）
const token = (raw.split(/\r?\n/).find((l) => l.trim()) || '').trim().split(/\s+/)[0];
if (!token) {
  console.error('未找到 token');
  process.exit(1);
}
const owner = 'UltraSkyShow321';
const repo = 'geo-encyclopedia';
const API = 'https://api.github.com';
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TAG = 'v1.0.0';
const want = ['geo-encyclopedia-v1.0.0-android.apk', 'geo-encyclopedia-v1.0.0-win-setup.exe', 'geo-encyclopedia-v1.0.0-win-portable.exe', 'geo-encyclopedia-v1.0.0-win-portable.zip'];

async function gh(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { authorization: `Bearer ${token}`, 'user-agent': 'geo-encyclopedia', ...(opts.headers || {}) } });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${url}: ${String(body).slice(0, 150)}`);
  return body;
}

async function upload(url, filePath) {
  const buf = fs.readFileSync(filePath);
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'user-agent': 'geo-encyclopedia', 'content-type': 'application/octet-stream' },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

const release = await gh(`${API}/repos/${owner}/${repo}/releases/tags/${TAG}`);
const have = new Set(release.assets.map((a) => a.name));

for (const name of want) {
  const file = path.join(distDir, name);
  if (!fs.existsSync(file)) { console.log('本地缺失:', name); continue; }
  if (have.has(name)) {
    if (!replace) { console.log('已存在，跳过:', name); continue; }
    const old = release.assets.find((a) => a.name === name);
    await gh(`${API}/repos/${owner}/${repo}/releases/assets/${old.id}`, { method: 'DELETE' });
    console.log('已删除旧资产:', name);
  }
  const a = await upload(`https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, file);
  console.log(`已上传: ${name} (${(a.size / 1048576).toFixed(1)}MB)`);
}
console.log('完成');
