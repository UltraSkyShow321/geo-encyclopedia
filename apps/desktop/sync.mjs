// 同步: 构建 Web → 复制 dist 到桌面端
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');
const dest = path.join(here, 'web');

console.log('== 构建 Web ==');
execSync('npm run build', { cwd: path.resolve(here, '../../web'), stdio: 'inherit' });

console.log('== 复制到桌面端 ==');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(webDist, dest, { recursive: true });
const idx = path.join(dest, 'index.html');
const html = fs.readFileSync(idx, 'utf8');
if (!html.includes('__GEO_NATIVE__')) {
  fs.writeFileSync(
    idx,
    html.replace(
      '<script type="module"',
      '<script>window.__GEO_NATIVE__=true;</script>\n    <script type="module"'
    )
  );
}
console.log('完成');
