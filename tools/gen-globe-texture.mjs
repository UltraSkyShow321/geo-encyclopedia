// 从 world-atlas 边界数据生成等距圆柱投影世界贴图（供 3D 地球仪球体贴图，自托管无外网依赖）
// 用法: node tools/gen-globe-texture.mjs
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'server', 'package.json'));
const outFile = path.join(here, '..', 'web', 'public', 'globe-texture.png');

const W = 2048;
const H = 1024;

// ---- 最小 PNG 编码器 ----
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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 数据 ----
const topo = require('world-atlas/countries-110m.json');
const { feature } = require('topojson-client');
const fc = feature(topo, topo.objects.countries);

const CONTINENT_COLORS = {
  亚洲: [245, 158, 11], 非洲: [239, 68, 68], 欧洲: [59, 130, 246],
  北美洲: [16, 185, 129], 南美洲: [139, 92, 246], 大洋洲: [6, 182, 212], 南极洲: [100, 116, 139],
};
const OCEAN = [10, 25, 47]; // 深蓝黑
const FALLBACK_LAND = [51, 65, 85];

// slug -> continent
import fs2 from 'node:fs';
const countriesDir = path.join(here, '..', 'content', 'countries');
const isoToContinent = new Map();
for (const f of fs2.readdirSync(countriesDir)) {
  if (!f.endsWith('.md')) continue;
  const raw = fs2.readFileSync(path.join(countriesDir, f), 'utf8');
  const iso = raw.match(/^iso_numeric: (\w+)/m)?.[1];
  const continent = raw.match(/^continent: (.+)$/m)?.[1];
  if (iso && continent) isoToContinent.set(iso, continent.trim());
}

function colorOf(feature) {
  const c = isoToContinent.get(String(feature.id ?? ''));
  return CONTINENT_COLORS[c] || FALLBACK_LAND;
}

// ---- 光栅化 ----
const px = new Uint8Array(W * H * 4);
// 海洋底色
for (let i = 0; i < W * H; i++) { px[i * 4] = OCEAN[0]; px[i * 4 + 1] = OCEAN[1]; px[i * 4 + 2] = OCEAN[2]; px[i * 4 + 3] = 255; }

// 等距圆柱: lon = x/W*360 - 180 ; lat = 90 - y/H*180
function pointInPoly(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringBBox(ring) {
  let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
  for (const [x, y] of ring) {
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  return { xmin, xmax, ymin, ymax };
}

let drawn = 0;
for (const f of fc.features) {
  const color = colorOf(f);
  const geoms = f.geometry.type === 'Polygon' ? [f.geometry] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })) : [];
  for (const g of geoms) {
    const ring = g.coordinates[0];
    if (!ring || ring.length < 3) continue;
    const b = ringBBox(ring);
    if (b.xmax - b.xmin > 180) continue; // 跨日期线，跳过（贴图用陆地主体即可）
    const x0 = Math.max(0, Math.floor(((b.xmin + 180) / 360) * W));
    const x1 = Math.min(W - 1, Math.ceil(((b.xmax + 180) / 360) * W));
    const y0 = Math.max(0, Math.floor(((90 - b.ymax) / 180) * H));
    const y1 = Math.min(H - 1, Math.ceil(((90 - b.ymin) / 180) * H));
    for (let y = y0; y <= y1; y++) {
      const lat = 90 - (y / H) * 180;
      for (let x = x0; x <= x1; x++) {
        const lon = (x / W) * 360 - 180;
        if (pointInPoly(lon, lat, ring)) {
          const i = (y * W + x) * 4;
          px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = 255;
        }
      }
    }
  }
  drawn++;
}

console.log(`光栅化完成: ${drawn} 个 feature`);
fs.writeFileSync(outFile, encodePng(W, H, px));
console.log('贴图已写入:', outFile, (fs.statSync(outFile).size / 1024).toFixed(0) + 'KB');
