// 批量修改内容状态（发布/草稿/校对中）
// 用法:
//   node tools/set-status.mjs published            # 全部发布
//   node tools/set-status.mjs draft                # 全部转草稿
//   node tools/set-status.mjs published --slug cn  # 单个
//   node tools/set-status.mjs published --continent 亚洲
//   node tools/set-status.mjs published --type topic
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const status = process.argv[2];
const args = process.argv.slice(3);
if (!['draft', 'review', 'published'].includes(status)) {
  console.error('用法: node tools/set-status.mjs [draft|review|published] [--slug xxx] [--continent 亚洲] [--type country|topic]');
  process.exit(1);
}
const slug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const continent = args.includes('--continent') ? args[args.indexOf('--continent') + 1] : null;
const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;

let changed = 0;
for (const dir of ['countries', 'topics']) {
  const dirPath = path.join(root, 'content', dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dirPath, file);
    let raw = fs.readFileSync(filePath, 'utf8');
    const m = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)/);
    if (!m) continue;
    const fm = m[1];
    const rest = raw.slice(fm.length);
    const meta = {};
    for (const line of fm.split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    if (slug && meta.slug !== slug) continue;
    if (continent && !meta.continent?.includes(continent)) continue;
    if (type && meta.type !== type) continue;

    const newFm = fm.replace(/^status:.*$/m, `status: ${status}`);
    fs.writeFileSync(filePath, newFm + rest, 'utf8');
    changed++;
  }
}
console.log(`已将 ${changed} 个文件状态改为 ${status}`);
