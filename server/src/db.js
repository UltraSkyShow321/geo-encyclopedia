import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'geo.db'));
db.exec('PRAGMA journal_mode=WAL');
db.exec('PRAGMA synchronous=NORMAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    title_zh TEXT NOT NULL,
    title_en TEXT NOT NULL,
    data TEXT NOT NULL,
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    updated_at INTEGER NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    slug, title_zh, title_en, search_text, tokenize='trigram'
  );
  CREATE TABLE IF NOT EXISTS favorites (
    slug TEXT PRIMARY KEY,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    next_review INTEGER NOT NULL,
    interval_days INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

const stmts = {
  itemBySlug: db.prepare('SELECT * FROM items WHERE slug = ?'),
  itemsAll: db.prepare('SELECT * FROM items'),
  insertItem: db.prepare(
    'INSERT INTO items(slug, type, title_zh, title_en, data, search_text, status, updated_at) VALUES (?,?,?,?,?,?,?,?)'
  ),
  insertFts: db.prepare('INSERT INTO items_fts(slug, title_zh, title_en, search_text) VALUES (?,?,?,?)'),
  deleteAll: db.prepare('DELETE FROM items'),
  deleteAllFts: db.prepare('DELETE FROM items_fts'),
  ftsMatch: db.prepare(
    "SELECT slug, title_zh, title_en, bm25(items_fts) AS score FROM items_fts WHERE items_fts MATCH ? ORDER BY score LIMIT 50"
  ),
  likeMatch: db.prepare(
    'SELECT slug, title_zh, title_en FROM items WHERE title_zh LIKE ? OR title_en LIKE ? OR search_text LIKE ? ORDER BY title_zh LIMIT 100'
  ),
  insertFavorite: db.prepare(
    'INSERT INTO favorites(slug, note, created_at, updated_at) VALUES (?,?,?,?) ON CONFLICT(slug) DO UPDATE SET note=excluded.note, updated_at=excluded.updated_at'
  ),
  deleteFavorite: db.prepare('DELETE FROM favorites WHERE slug = ?'),
  favoritesAll: db.prepare('SELECT * FROM favorites ORDER BY updated_at DESC'),
  insertSession: db.prepare('INSERT INTO sessions(token, created_at, expires_at) VALUES (?,?,?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  sessionByToken: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  cleanupSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  insertCard: db.prepare(
    'INSERT INTO cards(slug, question, answer, next_review, interval_days, streak, created_at) VALUES (?,?,?,?,?,?,?)'
  ),
  updateCard: db.prepare('UPDATE cards SET next_review=?, interval_days=?, streak=? WHERE id=?'),
  deleteCard: db.prepare('DELETE FROM cards WHERE id = ?'),
  cardById: db.prepare('SELECT * FROM cards WHERE id = ?'),
  cardsAll: db.prepare('SELECT * FROM cards ORDER BY next_review ASC'),
};

export function parseItem(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    type: row.type,
    title_zh: row.title_zh,
    title_en: row.title_en,
    status: row.status,
    updated_at: row.updated_at,
    ...JSON.parse(row.data),
  };
}

export { stmts };
