import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, stmts } from './db.js';
import { parseFrontmatter } from './frontmatter.js';
import { renderMarkdown, stripMarkdown } from './render.js';
import { seedCountries, seedTopics } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = process.env.CONTENT_DIR || path.join(__dirname, '..', '..', 'content');

export function importContent() {
  const items = loadFromDisk();
  const seeded = items.length === 0;
  if (seeded) items.push(...seedCountries, ...seedTopics);

  db.exec('BEGIN');
  try {
    stmts.deleteAll.run();
    stmts.deleteAllFts.run();
    for (const it of items) insertItem(it);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const geoCache = path.join(dataDir, 'world-geojson.json');
  if (fs.existsSync(geoCache)) fs.unlinkSync(geoCache);
  const counts = db
    .prepare('SELECT type, status, COUNT(*) n FROM items GROUP BY type, status')
    .all();
  return { seeded, total: items.length, counts };
}

function loadFromDisk() {
  const items = [];
  for (const [dir, type] of [
    ['countries', 'country'],
    ['topics', 'topic'],
  ]) {
    const dirPath = path.join(contentRoot, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).sort()) {
      if (!file.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      if (!meta.slug && !meta.name_zh && !meta.title_zh) continue;
      items.push({ slug: meta.slug || meta.name_zh || meta.title_zh, type, meta, body });
    }
  }
  return items;
}

function insertItem(it) {
  const meta = it.meta;
  const slug = String(it.slug).toLowerCase().replace(/\s+/g, '-');
  const type = (it.meta.type || it.type) === 'country' ? 'country' : 'topic';
  const title_zh = meta.name_zh || meta.title_zh || slug;
  const title_en = meta.name_en || meta.title_en || slug;
  const bodyHtml = renderMarkdown(it.body);
  const plain = stripMarkdown(it.body);
  const data = { ...meta, slug, body: it.body, bodyHtml };
  const searchText = [title_zh, title_en, meta.capital_zh, meta.capital_en, meta.continent, plain]
    .filter((s) => typeof s === 'string' && s)
    .join(' ')
    .slice(0, 20000);
  const status = meta.status || 'draft';
  stmts.insertItem.run(slug, type, title_zh, title_en, JSON.stringify(data), searchText, status, Date.now());
  stmts.insertFts.run(slug, title_zh, title_en, searchText);
}
