// 像素分析: 检查截图中是否有横向色带覆盖（均匀色水平条纹）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'logs', 'screenshots');
const file = process.argv[2] || path.join(shots, '05-globe.png');

if (!fs.existsSync(file)) {
  console.error('文件不存在:', file);
  process.exit(1);
}

const { PNG } = require('pngjs');
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;

console.log(`尺寸: ${width}x${height}`);

// 每行统计主色
function rowInfo(y) {
  const counts = new Map();
  const start = y * width * 4;
  let maxColor = '', maxCount = 0;
  for (let x = 0; x < width; x++) {
    const i = start + x * 4;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (n > maxCount) { maxCount = n; maxColor = key; }
  }
  return { maxColor, ratio: maxCount / width, distinct: counts.size };
}

const bands = [];
let prev = null, runStart = 0;
for (let y = 0; y < height; y++) {
  const info = rowInfo(y);
  const sig = info.maxColor + '|' + (info.ratio > 0.8 ? 'SOLID' : 'mixed');
  if (prev && sig !== prev) {
    if (runStart < y - 1) bands.push([runStart, y - 1, prev]);
    runStart = y;
  }
  prev = sig;
}
if (runStart < height - 1) bands.push([runStart, height - 1, prev]);

console.log('横向色带 (y起, y止, 主色, 覆盖比例):');
for (const [a, b, sig] of bands) {
  const [color] = sig.split('|');
  if (b - a >= 8) console.log(`  y=${a}-${b} 高${b - a + 1}px 色(${color}) 占比${sig.includes('SOLID') ? '>80%' : '混合'}`);
}
