'use strict';
/* "Download everything": one ZIP a family can keep forever, readable without this app.
   Contains kaizen-folio.json (every record), the original photos/recordings/PDFs, and an
   index.html that opens offline in any browser. No passwords, sessions or other secrets.

   The ZIP writer is deliberately tiny: files are stored (not compressed — photos and video
   are already compressed) and streamed one at a time, so memory stays flat. CRC-32 comes from
   Node's zlib. Without ZIP64 the archive must stay under 4 GB; we check before starting. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LIMIT = 0xffffffff - 64 * 1024 * 1024; // leave room for headers and the central directory

function crcOfFile(file) {
  return new Promise((resolve, reject) => {
    let crc = 0;
    fs.createReadStream(file).on('data', (b) => { crc = zlib.crc32(b, crc); }).on('end', () => resolve(crc >>> 0)).on('error', reject);
  });
}

// Minimal DOS date/time for the ZIP headers.
function dosTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

class ZipStream {
  constructor(out) { this.out = out; this.offset = 0; this.entries = []; this.when = dosTime(); }
  write(buf) {
    this.offset += buf.length;
    return this.out.write(buf) ? Promise.resolve() : new Promise((r) => this.out.once('drain', r));
  }
  header(name, crc, size) {
    const n = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); // UTF-8 names
    h.writeUInt16LE(0, 8); h.writeUInt16LE(this.when.time, 10); h.writeUInt16LE(this.when.date, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(size, 18); h.writeUInt32LE(size, 22);
    h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    this.entries.push({ n, crc, size, offset: this.offset });
    return Buffer.concat([h, n]);
  }
  async addBuffer(name, buf) {
    await this.write(this.header(name, zlib.crc32(buf) >>> 0, buf.length));
    await this.write(buf);
  }
  async addFile(name, file) {
    const size = fs.statSync(file).size;
    await this.write(this.header(name, await crcOfFile(file), size));
    for await (const chunk of fs.createReadStream(file)) await this.write(chunk);
  }
  async finish() {
    const start = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(0, 10); c.writeUInt16LE(this.when.time, 12); c.writeUInt16LE(this.when.date, 14);
      c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.size, 20); c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.n.length, 28); c.writeUInt32LE(e.offset, 42);
      await this.write(Buffer.concat([c, e.n]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(this.entries.length, 8); end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12); end.writeUInt32LE(start, 16);
    await this.write(end);
    this.out.end();
  }
}

const slug = (s) => String(s || '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40).toLowerCase() || 'moment';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Gathers everything for the archive. Media file paths are relative to the ZIP root.
function collect(db, catalog) {
  const children = db.prepare('SELECT id, name, nickname, dob, bio, psle_year, created_at FROM children ORDER BY id').all();
  const files = [];
  const out = { app: 'Kaizen Folio', exported_at: new Date().toISOString(), format: 1, children: [] };
  for (const c of children) {
    const folder = `${String(c.id).padStart(2, '0')}-${slug(c.nickname || c.name)}`;
    const entries = db.prepare('SELECT * FROM entries WHERE child_id = ? AND is_sample = 0 ORDER BY date, id').all(c.id).map((e) => {
      const media = db.prepare('SELECT id, file, original, mime, size FROM media WHERE entry_id = ? ORDER BY id').all(e.id).map((m) => {
        const ext = path.extname(m.file) || path.extname(m.original || '');
        const rel = `media/${folder}/${e.date}-${slug(e.title)}-${m.id}${ext}`;
        files.push({ rel, file: m.file });
        return { original: m.original, mime: m.mime, size: m.size, path: rel };
      });
      const cheers = db.prepare('SELECT c.body, c.created_at, u.name FROM cheers c LEFT JOIN users u ON u.id = c.user_id WHERE c.entry_id = ? ORDER BY c.id').all(e.id)
        .map((x) => ({ from: x.name || 'Family', body: x.body, at: x.created_at }));
      const { child_id, created_by, is_sample, ...rest } = e; // eslint-disable-line no-unused-vars
      return { ...rest, qualities: e.qualities ? e.qualities.split(',') : [], media, cheers };
    });
    const pick = (table, order) => db.prepare(`SELECT * FROM ${table} WHERE child_id = ? ${table === 'ladder' || table === 'goals' ? '' : 'AND is_sample = 0'} ORDER BY ${order}`).all(c.id)
      .map(({ child_id, is_sample, ...r }) => r); // eslint-disable-line no-unused-vars
    out.children.push({
      ...c, folder, entries,
      activities: pick('activities', 'id'), events: pick('events', 'date, id'), ladder: pick('ladder', 'track, sort, id'),
      goals: db.prepare('SELECT * FROM goals WHERE child_id = ? AND is_sample = 0 ORDER BY stage, sort, id').all(c.id).map(({ child_id, is_sample, ...r }) => r), // eslint-disable-line no-unused-vars
    });
  }
  return { data: out, files, labels: catalog };
}

// A plain offline page: every moment, newest first, with its photos and the family's words.
function indexHtml({ data, labels }) {
  const cat = (k) => (labels.CATS[k] || labels.CATS.other);
  const q = (k) => labels.QUALITIES.find((x) => x[0] === k);
  const feel = (k) => labels.FEELINGS.find((x) => x[0] === k);
  const kids = data.children.map((c) => {
    const items = [...c.entries].reverse().map((e) => {
      const pics = e.media.map((m) => (m.mime.startsWith('image/')
        ? `<a href="${esc(m.path)}"><img src="${esc(m.path)}" alt="${esc(m.original)}" loading="lazy"></a>`
        : `<a class="file" href="${esc(m.path)}">📎 ${esc(m.original || 'file')}</a>`)).join('');
      const tags = e.qualities.map(q).filter(Boolean).map(([, i, l]) => `<span class="tag">${i} ${esc(l)}</span>`).join('');
      const f = feel(e.kid_feeling);
      return `<article><div class="when">${esc(e.date)} · ${cat(e.category)[0]} ${esc(cat(e.category)[1])}</div><h3>${esc(e.title)}</h3>
${[e.result, e.role].filter(Boolean).map((x) => `<span class="tag win">${esc(x)}</span>`).join('')}${tags}
${e.notes ? `<p>${esc(e.notes)}</p>` : ''}
${e.kid_words || f ? `<blockquote>${f ? `${f[1]} ${esc(f[2])}. ` : ''}${esc(e.kid_words || '')}</blockquote>` : ''}
${e.next_step ? `<p class="next">🌱 Next small step: ${esc(e.next_step)}${e.next_done ? ' ✓' : ''}</p>` : ''}
${e.cheers.length ? `<ul class="cheers">${e.cheers.map((x) => `<li><b>${esc(x.from)}:</b> ${esc(x.body)}</li>`).join('')}</ul>` : ''}
${pics ? `<div class="pics">${pics}</div>` : ''}</article>`;
    }).join('\n');
    return `<section><h2>${esc(c.nickname || c.name)}</h2><p class="muted">${c.entries.length} moments</p>${items || '<p>No moments yet.</p>'}</section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kaizen Folio archive</title><style>
body{font:16px/1.5 system-ui,sans-serif;max-width:820px;margin:0 auto;padding:16px;color:#2b2a22;background:#fbf7ee}
h1,h2,h3{font-family:Georgia,serif}article{background:#fff;border:1px solid #e8e0cc;border-radius:14px;padding:14px;margin:12px 0}
.when,.muted{color:#6f6b5c;font-size:.85rem}.tag{display:inline-block;font-size:.8rem;background:#e6efd9;border-radius:99px;padding:1px 10px;margin:2px}
.tag.win{background:#fbeccb}.pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}.pics img{width:100%;border-radius:10px}
blockquote{margin:8px 0;padding:8px 12px;background:#f3eefc;border-radius:12px}.next{color:#3b6129}.cheers{padding-left:18px;color:#444}
</style></head><body><h1>Kaizen Folio — family archive</h1><p class="muted">Exported ${esc(data.exported_at.slice(0, 10))}. Everything is also in kaizen-folio.json; photos and files are in the media folder.</p>
${kids}</body></html>`;
}

const README = `Kaizen Folio — family archive

index.html        Open in any web browser to browse every moment offline.
kaizen-folio.json Every record (moments, qualities, next steps, the child's own words,
                  family cheers, activities, events, exam ladders, goals) in plain JSON.
media/            The original photos, recordings, videos and PDFs, named by date and title.

Sample (demo) moments are not included. Passwords and sign-in data are never exported.
Keep a copy somewhere safe — this is your family's record.
`;

async function streamExport(res, db, uploadDir, catalog) {
  const bundle = collect(db, catalog);
  const existing = bundle.files.filter((f) => fs.existsSync(path.join(uploadDir, f.file)));
  const total = existing.reduce((n, f) => n + fs.statSync(path.join(uploadDir, f.file)).size, 0);
  if (total > LIMIT) {
    const err = new Error('Too large to download as one file (over 4 GB). Copy the data folder on the server instead.');
    err.status = 413;
    throw err;
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="kaizen-folio-${new Date().toISOString().slice(0, 10)}.zip"`);
  res.setHeader('Cache-Control', 'no-store');
  const zip = new ZipStream(res);
  await zip.addBuffer('README.txt', Buffer.from(README));
  await zip.addBuffer('kaizen-folio.json', Buffer.from(JSON.stringify(bundle.data, null, 2)));
  await zip.addBuffer('index.html', Buffer.from(indexHtml(bundle)));
  for (const f of existing) await zip.addFile(f.rel, path.join(uploadDir, f.file));
  await zip.finish();
}

module.exports = { streamExport, ZipStream };
