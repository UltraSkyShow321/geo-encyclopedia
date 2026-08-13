const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: 'D:/OpenCodeProjects/geo-encyclopedia/server',
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3219' },
  stdio: 'ignore',
});
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 120)));
  await p.goto('http://127.0.0.1:3219/map', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 5000));
  await p.evaluate(() => {
    [...document.querySelectorAll('button')].find((e) => e.textContent.trim().includes('平面地图'))?.click();
  });
  await new Promise((r) => setTimeout(r, 5000));
  await p.evaluate(() => window.__leafletMap?.setView([-14, -51], 3));
  await new Promise((r) => setTimeout(r, 4000));
  const diag = await p.evaluate(() => {
    const m = window.__leafletMap;
    const pt = m.latLngToContainerPoint([-14, -51]);
    const rect = m.getContainer().getBoundingClientRect();
    const x = rect.left + pt.x;
    const y = rect.top + pt.y;
    const el = document.elementFromPoint(x, y);
    const lId = el ? Object.keys(el).find((k) => k.startsWith('_leaflet_id')) : null;
    const layer = lId ? m._layers[el[lId]] : null;
    const feat = layer?.feature;
    return {
      clickAt: [Math.round(x), Math.round(y)],
      hitName: feat?.properties?.name_zh || feat?.properties?.name_en || null,
      hitSlug: feat?.properties?.slug || null,
      geomType: feat?.geometry?.type,
    };
  });
  console.log('点击命中:', JSON.stringify(diag));
  // 列出所有 slug 为空的 feature
  const empty = await p.evaluate(() => {
    const feats = window.__geoFeatures || [];
    return feats
      .filter((f) => !f.properties.slug)
      .map((f) => {
        const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
        let lat = 0, lng = 0;
        for (const p of ring) { lat += p[1]; lng += p[0]; }
        return { name: f.properties.name_en, id: f.id, n: ring.length, center: [Math.round(lng / ring.length * 10) / 10, Math.round(lat / ring.length * 10) / 10] };
      });
  });
  console.log('空slug特征:', JSON.stringify(empty));
  const point = diag.clickAt;
  await p.mouse.click(point[0], point[1]);
  await new Promise((r) => setTimeout(r, 4000));
  console.log('点击后 pathname:', await p.evaluate(() => location.pathname));
  await b.close();
  server.kill();
})();
