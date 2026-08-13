// 浠?npmmirror 闀滃儚涓嬭浇 Gradle 鍙戣鍖呭埌 wrapper 缂撳瓨锛堣閬?services.gradle.org 澶ф枃浠惰秴鏃讹級
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const VERSION = 'gradle-8.11.1-all';
const URL = `https://services.gradle.org/distributions/${VERSION}.zip`;
const MIRROR = `https://mirrors.cloud.tencent.com/gradle/${VERSION}.zip`;
const hashDir = crypto.createHash('md5').update(URL).digest('hex');
const destDir = path.join(os.homedir(), '.gradle', 'wrapper', 'dists', VERSION, hashDir);
const dest = path.join(destDir, `${VERSION}.zip`);

if (fs.existsSync(dest) && fs.statSync(dest).size > 100_000_000) {
  console.log('Gradle 宸茬紦瀛橈紝璺宠繃涓嬭浇');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
console.log(`涓嬭浇 ${MIRROR}`);
const tmp = dest + '.part';
const res = await fetch(MIRROR, { redirect: 'follow' });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(tmp, buf);
fs.renameSync(tmp, dest);
console.log(`瀹屾垚: ${(buf.length / 1024 / 1024).toFixed(1)} MB 鈫?${dest}`);

