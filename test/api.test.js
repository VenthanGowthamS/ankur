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
  const bad = await call('POST', '/api/setup', { body: { name: 'V', email: 'v@x.com', password: 'short', childName: 'Roshna' } });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/api/setup', { body: { name: 'Venthan', email: 'v@x.com', password: 'longenough1', childName: 'Roshna', childDob: '2019-03-01' } });
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
