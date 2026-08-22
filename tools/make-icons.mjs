// 统一图标生成: 矢量 SVG 设计 → @resvg 渲染 → 全端各尺寸 PNG
// 用法: node tools/make-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcSvg = fs.readFileSync(path.join(__dirname, 'icon-source.svg'), 'utf8');

// 提取 defs 与前景内容（标记之间）
const defs = srcSvg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const fg = srcSvg.match(/<!--FG_START-->([\s\S]*?)<!--FG_END-->/)[1].trim();

// 1) 完整图标（带圆角背景），viewBox 512
const fullSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>
  ${fg}
</svg>`;

// 2) 圆形完整图标（Android round / iOS）
const roundSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <g transform="translate(0 16)">${fg}</g>
</svg>`;

// 3) 前景图（透明背景，内容居中缩小，用于 Android adaptive foreground）
//    内容缩到 62%，留 adaptive 安全区
function foreSVG(scale, dy = 0) {
  const t = (512 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    ${defs}
    <g transform="scale(${scale}) translate(${t} ${t + dy})">${fg}</g>
  </svg>`;
}

// 4) adaptive 背景（全幅渐变，与桌面/Web 图标背景一致）
const bgOnlySVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="-32" y="-32" width="576" height="576" fill="url(#bg)"/>
</svg>`;

// 5) 启动屏（深蓝满屏底 + 居中前景，避免白底）
const splashSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="-32" y="-32" width="576" height="576" fill="#1e1b4b"/>
  <g transform="scale(0.82) translate(46.5 46.5)">${fg}</g>
</svg>`;

function render(svgStr, size) {
  const res = new Resvg(svgStr, { fitTo: { mode: 'width', value: size } });
  return Buffer.from(res.render().asPng());
}

// ICO（内嵌 256 PNG）
function toIco(png256) {
  const h = Buffer.alloc(6); h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  const e = Buffer.alloc(16); e[0] = 0; e[1] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png256.length, 8); e.writeUInt32LE(22, 12);
  return Buffer.concat([h, e, png256]);
}

let n = 0;
function write(file, buf) { fs.writeFileSync(file, buf); n++; }

// ===== Web =====
const webIcons = path.join(root, 'web', 'public', 'icons');
fs.mkdirSync(webIcons, { recursive: true });
fs.writeFileSync(path.join(webIcons, 'icon.svg'), fullSVG.replace(/viewBox="0 0 512 512"/, 'viewBox="0 0 512 512"'));
write(path.join(webIcons, 'icon-192.png'), render(fullSVG, 192));
write(path.join(webIcons, 'icon-512.png'), render(fullSVG, 512));
write(path.join(webIcons, 'apple-touch-icon.png'), render(fullSVG, 180));
fs.writeFileSync(path.join(webIcons, 'favicon.svg'), fullSVG);

// ===== Desktop (Electron) =====
const desktopBuild = path.join(root, 'apps', 'desktop', 'build');
fs.mkdirSync(desktopBuild, { recursive: true });
write(path.join(desktopBuild, 'icon.png'), render(fullSVG, 512));
write(path.join(desktopBuild, 'icon.ico'), toIco(render(fullSVG, 256)));

// ===== Android =====
const res = path.join(root, 'apps', 'mobile', 'android', 'app', 'src', 'main', 'res');
const dpi = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fgDpi = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, s] of Object.entries(dpi)) {
  const dir = path.join(res, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'ic_launcher.png'), render(fullSVG, s));
  write(path.join(dir, 'ic_launcher_round.png'), render(roundSVG, s));
}
for (const [d, s] of Object.entries(fgDpi)) {
  const dir = path.join(res, `mipmap-${d}`);
  write(path.join(dir, 'ic_launcher_foreground.png'), render(foreSVG(0.62), s));
  write(path.join(dir, 'ic_launcher_background.png'), render(bgOnlySVG, s));
}
// adaptive 描述（anydpi-v26）：背景用同款渐变图，与桌面/Web 图标观感一致
const any = path.join(res, 'mipmap-anydpi-v26');
fs.mkdirSync(any, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
fs.writeFileSync(path.join(any, 'ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(any, 'ic_launcher_round.xml'), adaptive);
// 移除旧的纯色背景资源
const oldColor = path.join(res, 'values', 'ic_launcher_background.xml');
if (fs.existsSync(oldColor)) fs.rmSync(oldColor);

// splash（各 dpi 横/竖）
const splash = {
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [d, [w]] of Object.entries(splash)) {
  const dir = path.join(res, d);
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'splash.png'), render(splashSVG, w));
}

console.log(`生成完成: ${n} 个文件（web + desktop + android）`);
