import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'web', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size;
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= s || y >= s) return;
    const i = (y * s + x) * 4;
    const na = a / 255;
    px[i] = Math.round(r * na + px[i] * (1 - na));
    px[i + 1] = Math.round(g * na + px[i + 1] * (1 - na));
    px[i + 2] = Math.round(b * na + px[i + 2] * (1 - na));
    px[i + 3] = Math.max(px[i + 3], a);
  };

  const bg = [49, 46, 129];
  const fg = [241, 245, 249];
  const land = [129, 140, 248];

  // 背景圆
  const cx = s / 2;
  const cy = s / 2;
  const R = s * 0.46;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= R * R) {
        put(x, y, bg[0], bg[1], bg[2], 255);
      }
    }
  }

  // 经线纬线
  const graticule = (x, y, lon, lat) => {
    const dx = (x - cx) / R;
    const dy = (y - cy) / R;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1 || d < 0.02) return;
    const p = 1 - d;
    const lonP = Math.abs((lon * p) % 1);
    const latP = Math.abs(lat * p * 1.6);
    if (lonP < 0.02 || latP < 0.025) {
      put(x, y, fg[0], fg[1], fg[2], 36);
    }
  };
  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      graticule(x, y, ((x - cx) / R) * 0.5 + 0.5, ((y - cy) / R) * 0.5);
    }
  }

  // 简化大陆块（旋转椭圆）
  const ellipse = (e, rotDeg) => {
    const { ex, ey, rx, ry } = e;
    const rad = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x - ex;
        const dy = y - ey;
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        if ((lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1) {
          put(x, y, land[0], land[1], land[2], 235);
        }
      }
    }
  };

  const E = (fx, fy, rx, ry, rot) => ellipse({ ex: cx + fx * R, ey: cy + fy * R, rx: rx * R, ry: ry * R }, rot);
  E(-0.62, -0.28, 0.20, 0.16, -18); // 北美洲
  E(-0.55, 0.38, 0.10, 0.16, 10); // 南美洲
  E(-0.02, -0.42, 0.12, 0.10, -8); // 欧洲
  E(0.02, 0.10, 0.15, 0.19, 0); // 非洲
  E(0.42, -0.22, 0.26, 0.19, -14); // 亚洲
  E(0.52, 0.62, 0.12, 0.09, -28); // 大洋洲

  return encodePng(s, s, px);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="236" fill="#312e81"/>
  <g fill="none" stroke="#f1f5f9" stroke-opacity="0.14" stroke-width="3">
    <line x1="256" y1="20" x2="256" y2="492"/>
    <line x1="72" y1="256" x2="440" y2="256"/>
  </g>
  <g fill="#818cf8" fill-opacity="0.92">
    <ellipse cx="130" cy="185" rx="47" ry="38" transform="rotate(-18 130 185)"/>
    <ellipse cx="140" cy="345" rx="24" ry="38" transform="rotate(10 140 345)"/>
    <ellipse cx="255" cy="156" rx="28" ry="24" transform="rotate(-8 255 156)"/>
    <ellipse cx="258" cy="280" rx="36" ry="45"/>
    <ellipse cx="362" cy="152" rx="62" ry="45" transform="rotate(-14 362 152)"/>
    <ellipse cx="380" cy="404" rx="28" ry="22" transform="rotate(-28 380 404)"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(outDir, 'icon.svg'), svg);
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), drawIcon(size));
}
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), drawIcon(180));

// 桌面端图标 (Electron)
const desktopDir = path.join(__dirname, '..', 'apps', 'desktop', 'build');
fs.mkdirSync(desktopDir, { recursive: true });
fs.writeFileSync(path.join(desktopDir, 'icon.png'), drawIcon(512));

// .ico（内嵌 256 PNG，Vista+ 支持）
function toIco(png) {
  const size = Math.round(Math.sqrt(png.length / 4));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}
const icoPng = drawIcon(256);
fs.writeFileSync(path.join(desktopDir, 'icon.ico'), toIco(icoPng));

console.log('icons written to', outDir, 'and', desktopDir);
