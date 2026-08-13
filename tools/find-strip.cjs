// 网格聚类深蓝像素
const { createRequire } = require('node:module');
const require2 = createRequire('D:/OpenCodeProjects/geo-encyclopedia/web/package.json');
const fs = require('node:fs');
const { PNG } = require2('pngjs');
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width, height, data } = png;

const CELL = 80;
const grid = new Map();
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r < 95 && g < 130 && b > 150 && b - r > 80) {
      const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    }
  }
}
const cells = [...grid.entries()].sort((a, b) => b[1] - a[1]);
console.log('高密度区域 (x格,y格): 像素数');
for (const [k, n] of cells.slice(0, 12)) {
  const [cx, cy] = k.split(',').map(Number);
  console.log(`  x${cx * CELL}-${cx * CELL + CELL} y${cy * CELL}-${cy * CELL + CELL}: ${n}`);
}
