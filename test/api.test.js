'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

let server, base, dataDir;
let parentCookie = '', familyCookie = '';

async function call(method, url, { body, cookie, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + url, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, res };
}
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ankur-test-'));
  const app = createApp({ dataDir });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('fresh install needs setup and blocks everything else', async () => {
  const me = await call('GET', '/api/me');
  assert.equal(me.json.needsSetup, true);
  assert.equal((await call('GET', '/api/children')).status, 401);
  assert.equal((await call('GET', '/media/1')).status, 401);
});

test('setup creates the parent, first child and exam ladder, then locks', async () => {
  const bad = await call('POST', '/api/setup', { body: { name: 'V', email: 'v@x.com', password: 'short', childName: 'Mira' } });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/api/setup', { body: { name: 'Venthan', email: 'v@x.com', password: 'longenough1', childName: 'Mira', childDob: '2019-03-01' } });
  assert.equal(ok.status, 201);
  parentCookie = cookieOf(ok.res);
  assert.match(ok.res.headers.get('set-cookie'), /HttpOnly/);
  const again = await call('POST', '/api/setup', { body: { name: 'X', email: 'x@x.com', password: 'longenough1', childName: 'Y' } });
  assert.equal(again.status, 403);
  const kids = await call('GET', '/api/children', { cookie: parentCookie });
  assert.equal(kids.json.length, 1);
  const ladder = await call('GET', `/api/children/${kids.json[0].id}/ladder`, { cookie: parentCookie });
  assert.equal(ladder.json.length, 5);
});

test('login rejects wrong passwords and accepts the right one', async () => {
  assert.equal((await call('POST', '/api/login', { body: { email: 'v@x.com', password: 'nope-nope' } })).status, 401);
  const ok = await call('POST', '/api/login', { body: { email: 'V@X.com', password: 'longenough1' } });
  assert.equal(ok.status, 200);
});

test('family accounts can view the portfolio but not edit or see the dashboard', async () => {
  const mk = await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Grandma', email: 'g@x.com', password: 'grandma-pass', role: 'family' } });
  assert.equal(mk.status, 201);
  const login = await call('POST', '/api/login', { body: { email: 'g@x.com', password: 'grandma-pass' } });
  familyCookie = cookieOf(login.res);
  assert.equal((await call('GET', '/api/children/1/entries', { cookie: familyCookie })).status, 200);
  assert.equal((await call('GET', '/api/children/1/activities', { cookie: familyCookie })).status, 403);
  assert.equal((await call('GET', '/api/children/1/summary', { cookie: familyCookie })).status, 403);
  assert.equal((await call('GET', '/api/users', { cookie: familyCookie })).status, 403);
  const form = new FormData();
  form.set('title', 'Nope'); form.set('category', 'art'); form.set('date', '2026-01-01');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: familyCookie, form })).status, 403);
});

test('entries with media: create, list, serve privately, edit, delete', async () => {
  const form = new FormData();
  form.set('title', 'Peacock painting'); form.set('category', 'art'); form.set('date', '2026-09-20'); form.set('notes', 'Watercolour');
  form.append('files', new Blob([Buffer.from('fakepng')], { type: 'image/png' }), 'peacock.png');
  const created = await call('POST', '/api/children/1/entries', { cookie: parentCookie, form });
  assert.equal(created.status, 201);
  assert.equal(created.json.media.length, 1);
  const mid = created.json.media[0].id;

  assert.equal((await call('GET', `/media/${mid}`)).status, 401);
  const served = await call('GET', `/media/${mid}`, { cookie: familyCookie });
  assert.equal(served.status, 200);
  assert.equal(served.res.headers.get('content-type'), 'image/png');
  assert.equal(served.text, 'fakepng');

  const list = await call('GET', '/api/children/1/entries?category=art', { cookie: familyCookie });
  assert.equal(list.json.length, 1);
  assert.equal((await call('GET', '/api/children/1/entries?category=speech', { cookie: familyCookie })).json.length, 0);

  const edit = await call('PUT', `/api/entries/${created.json.id}`, { cookie: parentCookie, body: { title: 'Peacock (final)' } });
  assert.equal(edit.json.title, 'Peacock (final)');

  const upDir = path.join(dataDir, 'uploads');
  assert.equal(fs.readdirSync(upDir).length, 1);
  assert.equal((await call('DELETE', `/api/entries/${created.json.id}`, { cookie: parentCookie })).status, 200);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fs.readdirSync(upDir).length, 0, 'uploaded file removed with entry');
});

test('rejects bad uploads and invalid fields without leaving files behind', async () => {
  const svg = new FormData();
  svg.set('title', 'x'); svg.set('category', 'art'); svg.set('date', '2026-01-01');
  svg.append('files', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'a.svg');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: svg })).status, 400);

  const badDate = new FormData();
  badDate.set('title', 'x'); badDate.set('category', 'art'); badDate.set('date', 'yesterday');
  badDate.append('files', new Blob(['abc'], { type: 'image/png' }), 'a.png');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: badDate })).status, 400);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fs.readdirSync(path.join(dataDir, 'uploads')).length, 0);
});

test('dashboard resources: activities, events, ladder, summary', async () => {
  const act = await call('POST', '/api/children/1/activities', { cookie: parentCookie, body: { name: 'Hindi tuition', category: 'hindi', schedule: 'Sat 10am', active: true } });
  assert.equal(act.status, 201);
  const ev = await call('POST', '/api/children/1/events', { cookie: parentCookie, body: { title: 'Colouring contest', date: '2026-11-15', kind: 'contest' } });
  assert.equal(ev.json.status, 'upcoming');
  assert.equal((await call('POST', '/api/children/1/events', { cookie: parentCookie, body: { title: 'No date' } })).status, 400);
  const done = await call('PUT', `/api/events/${ev.json.id}`, { cookie: parentCookie, body: { status: 'done', result: '2nd place' } });
  assert.equal(done.json.result, '2nd place');

  const ladder = (await call('GET', '/api/children/1/ladder', { cookie: parentCookie })).json;
  await call('PUT', `/api/ladder/${ladder[0].id}`, { cookie: parentCookie, body: { status: 'passed', score: '15 shields' } });
  const sum = await call('GET', '/api/children/1/summary', { cookie: parentCookie });
  assert.equal(sum.json.activeActivities, 1);
  assert.equal(sum.json.examsPassed, 1);
  assert.equal(sum.json.upcomingEvents, 0);
});

test('private-app headers and logout', async () => {
  const r = await call('GET', '/robots.txt');
  assert.match(r.text, /Disallow: \//);
  assert.match(r.res.headers.get('x-robots-tag'), /noindex/);
  await call('POST', '/api/logout', { cookie: familyCookie });
  assert.equal((await call('GET', '/api/children', { cookie: familyCookie })).status, 401);
});

test('kid accounts: own profile only, read-only, Buddy facts, no parent areas', async () => {
  // a sibling, with a private photo the first child's login must never see
  const sib = await call('POST', '/api/children', { cookie: parentCookie, body: { name: 'Little One' } });
  assert.equal(sib.status, 201);
  const form = new FormData();
  form.set('title', 'Sibling drawing'); form.set('category', 'art'); form.set('date', '2026-10-01');
  form.append('files', new Blob(['sibling-bytes'], { type: 'image/png' }), 's.png');
  const sibEntry = await call('POST', `/api/children/${sib.json.id}/entries`, { cookie: parentCookie, form });
  const sibMedia = sibEntry.json.media[0].id;

  const mine = new FormData();
  mine.set('title', 'Stage speech'); mine.set('category', 'speech'); mine.set('date', '2026-10-05');
  mine.append('files', new Blob(['mine'], { type: 'image/png' }), 'm.png');
  const mineEntry = await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mine });

  assert.equal((await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Mira', email: 'Mi ra', password: 'sprout1', role: 'child', childId: 1 } })).status, 400, 'bad username');
  assert.equal((await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Mira', email: 'mira', password: 'abc', role: 'child', childId: 1 } })).status, 400, 'short password');
  assert.equal((await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Mira', email: 'mira', password: 'sprout1', role: 'child' } })).status, 400, 'needs a child');
  assert.equal((await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Mira', email: 'mira', password: 'sprout1', role: 'child', childId: 1 } })).status, 201);

  const login = await call('POST', '/api/login', { body: { email: 'Mira', password: 'sprout1' } });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.role, 'child');
  const kid = cookieOf(login.res);

  const kids = await call('GET', '/api/children', { cookie: kid });
  assert.deepEqual(kids.json.map((c) => c.id), [1]);
  assert.equal((await call('GET', `/api/children/${sib.json.id}/entries`, { cookie: kid })).status, 403);
  assert.equal((await call('GET', `/api/children/${sib.json.id}/buddy`, { cookie: kid })).status, 403);
  assert.equal((await call('GET', `/media/${sibMedia}`, { cookie: kid })).status, 403, "sibling's photo is fenced off");
  assert.equal((await call('GET', `/media/${mineEntry.json.media[0].id}`, { cookie: kid })).status, 200);

  const f = new FormData(); f.set('title', 'x'); f.set('category', 'art'); f.set('date', '2026-01-01');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: kid, form: f })).status, 403);
  assert.equal((await call('DELETE', `/api/entries/${mineEntry.json.id}`, { cookie: kid })).status, 403);
  for (const p of ['activities', 'events', 'ladder', 'summary']) {
    assert.equal((await call('GET', `/api/children/1/${p}`, { cookie: kid })).status, 403, p);
  }
  assert.equal((await call('GET', '/api/users', { cookie: kid })).status, 403);

  const buddy = await call('GET', '/api/children/1/buddy', { cookie: kid });
  assert.equal(buddy.status, 200);
  assert.equal(buddy.json.name, 'Mira');
  assert.ok(buddy.json.total >= 1);
  assert.equal(buddy.json.lastPassed.level, 'Pre A1 Starters');
});

test('demo seed loads a usable family and refuses to overwrite real data', async () => {
  const { seedDemo, CREDENTIALS } = require('../scripts/seed-demo');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ankur-seed-'));
  let srv;
  try {
    seedDemo(dir);
    const app = createApp({ dataDir: dir });
    srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    const url = `http://127.0.0.1:${srv.address().port}`;
    const login = async (email, password) => {
      const r = await fetch(url + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
    };
    const kid = await login(CREDENTIALS.kid.username, CREDENTIALS.kid.password);
    assert.equal(kid.status, 200);
    const entries = await (await fetch(url + '/api/children/1/entries', { headers: { cookie: kid.cookie } })).json();
    assert.ok(entries.length >= 6 && entries.some((e) => e.media.length), 'demo entries with pictures');
    const parent = await login(CREDENTIALS.parent.email, CREDENTIALS.parent.password);
    const sum = await (await fetch(url + '/api/children/1/summary', { headers: { cookie: parent.cookie } })).json();
    assert.equal(sum.examsPassed, 1);
    assert.equal(sum.upcomingEvents, 6);
    assert.throws(() => seedDemo(dir), /already has accounts/);
  } finally { srv?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('grown-ups can use a simple username, and sessions renew while in use', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ankur-user-'));
  let srv;
  try {
    const app = createApp({ dataDir: dir });
    srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    const url = `http://127.0.0.1:${srv.address().port}`;
    const post = (p, body, cookie) => fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
    const bad = await post('/api/setup', { name: 'Test', email: 'a b', password: 'Test@123', childName: 'Mira' });
    assert.equal(bad.status, 400);
    const ok = await post('/api/setup', { name: 'Test', email: 'Test', password: 'Test@123', childName: 'Mira' });
    assert.equal(ok.status, 201);
    const login = await post('/api/login', { email: 'test', password: 'Test@123' });
    assert.equal(login.status, 200, 'username is case-insensitive');
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /Max-Age=7776000/, '90-day session');

    // pretend 40 days passed: a visit should push the expiry back out and reissue the cookie
    const db = app.locals.db;
    db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() + 50 * 864e5);
    const visit = await fetch(url + '/api/me', { headers: { cookie } });
    assert.match(visit.headers.get('set-cookie') || '', /Max-Age=7776000/);
    const left = db.prepare('SELECT MAX(expires_at) AS e FROM sessions').get().e - Date.now();
    assert.ok(left > 89 * 864e5, 'session renewed to ~90 days');
  } finally { srv?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sample moments load, never touch real ones, and remove cleanly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ankur-samples-'));
  let srv;
  try {
    const app = createApp({ dataDir: dir });
    srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    const url = `http://127.0.0.1:${srv.address().port}`;
    const j = (p, method, body, cookie) => fetch(url + p, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const setup = await j('/api/setup', 'POST', { name: 'P', email: 'parent1', password: 'longenough1', childName: 'Kid' });
    const cookie = (setup.headers.get('set-cookie') || '').split(';')[0];

    const real = new FormData(); real.set('title', 'My real moment'); real.set('category', 'art'); real.set('date', '2026-10-01');
    assert.equal((await fetch(url + '/api/children/1/entries', { method: 'POST', headers: { cookie }, body: real })).status, 201);

    assert.equal((await j('/api/children/1/samples', 'POST', null, cookie)).status, 201);
    assert.equal((await j('/api/children/1/samples', 'POST', null, cookie)).status, 409, 'no double-loading');
    let entries = await (await j('/api/children/1/entries', 'GET', null, cookie)).json();
    assert.ok(entries.length > 8 && entries.some((e) => e.media.length));
    assert.ok(fs.readdirSync(path.join(dir, 'uploads')).length >= 5);
    const sum = await (await j('/api/children/1/summary', 'GET', null, cookie)).json();
    assert.ok(sum.samples > 8);

    assert.equal((await j('/api/children/1/samples', 'DELETE', null, cookie)).status, 200);
    await new Promise((r) => setTimeout(r, 100));
    entries = await (await j('/api/children/1/entries', 'GET', null, cookie)).json();
    assert.deepEqual(entries.map((e) => e.title), ['My real moment'], 'the real moment survives');
    assert.equal(fs.readdirSync(path.join(dir, 'uploads')).length, 0, 'sample files are deleted from disk');
    assert.equal((await (await j('/api/children/1/events', 'GET', null, cookie)).json()).length, 0);
    assert.equal((await (await j('/api/children/1/goals', 'GET', null, cookie)).json()).length, 0, 'sample goals removed too');
    assert.equal((await j('/api/children/1/samples', 'POST', null)).status, 401, 'needs sign-in');
  } finally { srv?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('achievements carry a level and a result; new areas are accepted', async () => {
  const mk = (extra) => { const f = new FormData(); f.set('title', 'Zonal football'); f.set('date', '2026-09-01'); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };
  const ok = await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'sports', level: 'zonal', result: 'Runner-up' }) });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.level, 'zonal');
  assert.equal(ok.json.result, 'Runner-up');
  for (const category of ['olympiad', 'martial', 'skating', 'chinese', 'dance', 'stage', 'singing', 'writing', 'gymnastics', 'swimming', 'community']) {
    assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category }) })).status, 201, category);
  }
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'sports', level: 'galaxy' }) })).status, 400, 'unknown level');
  const oly = await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'olympiad', subject: 'maths', score: '52 / 60', result: 'Zonal rank 9' }) });
  assert.equal(oly.status, 201);
  assert.equal(oly.json.subject, 'maths');
  assert.equal(oly.json.score, '52 / 60');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'olympiad', subject: 'astrology' }) })).status, 400, 'unknown subject');
  assert.equal((await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'sports', date: '2026-02-30' }) })).status, 400, 'impossible date');
  const led = await call('POST', '/api/children/1/entries', { cookie: parentCookie, form: mk({ category: 'school', role: 'Class monitor' }) });
  assert.equal(led.status, 201);
  assert.equal(led.json.role, 'Class monitor');
  const edited = await call('PUT', `/api/entries/${ok.json.id}`, { cookie: parentCookie, body: { level: '', result: 'Champion' } });
  assert.equal(edited.json.level, null, 'level can be cleared');
  assert.equal(edited.json.result, 'Champion');
});

test('changing a password signs out other devices but keeps this one', async () => {
  assert.equal((await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Papa', email: 'papa@x.com', password: 'papa-pass-1', role: 'parent' } })).status, 201);
  const login = async () => cookieOf((await call('POST', '/api/login', { body: { email: 'papa@x.com', password: 'papa-pass-1' } })).res);
  const phone = await login();
  const laptop = await login();
  const r = await call('POST', '/api/me/password', { cookie: laptop, body: { current: 'papa-pass-1', next: 'papa-pass-2' } });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/children', { cookie: laptop })).status, 200, 'this device stays signed in');
  assert.equal((await call('GET', '/api/children', { cookie: phone })).status, 401, 'other device is signed out');
});

test('one catalog drives server validation, tabs and colours', () => {
  const catalog = require('../public/catalog');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  const groups = new Set(catalog.GROUPS.map(([g]) => g));
  for (const [key, [emoji, label, group]] of Object.entries(catalog.CATS)) {
    assert.ok(emoji && label, key);
    assert.ok(groups.has(group), `${key} belongs to a known tab`);
    assert.ok(css.includes(`[data-cat="${key}"]`), `${key} has a colour`);
  }
  for (const [name, steps] of Object.entries(catalog.LADDERS)) assert.ok(steps.length >= 2, name);
});

test('outdated sample moments are swapped for the latest set on start; real ones stay', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ankur-refresh-'));
  try {
    const app1 = createApp({ dataDir: dir });
    const db = app1.locals.db;
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('P', 'p@x.com', 'x', 'parent')").run();
    db.prepare("INSERT INTO children (name) VALUES ('Kid')").run();
    db.prepare("INSERT INTO entries (child_id, category, title, date, is_sample, created_by) VALUES (1, 'art', 'Old sample', '2026-01-01', 1, 1)").run();
    db.prepare("INSERT INTO entries (child_id, category, title, date, is_sample, created_by) VALUES (1, 'art', 'Real painting', '2026-01-02', 0, 1)").run();
    db.prepare("UPDATE meta SET value = '1' WHERE key = 'sample_version'").run();
    db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('sample_version', '1')").run();
    db.close();

    const db2 = createApp({ dataDir: dir }).locals.db; // restart
    const titles = db2.prepare('SELECT title FROM entries').all().map((r) => r.title);
    assert.ok(titles.includes('Real painting'), 'real moment kept');
    assert.ok(!titles.includes('Old sample'), 'old sample gone');
    assert.ok(db2.prepare("SELECT COUNT(*) AS n FROM entries WHERE category = 'gymnastics' AND is_sample = 1").get().n > 0, 'new sample areas loaded');
    db2.close();
    const db3 = createApp({ dataDir: dir }).locals.db; // a second restart changes nothing
    assert.equal(db3.prepare('SELECT COUNT(*) AS n FROM entries').get().n, titles.length);
    db3.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('buddy pictures: parents upload, the kid chooses, everyone else is fenced off', async () => {
  const png = fs.readFileSync(path.join(__dirname, '..', 'demo', 'images', 'medal.png'));
  const up = (name, type = 'image/png', cookie = parentCookie) => {
    const f = new FormData(); f.set('name', name); f.set('picture', new Blob([png], { type }), 'pic.png');
    return call('POST', '/api/children/1/buddies', { cookie, form: f });
  };
  familyCookie = cookieOf((await call('POST', '/api/login', { body: { email: 'g@x.com', password: 'grandma-pass' } })).res);
  const made = await up('Star friend');
  assert.equal(made.status, 201);
  assert.equal((await up('Sneaky', 'image/svg+xml')).status, 400, 'no SVG');
  assert.equal((await up('Grandma pick', 'image/png', familyCookie)).status, 403, 'family cannot upload');

  const kid = cookieOf((await call('POST', '/api/login', { body: { email: 'mira', password: 'sprout1' } })).res);
  const list = await call('GET', '/api/children/1/buddies', { cookie: kid });
  assert.deepEqual(list.json.buddies.map((b) => b.name), ['Star friend']);
  assert.equal(list.json.chosen, null, 'sprout by default');

  assert.equal((await call('PUT', '/api/children/1/buddy', { cookie: familyCookie, body: { buddyId: made.json.id } })).status, 403);
  assert.equal((await call('PUT', '/api/children/1/buddy', { cookie: kid, body: { buddyId: 9999 } })).status, 400);
  assert.equal((await call('PUT', '/api/children/1/buddy', { cookie: kid, body: { buddyId: made.json.id } })).status, 200, 'kid picks');
  assert.equal((await call('GET', '/api/children/1/buddies', { cookie: kid })).json.chosen, made.json.id);

  const pic = await call('GET', `/buddy-pic/${made.json.id}`, { cookie: kid });
  assert.equal(pic.status, 200);
  assert.equal(pic.res.headers.get('content-type'), 'image/png');
  assert.equal((await call('GET', `/buddy-pic/${made.json.id}`)).status, 401, 'never public');

  // another child's kid login cannot see this picture
  const c2 = await call('POST', '/api/children', { cookie: parentCookie, body: { name: 'Sibling' } });
  await call('POST', '/api/users', { cookie: parentCookie, body: { name: 'Sib', email: 'sib', password: 'sib-pass', role: 'child', childId: c2.json.id } });
  const sib = cookieOf((await call('POST', '/api/login', { body: { email: 'sib', password: 'sib-pass' } })).res);
  assert.equal((await call('GET', `/buddy-pic/${made.json.id}`, { cookie: sib })).status, 403);
  assert.equal((await call('PUT', '/api/children/1/buddy', { cookie: sib, body: { buddyId: null } })).status, 403);

  assert.equal((await call('DELETE', `/api/buddies/${made.json.id}`, { cookie: parentCookie })).status, 200);
  assert.equal((await call('GET', '/api/children/1/buddies', { cookie: kid })).json.chosen, null, 'back to the sprout');
});

test('pathway goals: parents plan per stage, others are kept out, PSLE year is optional', async () => {
  familyCookie = cookieOf((await call('POST', '/api/login', { body: { email: 'g@x.com', password: 'grandma-pass' } })).res);
  const made = await call('POST', '/api/children/1/goals', { cookie: parentCookie, body: { stage: 'psle', title: 'DSA-Sec in Robotics', category: 'robotics', target: 'Zonal award by P5', due: '2030-06-01' } });
  assert.equal(made.status, 201);
  assert.equal(made.json.status, 'working', 'defaults to working');
  assert.equal((await call('POST', '/api/children/1/goals', { cookie: parentCookie, body: { stage: 'kindergarten', title: 'x' } })).status, 400, 'unknown stage');
  assert.equal((await call('POST', '/api/children/1/goals', { cookie: parentCookie, body: { stage: 'psle' } })).status, 400, 'title required');
  assert.equal((await call('GET', '/api/children/1/goals', { cookie: familyCookie })).status, 403, 'family cannot see goals');
  const kid = cookieOf((await call('POST', '/api/login', { body: { email: 'mira', password: 'sprout1' } })).res);
  assert.equal((await call('GET', '/api/children/1/goals', { cookie: kid })).status, 403, 'kid cannot see goals');
  const done = await call('PUT', `/api/goals/${made.json.id}`, { cookie: parentCookie, body: { status: 'achieved' } });
  assert.equal(done.json.status, 'achieved');
  assert.equal((await call('PUT', '/api/children/1', { cookie: parentCookie, body: { psle_year: '' } })).status, 200, 'blank PSLE year is fine');
  assert.equal((await call('PUT', '/api/children/1', { cookie: parentCookie, body: { psle_year: '2031' } })).json.psle_year, 2031);
  assert.equal((await call('PUT', '/api/children/1', { cookie: parentCookie, body: { psle_year: '1800' } })).status, 400, 'nonsense year rejected');
  assert.equal((await call('DELETE', `/api/goals/${made.json.id}`, { cookie: parentCookie })).status, 200);
});

test('university list is well-formed: known region, official https link, real coordinates, all fields', () => {
  const { UNIS, UNI_REGIONS, AGE_GUIDE } = require('../public/catalog');
  const regions = new Set(UNI_REGIONS.map(([k]) => k));
  const keys = new Set();
  for (const u of UNIS) {
    assert.ok(!keys.has(u.key), `${u.key} unique`); keys.add(u.key);
    assert.ok(regions.has(u.region) && u.region !== 'all', `${u.key} region`);
    assert.match(u.url, /^https:\/\//, `${u.key} url`);
    assert.ok(Math.abs(u.lat) <= 90 && Math.abs(u.lon) <= 180, `${u.key} coordinates`);
    const [, , , [w, s, e, n]] = UNI_REGIONS.find(([k]) => k === u.region);
    assert.ok(u.lon >= w && u.lon <= e && u.lat >= s && u.lat <= n, `${u.key} sits inside its region's map`);
    for (const f of ['name', 'short', 'city', 'how', 'tests', 'weighs']) assert.ok(u[f], `${u.key}.${f}`);
  }
  assert.equal(AGE_GUIDE.length, 3);
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'public', 'worldmap.js'), 'utf8').includes('window.ANKUR_WORLD = "M'), 'map outline present');
});
