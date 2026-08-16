// 同步: 构建 Web → 写入 config.json（内置默认服务器地址） → 复制 dist 到桌面端
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, '../../web/dist');
const dest = path.join(here, 'web');
const defaultServer = process.env.VITE_DEFAULT_SERVER || 'http://192.168.31.114:3000';

console.log('== 构建 Web（内置服务器地址: ' + defaultServer + '） ==');
execSync('npm run build', { cwd: path.resolve(here, '../../web'), stdio: 'inherit' });

console.log('== 写入 config.json ==');
fs.writeFileSync(path.join(webDist, 'config.json'), JSON.stringify({ defaultServer }));

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
