import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(__dirname, 'icon-source.svg'), 'utf8');
const out = path.join(__dirname, 'preview-512.png');
const res = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
const png = res.render().asPng();
fs.writeFileSync(out, png);
console.log('preview:', out, (png.length / 1024).toFixed(1) + 'KB');
