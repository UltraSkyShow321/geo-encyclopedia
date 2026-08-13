// 下载并安装 Android build-tools 34.0.0（腾讯镜像）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const sdk = 'D:/Android/sdk';
const destDir = path.join(sdk, 'build-tools', '34.0.0');
const tmpZip = path.join(os.tmpdir(), 'build-tools_r34.zip');

if (fs.existsSync(path.join(destDir, 'aapt.exe'))) {
  console.log('34.0.0 已安装');
  process.exit(0);
}

const url = 'https://mirrors.cloud.tencent.com/AndroidSDK/build-tools_r34-windows.zip';
console.log('下载中…');
const res = await fetch(url, { signal: AbortSignal.timeout(600000) });
if (!res.ok) throw new Error('HTTP ' + res.status);
fs.writeFileSync(tmpZip, Buffer.from(await res.arrayBuffer()));
console.log('下载完成', (fs.statSync(tmpZip).size / 1024 / 1024).toFixed(1) + 'MB');

fs.mkdirSync(destDir, { recursive: true });
execSync(`tar -xf "${tmpZip}" -C "${destDir}" --strip-components=1`, { stdio: 'inherit' });
fs.unlinkSync(tmpZip);
console.log('aapt 存在:', fs.existsSync(path.join(destDir, 'aapt.exe')));
