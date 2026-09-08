import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.VERTOC_DB || join(__dirname, 'data', 'content.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'Agro',
    summary       TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    image         TEXT NOT NULL DEFAULT '',
    origin        TEXT NOT NULL DEFAULT '',
    processing    TEXT NOT NULL DEFAULT '',
    packaging     TEXT NOT NULL DEFAULT '',
    moq           TEXT NOT NULL DEFAULT '',
    grade         TEXT NOT NULL DEFAULT '',
    hs_code       TEXT NOT NULL DEFAULT '',
    applications  TEXT NOT NULL DEFAULT '[]',
    certifications TEXT NOT NULL DEFAULT '[]',
    specs         TEXT NOT NULL DEFAULT '[]',
    featured      INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'published',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    excerpt       TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    category      TEXT NOT NULL DEFAULT 'Insights',
    image         TEXT NOT NULL DEFAULT '',
    author        TEXT NOT NULL DEFAULT 'Vertoc Agro',
    read_time     TEXT NOT NULL DEFAULT '5 min read',
    status        TEXT NOT NULL DEFAULT 'published',
    published_at  TEXT NOT NULL DEFAULT (date('now')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT NOT NULL DEFAULT 'contact',
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    phone        TEXT NOT NULL DEFAULT '',
    subject      TEXT NOT NULL DEFAULT '',
    message      TEXT NOT NULL DEFAULT '',
    commodity    TEXT NOT NULL DEFAULT '',
    quantity     TEXT NOT NULL DEFAULT '',
    destination  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'new',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
`)

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
