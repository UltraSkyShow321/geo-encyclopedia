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
const MARK = '<script>window.__GEO_NATIVE__=true;</script>\n    ';
if (!html.includes('__GEO_NATIVE__')) {
  fs.writeFileSync(indexPath, html.replace('<script type="module"', MARK + '<script type="module"'), 'utf8');
  // 保持 web/dist 纯净（网页版/E2E 测试共用该目录），cap sync 后还原
  fs.writeFileSync(indexPath + '.native-bak', html, 'utf8');
} else {
  fs.writeFileSync(indexPath + '.native-bak', html.replace(MARK, ''), 'utf8');
}

// 内置默认服务器地址配置（构建时可覆盖）
const defaultServer = process.env.VITE_DEFAULT_SERVER || 'http://192.168.31.114:3000';
fs.writeFileSync(path.join(webDist, 'config.json'), JSON.stringify({ defaultServer }));
console.log('内置服务器地址:', defaultServer);

console.log('== 3/3 同步到 Android ==');
execSync('npx cap sync android', { cwd: here, stdio: 'inherit' });

// 还原 web/dist/index.html（保持网页版纯净；原生标记已随 cap sync 进入 android assets）
if (fs.existsSync(indexPath + '.native-bak')) {
  fs.writeFileSync(indexPath, fs.readFileSync(indexPath + '.native-bak', 'utf8'), 'utf8');
  fs.rmSync(indexPath + '.native-bak');
}
console.log('同步完成');
