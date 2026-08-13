// 同步流程: 构建 Web → 注入 __GEO_NATIVE__ 标记 → cap sync
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');
const indexPath = path.join(webDist, 'index.html');

console.log('== 1/3 构建 Web ==');
execSync('npm run build', { cwd: path.resolve(here, '../../web'), stdio: 'inherit' });

console.log('== 2/3 注入原生标识 ==');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('__GEO_NATIVE__')) {
  html = html.replace(
    '<script type="module"',
    '<script>window.__GEO_NATIVE__=true;</script>\n    <script type="module"'
  );
  fs.writeFileSync(indexPath, html, 'utf8');
}

console.log('== 3/3 同步到 Android ==');
execSync('npx cap sync android', { cwd: here, stdio: 'inherit' });
console.log('同步完成');
