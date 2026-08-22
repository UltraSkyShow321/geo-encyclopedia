import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseItem, stmts } from '../db.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 50m 高精度边界（轮廓/卫星图 bbox 用）
let fc50 = null;
function getFC50() {
  if (!fc50) {
    const topo = require('world-atlas/countries-50m.json');
    const { feature } = require('topojson-client');
    fc50 = feature(topo, topo.objects.countries);
  }
  return fc50;
}

function dataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}

function findFeature50(slugOrIso) {
  const item = parseItem(stmts.itemBySlug.get(String(slugOrIso).toLowerCase()));
  if (!item || item.type !== 'country') return null;
  const iso = String(item.iso_numeric || '').padStart(3, '0');
  const feature = getFC50().features.find((f) => String(f.id ?? '').padStart(3, '0') === iso);
  return feature ? { feature, item } : null;
}

// 收集所有外环（保持原始经度，不做 +360 位移）
function rawOuterRings(geom) {
  const rings = [];
  if (geom.type === 'Polygon') rings.push(geom.coordinates[0]);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p) => rings.push(p[0]));
  return rings;
}

// 收集所有外环（含日期线切开的多边形），返回按 +360 位移后互不跨越的环
function outerRings(geom) {
  const rings = [];
  if (geom.type === 'Polygon') rings.push(geom.coordinates[0]);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p) => rings.push(p[0]));

  // 切割跨日期线的环（±180 处插入插值点）
  const out = [];
  for (const ring of rings) {
    let crosses = false;
    for (let i = 0; i < ring.length; i++) {
      if (Math.abs(ring[(i + 1) % ring.length][0] - ring[i][0]) > 180) { crosses = true; break; }
    }
    if (!crosses) { out.push(ring); continue; }
    const parts = [[]];
    let cur = parts[0];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const n = ring[(i + 1) % ring.length];
      cur.push(p);
      if (Math.abs(n[0] - p[0]) > 180) {
        const crossLon = p[0] > 0 ? 180 : -180;
        const t = (crossLon - p[0]) / (n[0] - p[0]);
        cur.push([crossLon, p[1] + (n[1] - p[1]) * t]);
        parts.push([]);
        cur = parts[parts.length - 1];
        cur.push([-crossLon, p[1] + (n[1] - p[1]) * t]);
      }
    }
    out.push(
      ...parts
        .filter((r) => r.length >= 3)
        .map((r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]))
    );
  }
  // 负经度 +360 位移，使跨日期线的各部分连续（lon 0..360）
  return out.map((r) => r.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]));
}

function boundsOf(rings) {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  return { xmin, ymin, xmax, ymax };
}

export function registerMapAssetsRoutes(app) {
  // 前端公共配置（仅暴露非敏感项）
  app.get('/api/config', (req, reply) => {
    return {
      amapKey: process.env.AMAP_KEY || process.env['AMAP-KEY'] || '',
      amapSecurityCode: process.env.AMAP_SECURITY_CODE || process.env['AMAP-SECURITY-CODE'] || '',
    };
  });

  // 反查坐标所属国家（高德/任意地图点击跳转用）
  app.get('/api/country-at', (req, reply) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      reply.code(400).send({ error: 'bad coords' });
      return;
    }
    // 与 geojson 服务一致的匹配表：ISO 补零 + 名称兜底
    const itemMap = new Map();
    const byName = new Map();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, '');
    for (const row of stmts.itemsAll.all()) {
      const it = parseItem(row);
      if (it.type !== 'country') continue;
      if (it.iso_numeric) itemMap.set(String(it.iso_numeric).padStart(3, '0'), it);
      if (it.name_en) byName.set(norm(it.name_en), it);
      if (it.name_zh) byName.set(norm(it.name_zh), it);
    }
    const lookup = (f) => {
      const id = String(f.id ?? '').padStart(3, '0');
      if (itemMap.has(id)) return itemMap.get(id);
      return byName.get(norm(f.properties?.name)) || null;
    };

    let hit = null;
    for (const f of getFC50().features) {
      const rings = f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates[0]]
        : f.geometry.coordinates.map((p) => p[0]);
      // bbox 预筛
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      for (const r of rings) {
        for (const [x, y] of r) {
          if (x < xmin) xmin = x; if (x > xmax) xmax = x;
          if (y < ymin) ymin = y; if (y > ymax) ymax = y;
        }
      }
      if (lng < xmin || lng > xmax || lat < ymin || lat > ymax) continue;
      for (const ring of rings) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
          if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) { hit = f; break; }
      }
      if (hit) break;
    }
    if (!hit) {
      reply.send({ slug: null, name_zh: null });
      return;
    }
    const item = lookup(hit);
    reply.send({
      slug: item?.slug || null,
      name_zh: item?.name_zh || null,
    });
  });

  // 标志性地貌标注数据
  app.get('/api/landforms', (req, reply) => {
    const file = path.join(process.env.CONTENT_DIR || path.join(__dirname, '..', '..', '..', 'content'), 'metadata', 'landforms.json');
    if (!fs.existsSync(file)) {
      reply.code(404).send({ error: 'landforms not found' });
      return;
    }
    return reply.type('application/json').header('cache-control', 'public, max-age=86400').send(JSON.parse(fs.readFileSync(file, 'utf8')));
  });

  // 国家轮廓 SVG（50m 精度，等比投影，日期线安全）
  app.get('/api/country-svg/:slug', (req, reply) => {
    const hit = findFeature50(req.params.slug);
    if (!hit) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const rings = outerRings(hit.feature.geometry);
    const { xmin, ymin, xmax, ymax } = boundsOf(rings);
    if (!isFinite(xmax - xmin) || xmax <= xmin || ymax <= ymin) {
      reply.code(404).send({ error: 'bad geometry' });
      return;
    }
    const W = 600;
    const rawH = 300;
    const k = Math.min(W / (xmax - xmin), rawH / (ymax - ymin));
    const H = Math.max(rawH, Math.ceil((ymax - ymin) * k) + 4);
    const ox = (W - (xmax - xmin) * k) / 2;
    const oy = (H - (ymax - ymin) * k) / 2;
    const px = (x) => (ox + (x - xmin) * k).toFixed(1);
    const py = (y) => (H - oy - (y - ymin) * k).toFixed(1);

    const paths = rings.map((ring) => {
      let d = '';
      for (const [i, [x, y]] of ring.entries()) d += (i === 0 ? 'M' : 'L') + px(x) + ' ' + py(y) + ' ';
      return d + 'Z';
    });

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">` +
      `<path d="${paths.join(' ')}" fill="#6366f1" fill-opacity="0.85" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>` +
      `</svg>`;
    return reply.type('image/svg+xml').header('cache-control', 'public, max-age=86400').send(svg);
  });

  // 静态地图（卫星/地形/区划）: 服务端代理 ArcGIS export，bbox 日期线安全
  app.get('/api/staticmap/:slug', async (req, reply) => {
    const hit = findFeature50(req.params.slug);
    if (!hit) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const layer = ['imagery', 'terrain', 'street'].includes(req.query.layer) ? req.query.layer : 'imagery';
    const service = { imagery: 'World_Imagery', terrain: 'World_Topo_Map', street: 'World_Street_Map' }[layer];
    // 支持 center=lat,lng&span=度数（首都等局部区域截图）
    let rings = null;
    let b = null;
    if (req.query.center) {
      const [clat, clng] = String(req.query.center).split(',').map(Number);
      const span = Math.max(Number(req.query.span || 2), 0.5);
      if (!isFinite(clat) || !isFinite(clng)) {
        reply.code(400).send({ error: 'bad center' });
        return;
      }
      b = { xmin: clng - span, xmax: clng + span, ymin: clat - span, ymax: clat + span };
    } else {
      // 用原始坐标算 bbox（不做 +360 位移）。
      // 位移是为绘制轮廓用的，会让美国(-179..-66)变成(181..294)，导致 ArcGIS bbox 被截断成错误区域
      const rawRings = rawOuterRings(hit.feature.geometry);
      const bb = boundsOf(rawRings);
      let { xmin, xmax } = bb;
      // 真正跨日期线的国家（如俄罗斯/斐济/基里巴斯）：原始坐标同时含接近 ±180 的值且跨度 > 180，
      // 以国家人口/面积主体所在侧为准：把 >180 或 <-180 的环平移到连续一侧
      if (xmax - xmin > 180) {
        // 尝试整体 -360（把东经部分移到西侧），取跨度更小的方案
        let minX2 = Infinity, maxX2 = -Infinity;
        for (const r of rawRings) {
          const shifted = r.every(([x]) => x > 0) ? r.map(([x, y]) => [x - 360, y]) : r;
          for (const [x] of shifted) { if (x < minX2) minX2 = x; if (x > maxX2) maxX2 = x; }
        }
        if (maxX2 - minX2 < xmax - xmin) { xmin = minX2; xmax = maxX2; }
      }
      const pad = 0.12;
      const w = Math.max(xmax - xmin, 0.5);
      const h = Math.max(bb.ymax - bb.ymin, 0.5);
      b = {
        xmin: Math.max(-180, xmin - w * pad),
        ymin: Math.max(-85, bb.ymin - h * pad),
        xmax: Math.min(180, xmax + w * pad),
        ymax: Math.min(85, bb.ymax + h * pad),
      };
    }
    b.xmin = Math.max(-180, b.xmin);
    b.xmax = Math.min(180, b.xmax);
    b.ymin = Math.max(-85, b.ymin);
    b.ymax = Math.min(85, b.ymax);
    if (b.xmax <= b.xmin) b.xmax = Math.min(180, b.xmin + 1);
    const dir = path.join(dataDir(), 'staticmap');
    fs.mkdirSync(dir, { recursive: true });
    const centerKey = req.query.center ? `-c${String(req.query.center).replace(/[^\d.-]/g, '')}` : '';
    const cacheFile = path.join(dir, `${req.params.slug}-${layer}-v2${centerKey}.png`);
    if (fs.existsSync(cacheFile)) {
      return reply.type('image/png').header('cache-control', 'public, max-age=86400').send(fs.readFileSync(cacheFile));
    }
    const url =
      `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export` +
      `?bbox=${b.xmin},${b.ymin},${b.xmax},${b.ymax}&bboxSR=4326&size=800,500&format=png&f=image`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        reply.code(502).send({ error: `upstream ${res.status}` });
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(cacheFile, buf);
      return reply.type('image/png').header('cache-control', 'public, max-age=86400').send(buf);
    } catch (e) {
      reply.code(502).send({ error: `upstream failed: ${e.message}` });
    }
  });
}
