// 采样截图中多个候选点的精确颜色
const { createRequire } = require('node:module');
const require2 = createRequire('D:/OpenCodeProjects/geo-encyclopedia/web/package.json');
const fs = require('node:fs');
const { PNG } = require2('pngjs');
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const { width, height, data } = png;

function sample(x, y) {
  const i = (y * width + x) * 4;
  return `(${data[i]},${data[i + 1]},${data[i + 2]})`;
}
// 上部右侧一带（白令海/远东）网格采样
for (const [x, y] of [[800, 120], [1000, 150], [1100, 200], [1200, 250], [1300, 180], [900, 300], [600, 400], [500, 200], [1000, 100]]) {
  console.log(`(${x},${y}) =`, sample(x, y));
}
console.log('图尺寸', width, 'x', height);
