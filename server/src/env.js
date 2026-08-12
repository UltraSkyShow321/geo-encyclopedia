// 手动加载项目根目录 .env（兼容 UTF-8 BOM、引号、注释），不覆盖已存在的环境变量
// 必须在读取 process.env 的其他模块之前 import 本模块
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function loadDotEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.ENV_FILE,
    path.join(here, '..', '..', '.env'), // server/src/../../.env（项目根目录）
    path.join(process.cwd(), '.env'),
  ];
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
    return;
  }
}

loadDotEnv();
