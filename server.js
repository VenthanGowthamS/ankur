'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { openDb, seedLadder, tx } = require('./db');

const CATEGORIES = ['art', 'speech', 'exam', 'hindi', 'accolade', 'school', 'other'];
const SESSION_DAYS = 90; // sliding: every visit renews it, so regular use never signs you out
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/webm': '.weba', 'audio/ogg': '.ogg',
  'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
  'application/pdf': '.pdf',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Field specs drive validation for the simple CRUD resources.
const RESOURCES = {
  activities: {
    table: 'activities',
    order: 'active DESC, name COLLATE NOCASE',
    fields: {
      name: { type: 'str', max: 120, req: true },
      category: { type: 'enum', values: CATEGORIES },
      schedule: { type: 'str', max: 200 },
      provider: { type: 'str', max: 120 },
      notes: { type: 'str', max: 2000 },
      active: { type: 'bool' },
    },
  },
  events: {
    table: 'events',
    order: 'date ASC, id ASC',
    fields: {
      title: { type: 'str', max: 160, req: true },
      date: { type: 'date', req: true },
      kind: { type: 'enum', values: ['contest', 'exam', 'performance', 'school', 'other'] },
      location: { type: 'str', max: 160 },
      status: { type: 'enum', values: ['upcoming', 'done', 'skipped'] },
      result: { type: 'str', max: 300 },
      notes: { type: 'str', max: 2000 },
    },
  },
  ladder: {
    table: 'ladder',
    order: 'track COLLATE NOCASE, sort ASC, id ASC',
    fields: {
      track: { type: 'str', max: 80, req: true },
      level: { type: 'str', max: 80, req: true },
      status: { type: 'enum', values: ['planned', 'preparing', 'passed'] },
      date: { type: 'date' },
      score: { type: 'str', max: 120 },
      notes: { type: 'str', max: 2000 },
      sort: { type: 'int' },
    },
  },
};

const ENTRY_FIELDS = {
  title: { type: 'str', max: 160, req: true },
  category: { type: 'enum', values: CATEGORIES, req: true },
  date: { type: 'date', req: true },
  notes: { type: 'str', max: 5000 },
};

const CHILD_FIELDS = {
  name: { type: 'str', max: 120, req: true },
  nickname: { type: 'str', max: 60 },
  dob: { type: 'date' },
  bio: { type: 'str', max: 2000 },
};

// Returns an object of validated column values. With partial=true, only the
// fields present in the body are returned (used for updates).
function parseFields(spec, body, partial = false) {
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    const present = body && body[key] !== undefined;
    if (!present) {
      if (rule.req && !partial) throw new HttpError(400, `${key} is required`);
      continue;
    }
    let v = body[key];
    if (rule.type === 'bool') {
      out[key] = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
      continue;
    }
    if (rule.type === 'int') {
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n)) throw new HttpError(400, `${key} must be a number`);
      out[key] = n;
      continue;
    }
    v = v == null ? '' : String(v).trim();
    if (v === '') {
      if (rule.req) throw new HttpError(400, `${key} is required`);
      out[key] = null;
      continue;
    }
    if (rule.type === 'date' && !DATE_RE.test(v)) throw new HttpError(400, `${key} must be YYYY-MM-DD`);
    if (rule.type === 'enum' && !rule.values.includes(v)) throw new HttpError(400, `${key} is invalid`);
    if (rule.max && v.length > rule.max) throw new HttpError(400, `${key} is too long`);
    out[key] = v;
  }
  return out;
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createApp({ dataDir, cookieSecure = false } = {}) {
  dataDir = dataDir || process.env.ANKUR_DATA_DIR || path.join(__dirname, 'data');
  const uploadDir = path.join(dataDir, 'uploads');
  const db = openDb(dataDir);
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

  // ---- security headers: this is a private app, keep it out of search engines and frames
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
        "style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
    next();
  });
  app.use(express.json({ limit: '200kb' }));

  // ---- sessions
  const sessionCookie = (token, maxAge) =>
    `ankur_sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${cookieSecure ? '; Secure' : ''}`;
  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const maxAge = SESSION_DAYS * 86400;
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(sha256(token), userId, Date.now() + maxAge * 1000);
    res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
  }
  function endSession(req, res) {
    const token = getCookie(req, 'ankur_sid');
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.setHeader('Set-Cookie', `ankur_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${cookieSecure ? '; Secure' : ''}`);
  }
  app.use((req, res, next) => {
    const token = getCookie(req, 'ankur_sid');
    req.user = null;
    if (token) {
      const row = db.prepare(
        `SELECT u.id, u.name, u.email, u.role, u.child_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`
      ).get(sha256(token), Date.now());
      if (row) {
        const { expires_at: expiresAt, ...user } = row;
        req.user = user;
        // Sliding session: renew once a day of use, so you stay signed in as long as you keep coming back.
        if (expiresAt - Date.now() < (SESSION_DAYS - 1) * 864e5) {
          db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() + SESSION_DAYS * 864e5, sha256(token));
          res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 86400));
        }
      }
    }
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Please sign in')));
  const requireParent = (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (req.user.role !== 'parent') return next(new HttpError(403, 'Parents only'));
    next();
  };

  // ---- login throttling (per IP, in memory)
  const attempts = new Map();
  function throttle(req) {
    const now = Date.now();
    const rec = attempts.get(req.ip);
    if (!rec || rec.reset < now) { attempts.set(req.ip, { count: 0, reset: now + 15 * 60 * 1000 }); return attempts.get(req.ip); }
    return rec;
  }

  const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const cleanEmail = (v) => String(v || '').trim().toLowerCase();
  function checkCreds({ name, email, password }) {
    name = String(name || '').trim();
    email = cleanEmail(email);
    if (!name || name.length > 80) throw new HttpError(400, 'Name is required');
    // The sign-in name can be an email or a simple username (letters, numbers, . _ -).
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/^[a-z0-9._-]{3,40}$/.test(email)) throw new HttpError(400, 'Use an email, or a simple username (3+ letters or numbers, no spaces)');
    if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    return { name, email };
  }

  // ---- auth routes
  app.get('/api/me', (req, res) => {
    res.json({ user: req.user, needsSetup: userCount() === 0 });
  });

  app.post('/api/setup', (req, res) => {
    const { name, email } = checkCreds(req.body);
    const hash = bcrypt.hashSync(req.body.password, 10);
    const childName = String(req.body.childName || '').trim();
    if (!childName) throw new HttpError(400, 'Child name is required');
    const child = parseFields(CHILD_FIELDS, { name: childName, dob: req.body.childDob });
    const userId = tx(db, () => {
      if (userCount() > 0) throw new HttpError(403, 'Setup is already complete');
      const u = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(name, email, hash, 'parent');
      const c = db.prepare('INSERT INTO children (name, dob) VALUES (?, ?)').run(child.name, child.dob ?? null);
      seedLadder(db, Number(c.lastInsertRowid));
      return Number(u.lastInsertRowid);
    });
    startSession(res, userId);
    res.status(201).json({ user: { id: userId, name, email, role: 'parent' } });
  });

  app.post('/api/login', (req, res) => {
    const rec = throttle(req);
    if (rec.count >= 10) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
    const email = cleanEmail(req.body.email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = bcrypt.compareSync(String(req.body.password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) { rec.count++; throw new HttpError(401, 'Wrong email or password'); }
    attempts.delete(req.ip);
    startSession(res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, child_id: user.child_id } });
  });

  app.post('/api/logout', (req, res) => { endSession(req, res); res.json({ ok: true }); });

  app.post('/api/me/password', requireAuth, (req, res) => {
    const { current, next: nextPw } = req.body || {};
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(String(current || ''), row.password_hash)) throw new HttpError(400, 'Current password is wrong');
    if (typeof nextPw !== 'string' || nextPw.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(nextPw, 10), req.user.id);
    res.json({ ok: true });
  });

  // ---- family accounts (parents manage who can view)
  app.get('/api/users', requireParent, (req, res) => {
    res.json(db.prepare('SELECT id, name, email, role, child_id, created_at FROM users ORDER BY id').all());
  });
  app.post('/api/users', requireParent, (req, res) => {
    const role = ['parent', 'family', 'child'].includes(req.body.role) ? req.body.role : 'family';
    let name, email, childId = null;
    if (role === 'child') {
      // Kids sign in with a simple username and a short password set by a parent.
      name = String(req.body.name || '').trim();
      email = String(req.body.email || '').trim().toLowerCase();
      if (!name || name.length > 80) throw new HttpError(400, 'Name is required');
      if (!/^[a-z0-9._-]{3,30}$/.test(email)) throw new HttpError(400, 'Username: 3–30 letters or numbers, no spaces');
      if (typeof req.body.password !== 'string' || req.body.password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      childId = Number(req.body.childId);
      if (!getChild(childId)) throw new HttpError(400, 'Choose which child this login is for');
    } else {
      ({ name, email } = checkCreds(req.body));
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(409, 'That email or username is already taken');
    const r = db.prepare('INSERT INTO users (name, email, password_hash, role, child_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, bcrypt.hashSync(req.body.password, 10), role, childId);
    res.status(201).json({ id: Number(r.lastInsertRowid), name, email, role, child_id: childId });
  });
  app.delete('/api/users/:id', requireParent, (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, "You can't remove yourself");
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ---- children
  const getChild = (id) => db.prepare('SELECT * FROM children WHERE id = ?').get(Number(id));
  function childParam(req, res, next) {
    const child = getChild(req.params.cid);
    if (!child) return next(new HttpError(404, 'Child not found'));
    if (req.user && req.user.role === 'child' && req.user.child_id !== child.id) return next(new HttpError(403, 'Not your profile'));
    req.child = child;
    next();
  }
  app.get('/api/children', requireAuth, (req, res) => {
    if (req.user.role === 'child') return res.json(db.prepare('SELECT * FROM children WHERE id = ?').all(req.user.child_id));
    res.json(db.prepare('SELECT * FROM children ORDER BY id').all());
  });
  app.post('/api/children', requireParent, (req, res) => {
    const v = parseFields(CHILD_FIELDS, req.body);
    const id = tx(db, () => {
      const r = db.prepare('INSERT INTO children (name, nickname, dob, bio) VALUES (?, ?, ?, ?)')
        .run(v.name, v.nickname ?? null, v.dob ?? null, v.bio ?? null);
      seedLadder(db, Number(r.lastInsertRowid));
      return Number(r.lastInsertRowid);
    });
    res.status(201).json(getChild(id));
  });
  app.put('/api/children/:cid', requireParent, childParam, (req, res) => {
    const v = parseFields(CHILD_FIELDS, req.body, true);
    updateRow('children', req.child.id, v);
    res.json(getChild(req.child.id));
  });

  function updateRow(table, id, values) {
    const keys = Object.keys(values);
    if (!keys.length) return;
    db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => values[k]), id);
  }

  // ---- uploads
  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (MIME_EXT[file.mimetype] || '')),
  });
  const upload = multer({
    storage,
    limits: { fileSize: 80 * 1024 * 1024, files: 8 },
    fileFilter: (req, file, cb) =>
      MIME_EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, `Unsupported file type: ${file.mimetype}`)),
  });
  const discard = (files) => (files || []).forEach((f) => fs.rm(f.path, { force: true }, () => {}));
  const removeFile = (name) => fs.rm(path.join(uploadDir, name), { force: true }, () => {});
  function saveMedia(entryId, files) {
    const ins = db.prepare('INSERT INTO media (entry_id, file, original, mime, size) VALUES (?, ?, ?, ?, ?)');
    for (const f of files || []) {
      ins.run(entryId, f.filename, String(f.originalname || '').slice(0, 200), f.mimetype, f.size);
    }
  }
  const mediaFor = (entryIds) => {
    if (!entryIds.length) return new Map();
    const rows = db.prepare(
      `SELECT id, entry_id, original, mime, size FROM media WHERE entry_id IN (${entryIds.map(() => '?').join(',')}) ORDER BY id`
    ).all(...entryIds);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.entry_id)) map.set(r.entry_id, []);
      map.get(r.entry_id).push({ id: r.id, original: r.original, mime: r.mime, size: r.size });
    }
    return map;
  };
  const entryWithMedia = (id) => {
    const e = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
    if (!e) return null;
    return { ...e, media: mediaFor([e.id]).get(e.id) || [] };
  };

  // ---- portfolio entries
  app.get('/api/children/:cid/entries', requireAuth, childParam, (req, res) => {
    const cat = req.query.category;
    const rows = cat && CATEGORIES.includes(cat)
      ? db.prepare('SELECT * FROM entries WHERE child_id = ? AND category = ? ORDER BY date DESC, id DESC').all(req.child.id, cat)
      : db.prepare('SELECT * FROM entries WHERE child_id = ? ORDER BY date DESC, id DESC').all(req.child.id);
    const media = mediaFor(rows.map((r) => r.id));
    res.json(rows.map((r) => ({ ...r, media: media.get(r.id) || [] })));
  });

  app.post('/api/children/:cid/entries', requireParent, childParam, upload.array('files', 8), (req, res) => {
    try {
      const v = parseFields(ENTRY_FIELDS, req.body);
      const id = tx(db, () => {
        const r = db.prepare('INSERT INTO entries (child_id, category, title, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.child.id, v.category, v.title, v.date, v.notes ?? null, req.user.id);
        saveMedia(Number(r.lastInsertRowid), req.files);
        return Number(r.lastInsertRowid);
      });
      res.status(201).json(entryWithMedia(id));
    } catch (err) { discard(req.files); throw err; }
  });

  const entryParam = (req, res, next) => {
    const e = db.prepare('SELECT * FROM entries WHERE id = ?').get(Number(req.params.id));
    if (!e) return next(new HttpError(404, 'Entry not found'));
    req.entry = e;
    next();
  };
  app.put('/api/entries/:id', requireParent, entryParam, (req, res) => {
    updateRow('entries', req.entry.id, parseFields(ENTRY_FIELDS, req.body, true));
    res.json(entryWithMedia(req.entry.id));
  });
  app.post('/api/entries/:id/media', requireParent, entryParam, upload.array('files', 8), (req, res) => {
    try { saveMedia(req.entry.id, req.files); } catch (err) { discard(req.files); throw err; }
    res.status(201).json(entryWithMedia(req.entry.id));
  });
  app.delete('/api/entries/:id', requireParent, entryParam, (req, res) => {
    const files = db.prepare('SELECT file FROM media WHERE entry_id = ?').all(req.entry.id);
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.entry.id);
    files.forEach((f) => removeFile(f.file));
    res.json({ ok: true });
  });
  app.delete('/api/media/:id', requireParent, (req, res) => {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
    if (!m) throw new HttpError(404, 'File not found');
    db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
    removeFile(m.file);
    res.json({ ok: true });
  });

  // Media is only ever served to signed-in users — never from a public static path.
  app.get('/media/:id', requireAuth, (req, res, next) => {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
    if (!m) return next(new HttpError(404, 'File not found'));
    if (req.user.role === 'child') {
      const owner = db.prepare('SELECT child_id FROM entries WHERE id = ?').get(m.entry_id);
      if (!owner || owner.child_id !== req.user.child_id) return next(new HttpError(403, 'Not your file'));
    }
    res.setHeader('Content-Type', m.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(m.original || 'file')}`);
    res.sendFile(path.join(uploadDir, m.file), (err) => { if (err) next(err.status ? new HttpError(err.status, 'File missing') : err); });
  });

  // ---- parent-only resources: activities, events, exam ladder
  for (const [name, spec] of Object.entries(RESOURCES)) {
    app.get(`/api/children/:cid/${name}`, requireParent, childParam, (req, res) => {
      res.json(db.prepare(`SELECT * FROM ${spec.table} WHERE child_id = ? ORDER BY ${spec.order}`).all(req.child.id));
    });
    app.post(`/api/children/:cid/${name}`, requireParent, childParam, (req, res) => {
      const v = parseFields(spec.fields, req.body);
      const cols = ['child_id', ...Object.keys(v)];
      const r = db.prepare(`INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .run(req.child.id, ...Object.values(v));
      res.status(201).json(db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(Number(r.lastInsertRowid)));
    });
    app.put(`/api/${name}/:id`, requireParent, (req, res) => {
      const row = db.prepare(`SELECT id FROM ${spec.table} WHERE id = ?`).get(Number(req.params.id));
      if (!row) throw new HttpError(404, 'Not found');
      updateRow(spec.table, row.id, parseFields(spec.fields, req.body, true));
      res.json(db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(row.id));
    });
    app.delete(`/api/${name}/:id`, requireParent, (req, res) => {
      db.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).run(Number(req.params.id));
      res.json({ ok: true });
    });
  }

  // ---- Buddy: a few safe, read-only facts the kid-mode helper talks about. No free text in or out.
  app.get('/api/children/:cid/buddy', requireAuth, childParam, (req, res) => {
    const cid = req.child.id;
    const withThumb = (e) => {
      if (!e) return null;
      const m = db.prepare("SELECT id FROM media WHERE entry_id = ? AND mime LIKE 'image/%' ORDER BY id LIMIT 1").get(e.id);
      return { id: e.id, title: e.title, category: e.category, date: e.date, imageId: m ? m.id : null };
    };
    const counts = {};
    for (const r of db.prepare('SELECT category, COUNT(*) AS n FROM entries WHERE child_id = ? GROUP BY category').all(cid)) counts[r.category] = r.n;
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      name: req.child.nickname || req.child.name,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      counts,
      latest: withThumb(db.prepare('SELECT * FROM entries WHERE child_id = ? ORDER BY date DESC, id DESC LIMIT 1').get(cid)),
      remember: withThumb(db.prepare('SELECT * FROM entries WHERE child_id = ? ORDER BY RANDOM() LIMIT 1').get(cid)),
      nextEvent: db.prepare("SELECT title, date, kind FROM events WHERE child_id = ? AND status = 'upcoming' AND date >= ? ORDER BY date LIMIT 1").get(cid, today) || null,
      lastPassed: db.prepare("SELECT track, level, score FROM ladder WHERE child_id = ? AND status = 'passed' ORDER BY (date IS NULL), date DESC, id DESC LIMIT 1").get(cid) || null,
    });
  });

  // ---- dashboard summary
  app.get('/api/children/:cid/summary', requireParent, childParam, (req, res) => {
    const cid = req.child.id;
    const counts = {};
    for (const r of db.prepare('SELECT category, COUNT(*) AS n FROM entries WHERE child_id = ? GROUP BY category').all(cid)) counts[r.category] = r.n;
    res.json({
      entries: Object.values(counts).reduce((a, b) => a + b, 0),
      counts,
      media: db.prepare('SELECT COUNT(*) AS n FROM media m JOIN entries e ON e.id = m.entry_id WHERE e.child_id = ?').get(cid).n,
      activeActivities: db.prepare('SELECT COUNT(*) AS n FROM activities WHERE child_id = ? AND active = 1').get(cid).n,
      upcomingEvents: db.prepare("SELECT COUNT(*) AS n FROM events WHERE child_id = ? AND status = 'upcoming'").get(cid).n,
      examsPassed: db.prepare("SELECT COUNT(*) AS n FROM ladder WHERE child_id = ? AND status = 'passed'").get(cid).n,
    });
  });

  // ---- static app + errors
  app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
  app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found')));
  app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', extensions: ['html'] }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err instanceof multer.MulterError) {
      status = 400;
      message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (80 MB max)' : err.message;
    } else if (err.type === 'entity.parse.failed') {
      status = 400; message = 'Bad request';
    } else if (status >= 500) {
      console.error(err);
      message = 'Something went wrong';
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/media')) return res.status(status).json({ error: message });
    res.status(status).type('text/plain').send(message);
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp({ cookieSecure: process.env.COOKIE_SECURE === '1' });
  app.listen(port, () => console.log(`Ankur is growing on http://localhost:${port}`));
}
