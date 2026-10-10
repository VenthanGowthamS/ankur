'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent','family','child')),
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  dob TEXT,
  bio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  level TEXT,
  result TEXT,
  subject TEXT,
  score TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entries_child_date ON entries(child_id, date DESC);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  original TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_entry ON media(entry_id);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  schedule TEXT,
  provider TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','done','skipped')),
  result TEXT,
  notes TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_child_date ON events(child_id, date);
CREATE TABLE IF NOT EXISTS buddies (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  target TEXT,
  due TEXT,
  status TEXT NOT NULL DEFAULT 'working',
  notes TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS ladder (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','preparing','passed')),
  date TEXT,
  score TEXT,
  notes TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
`;

// Default exam ladder seeded for every new child. Edit freely in the app.
const CAMBRIDGE_LADDER = [
  'Pre A1 Starters',
  'A1 Movers',
  'A2 Flyers',
  'A2 Key (KET)',
  'B1 Preliminary (PET)',
];

// Databases created before the 'child' role existed get their users table rebuilt in place.
function migrate(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
  if (!row || row.sql.includes("'child'")) return;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`CREATE TABLE users_new (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('parent','family','child')),
      child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
    db.exec(`INSERT INTO users_new (id, name, email, password_hash, role, created_at)
             SELECT id, name, email, password_hash, role, created_at FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  db.exec('PRAGMA foreign_keys = ON');
}

function ensureColumn(db, table, column, ddl) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function openDb(dataDir) {
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'ankur.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  db.exec(SCHEMA);
  for (const t of ['entries', 'events', 'activities']) ensureColumn(db, t, 'is_sample', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'entries', 'level', 'TEXT');
  ensureColumn(db, 'entries', 'result', 'TEXT');
  ensureColumn(db, 'entries', 'subject', 'TEXT');
  ensureColumn(db, 'entries', 'score', 'TEXT');
  ensureColumn(db, 'entries', 'role', 'TEXT'); // leadership/responsibility, e.g. Team captain, Class monitor
  ensureColumn(db, 'entries', 'authorship', 'TEXT'); // who made it: own | help | ai (NULL = not stated)
  ensureColumn(db, 'children', 'psle_year', 'INTEGER'); // optional; otherwise estimated from date of birth
  ensureColumn(db, 'children', 'buddy_id', 'INTEGER'); // the Buddy picture this child chose; NULL = Ankur the sprout
  return db;
}

function seedLadder(db, childId) {
  const ins = db.prepare(
    'INSERT INTO ladder (child_id, track, level, status, sort) VALUES (?, ?, ?, ?, ?)'
  );
  CAMBRIDGE_LADDER.forEach((level, i) => ins.run(childId, 'Cambridge English', level, 'planned', i));
}

function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDb, seedLadder, tx };
