// 上传缺失的 Release 资源（幂等：跳过已上传的文件）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = fs.readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/)[0].trim();
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
  if (have.has(name)) { console.log('已存在，跳过:', name); continue; }
  const a = await upload(`https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, file);
  console.log(`已上传: ${name} (${(a.size / 1048576).toFixed(1)}MB)`);
}
console.log('完成');
