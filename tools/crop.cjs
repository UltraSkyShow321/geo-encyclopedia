// 裁剪截图区域供视觉模型辨认
const { createRequire } = require('node:module');
const require2 = createRequire('D:/OpenCodeProjects/geo-encyclopedia/web/package.json');
const fs = require('node:fs');
const { PNG } = require2('pngjs');

const [file, x0, y0, w, h, out] = [
  process.argv[2], Number(process.argv[3]), Number(process.argv[4]),
  Number(process.argv[5]), Number(process.argv[6]), process.argv[7],
];
const src = PNG.sync.read(fs.readFileSync(file));
const dst = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * src.width + (x0 + x)) * 4;
    const di = (y * w + x) * 4;
    dst.data[di] = src.data[si];
    dst.data[di + 1] = src.data[si + 1];
    dst.data[di + 2] = src.data[si + 2];
    dst.data[di + 3] = 255;
  }
}
fs.writeFileSync(out, PNG.sync.write(dst));
console.log('saved', out);
