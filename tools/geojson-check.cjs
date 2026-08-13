// 检查切分后的 geojson 是否存在仍跨日期线/贴边的环
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: 'D:/OpenCodeProjects/geo-encyclopedia/server',
  env: { ...process.env, ADMIN_PASSWORD: 'test123', PORT: '3211' },
  stdio: 'ignore',
});
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const fc = await (await fetch('http://127.0.0.1:3211/api/geojson')).json();
  let issues = 0;
  for (const f of fc.features) {
    const geom = f.geometry;
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      const ring = poly[0];
      const lons = ring.map((p) => p[0]);
      const span = Math.max(...lons) - Math.min(...lons);
      const touchesBoth = Math.min(...lons) <= -179 && Math.max(...lons) >= 179;
      const maxJump = Math.max(...ring.map((p, i) => Math.abs(ring[(i + 1) % ring.length][0] - p[0])));
      if (span > 200 || touchesBoth || maxJump > 180) {
        issues++;
        console.log(`${f.properties.slug || f.properties.name_en} | span=${span.toFixed(1)} 触碰双端=${touchesBoth} 最大跳变=${maxJump.toFixed(1)}`);
      }
    }
  }
  console.log(issues === 0 ? '全部环正常 ✓' : `发现 ${issues} 个异常环`);
  child.kill();
})();
