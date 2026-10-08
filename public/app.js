'use strict';
/* Ankur — a private growth portfolio. Vanilla JS, no build step.
   All DOM is built with h() (never innerHTML with user data), so notes and titles can't inject markup. */

const CATS = {
  art: ['🎨', 'Art'], speech: ['🎤', 'Speech'], exam: ['📜', 'Exams'], hindi: ['🪔', 'Hindi'],
  accolade: ['🏅', 'Accolades'], school: ['🏫', 'School'], other: ['✨', 'Other'],
};
const EVENT_KINDS = [['contest', 'Contest'], ['exam', 'Exam'], ['performance', 'Performance'], ['school', 'School'], ['other', 'Other']];
const catOptions = () => Object.entries(CATS).map(([v, [e, l]]) => [v, `${e} ${l}`]);

const state = { user: null, children: [], childId: null, view: 'portfolio', filter: 'all' };

/* ---------- tiny helpers ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'selected', 'multiple'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (kid) => {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  };
  kids.forEach(add);
  return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
function sproutSvg(cls) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 512 512');
  if (cls) s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  [
    ['path', { d: 'M256 400V250', stroke: '#4f7f3a', 'stroke-width': 28, 'stroke-linecap': 'round', fill: 'none' }],
    ['path', { d: 'M256 262C256 190 204 144 128 150c-4 76 40 120 128 112z', fill: '#4f7f3a' }],
    ['path', { d: 'M256 238C256 170 300 120 376 120c6 70-34 122-120 118z', fill: '#e8a33d' }],
  ].forEach(([t, attrs]) => {
    const p = document.createElementNS(SVG_NS, t);
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    s.append(p);
  });
  return s;
}

async function api(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch { throw new Error('You appear to be offline'); }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && state.user) { state.user = null; boot(); throw new Error('Please sign in again'); }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
const isParent = () => state.user && state.user.role === 'parent';
const child = () => state.children.find((c) => c.id === state.childId) || state.children[0];

const parseDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso) => parseDay(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const monthLabel = (iso) => parseDay(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function ageText(dob) {
  if (!dob) return '';
  const b = parseDay(dob), n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth() - (n.getDate() < b.getDate() ? 1 : 0);
  if (months < 0) return '';
  const y = Math.floor(months / 12), m = months % 12;
  return y >= 1 ? `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''}` : `${m} mo`;
}

/* ---------- modal + form builder ---------- */
function closeModal() { document.querySelector('.modal-wrap')?.remove(); }
function modal(content) {
  closeModal();
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) closeModal(); } }, h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content));
  document.body.append(wrap);
  wrap.querySelector('input:not([type=file]), textarea, select')?.focus();
  return wrap;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); document.querySelector('.lightbox')?.remove(); }
});

function confirmBox(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const done = (v) => { closeModal(); resolve(v); };
    modal([
      h('h2', null, 'Are you sure?'),
      h('p', null, message),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, 'Cancel'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => done(true) }, okLabel)),
    ]);
  });
}

/* fields: [{name,label,type,options,required,accept,hint}] — type: text|textarea|date|select|checkbox|files|password|email|number|datalist */
function openForm({ title, fields, values = {}, submitLabel = 'Save', extra, onSubmit, onDelete }) {
  const err = h('div', { class: 'error', role: 'alert' });
  const inputs = {};
  const body = fields.map((f) => {
    let input;
    const v = values[f.name];
    if (f.type === 'textarea') input = h('textarea', { name: f.name, required: f.required, maxlength: f.max, value: v ?? '' });
    else if (f.type === 'select') input = h('select', { name: f.name }, f.options.map(([val, lab]) => h('option', { value: val, selected: String(v ?? f.default ?? '') === String(val) }, lab)));
    else if (f.type === 'checkbox') input = h('input', { type: 'checkbox', name: f.name, checked: v === undefined ? !!f.default : !!v });
    else if (f.type === 'files') input = h('input', { type: 'file', name: f.name, accept: f.accept || 'image/*,audio/*,video/*,application/pdf', multiple: true });
    else input = h('input', { type: f.type || 'text', name: f.name, required: f.required, maxlength: f.max, value: v ?? f.default ?? '', autocomplete: f.autocomplete || 'off', list: f.list });
    inputs[f.name] = input;
    if (f.type === 'checkbox') return h('label', { class: 'field check' }, input, f.label);
    return h('label', { class: 'field' }, f.label + (f.required ? '' : ' (optional)'), input, f.hint && h('span', { class: 'small' }, f.hint));
  });
  const save = h('button', { class: 'btn primary', type: 'submit' }, submitLabel);
  const form = h('form', {
    class: 'fields',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const out = { values: {}, files: [] };
      for (const f of fields) {
        const el = inputs[f.name];
        if (f.type === 'files') out.files.push(...el.files);
        else out.values[f.name] = f.type === 'checkbox' ? el.checked : el.value;
      }
      save.disabled = true; save.textContent = 'Saving…';
      try { await onSubmit(out); closeModal(); }
      catch (ex) { err.textContent = ex.message; save.disabled = false; save.textContent = submitLabel; }
    },
  },
  body, extra, err,
  h('div', { class: 'actions' },
    onDelete && h('button', { class: 'btn danger left', type: 'button', onclick: async () => { if (await confirmBox('This can’t be undone.')) { try { await onDelete(); } catch (ex) { toast(ex.message); } } } }, 'Delete'),
    h('button', { class: 'btn', type: 'button', onclick: closeModal }, 'Cancel'),
    save));
  modal([h('h2', null, title), form]);
}

/* ---------- boot / auth ---------- */
const root = () => document.getElementById('app');

async function boot() {
  try {
    const me = await api('GET', '/api/me');
    if (!me.user) return renderAuth(me.needsSetup);
    state.user = me.user;
    state.children = await api('GET', '/api/children');
    if (!state.children.find((c) => c.id === state.childId)) state.childId = state.children[0]?.id ?? null;
    if (!isParent() && state.view === 'dashboard') state.view = 'portfolio';
    renderShell();
  } catch (ex) {
    root().replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'card' }, h('p', null, ex.message), h('button', { class: 'btn', onclick: boot }, 'Try again'))));
  }
}

function renderAuth(setup) {
  const err = h('div', { class: 'error', role: 'alert' });
  const field = (label, name, type = 'text', extra = {}) => h('label', { class: 'field' }, label, h('input', { name, type, required: true, ...extra }));
  const form = h('form', {
    class: 'fields',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const d = Object.fromEntries(new FormData(form));
      try { await api('POST', setup ? '/api/setup' : '/api/login', d); state.view = 'portfolio'; state.filter = 'all'; await boot(); }
      catch (ex) { err.textContent = ex.message; }
    },
  },
  setup && field('Your name', 'name', 'text', { autocomplete: 'name' }),
  field('Email', 'email', 'email', { autocomplete: 'username' }),
  field(setup ? 'Choose a password (8+ characters)' : 'Password', 'password', 'password', { autocomplete: setup ? 'new-password' : 'current-password', minlength: setup ? 8 : 1 }),
  setup && field('Child’s name', 'childName'),
  setup && h('label', { class: 'field' }, 'Child’s date of birth (optional)', h('input', { name: 'childDob', type: 'date' })),
  err,
  h('button', { class: 'btn primary', type: 'submit' }, setup ? 'Create our Ankur' : 'Sign in'));
  const logo = sproutSvg('logo');
  root().replaceChildren(h('main', { class: 'auth' }, h('div', { class: 'card' },
    logo, h('h1', null, 'Ankur'),
    h('p', { class: 'tag' }, setup ? 'First time here — set up the parent account.' : 'A private place where our children’s journey grows.'),
    form)));
}

/* ---------- shell ---------- */
function renderShell() {
  const kids = state.children;
  const tabs = [['portfolio', '🌱', 'Portfolio'], ...(isParent() ? [['dashboard', '📊', 'Dashboard']] : []), ['settings', '⚙️', isParent() ? 'Family' : 'Account']];
  const main = h('main', { id: 'main' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' }, tabs.map(([id, ic, label]) =>
    h('button', { 'aria-current': state.view === id ? 'page' : null, onclick: () => { state.view = id; renderShell(); } }, h('span', { class: 'ic' }, ic), label)));
  const switcher = kids.length > 1 && h('label', { class: 'child-switch' }, h('span', { class: 'sr' }, 'Child'),
    h('select', { onchange: (e) => { state.childId = Number(e.target.value); renderShell(); } },
      kids.map((c) => h('option', { value: c.id, selected: c.id === state.childId }, c.nickname || c.name))));
  root().replaceChildren(h('div', { class: 'shell' },
    h('header', { class: 'topbar' }, h('div', { class: 'brand' }, sproutSvg(), 'Ankur'), h('div', { class: 'spacer' }), switcher),
    nav, main));
  const views = { portfolio: viewPortfolio, dashboard: viewDashboard, settings: viewSettings };
  views[state.view](main).catch((ex) => main.replaceChildren(h('div', { class: 'empty' }, ex.message)));
}
const refresh = () => renderShell();

/* ---------- portfolio ---------- */
async function viewPortfolio(main) {
  const c = child();
  if (!c) return main.replaceChildren(h('div', { class: 'empty' }, 'No child yet.'));
  const entries = await api('GET', `/api/children/${c.id}/entries`);
  const counts = {};
  entries.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
  const shown = state.filter === 'all' ? entries : entries.filter((e) => e.category === state.filter);

  const hero = h('section', { class: 'hero' },
    sproutSvg('sprout'),
    h('h1', null, c.name),
    h('p', { class: 'muted' }, [ageText(c.dob), c.bio].filter(Boolean).join(' · ') || 'Every small step, kept safe.'),
    h('div', { class: 'stats' },
      h('span', { class: 'stat' }, h('b', null, entries.length), 'moments'),
      h('span', { class: 'stat' }, h('b', null, entries.reduce((n, e) => n + e.media.length, 0)), 'photos & files'),
      h('span', { class: 'stat' }, h('b', null, Object.keys(counts).length), 'areas')));

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' },
    [['all', 'All']].concat(Object.entries(CATS).filter(([k]) => counts[k] || state.filter === k).map(([k, [e, l]]) => [k, `${e} ${l} · ${counts[k] || 0}`]))
      .map(([k, label]) => h('button', { class: 'chip', 'aria-pressed': String(state.filter === k), onclick: () => { state.filter = k; refresh(); } }, label)));

  const head = h('div', { class: 'section-head' }, h('h2', null, 'Journey'),
    isParent() && h('button', { class: 'btn primary', onclick: () => entryForm(c) }, '＋ Add a moment'));

  let timeline;
  if (!shown.length) {
    timeline = h('div', { class: 'empty' }, h('span', { class: 'big' }, '🌱'),
      entries.length ? 'Nothing here yet for this area.' : isParent() ? 'Plant the first moment — a painting, a speech, a certificate.' : 'Nothing has been added yet.');
  } else {
    timeline = h('div', { class: 'timeline' });
    let lastMonth = '';
    for (const e of shown) {
      const m = monthLabel(e.date);
      if (m !== lastMonth) { timeline.append(h('div', { class: 'month' }, m)); lastMonth = m; }
      timeline.append(entryCard(e, c));
    }
  }
  main.replaceChildren(hero, chips, head, timeline);
}

function entryCard(e, c) {
  const [emoji, label] = CATS[e.category] || CATS.other;
  return buildEntry(e, c, emoji, label);
}
function buildEntry(e, c, emoji, label) {
  return h('article', { class: 'card entry', 'data-cat': e.category },
    h('div', { class: 'entry-head' },
      h('div', { class: 'main' },
        h('span', { class: 'badge' }, `${emoji} ${label}`),
        h('h3', null, e.title),
        h('div', { class: 'when' }, fmtDate(e.date))),
      isParent() && h('button', { class: 'btn small ghost', 'aria-label': `Edit ${e.title}`, onclick: () => entryForm(c, e) }, 'Edit')),
    e.notes && h('p', { class: 'notes' }, e.notes),
    e.media.length > 0 && h('div', { class: 'media' }, e.media.map(mediaItem)));
}

function mediaItem(m) {
  const src = `/media/${m.id}`;
  if (m.mime.startsWith('image/')) {
    const img = h('img', { src, alt: m.original || 'Photo', loading: 'lazy', onclick: () => lightbox(src, m.original) });
    img.addEventListener('error', () => img.replaceWith(fileLink(m)));
    return img;
  }
  if (m.mime.startsWith('audio/')) return h('div', { class: 'wide' }, h('audio', { src, controls: true, preload: 'none' }));
  if (m.mime.startsWith('video/')) return h('video', { src, controls: true, preload: 'metadata', playsinline: true, class: 'wide' });
  return fileLink(m);
}
const fileLink = (m) => h('a', { class: 'file wide', href: `/media/${m.id}`, target: '_blank', rel: 'noopener' }, '📄 ', m.original || 'File');
function lightbox(src, alt) {
  const box = h('div', { class: 'lightbox', onclick: (e) => { if (e.target === box) box.remove(); } },
    h('img', { src, alt: alt || '' }), h('button', { class: 'btn', onclick: () => box.remove() }, 'Close'));
  document.body.append(box);
}

function entryForm(c, entry) {
  const editing = !!entry;
  const existing = editing && entry.media.length && h('div', { class: 'field' },
    h('span', { class: 'muted small' }, 'Attached'),
    h('div', { class: 'existing-media' }, entry.media.map((m) => {
      const chip = h('span', { class: 'em' }, m.original || 'file',
        h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Remove ${m.original || 'file'}`, onclick: async () => {
          if (!(await confirmBox('Remove this file from the moment?', 'Remove'))) return;
          await api('DELETE', `/api/media/${m.id}`); chip.remove(); refresh();
        } }, '✕'));
      return chip;
    })));
  openForm({
    title: editing ? 'Edit moment' : 'Add a moment',
    submitLabel: editing ? 'Save' : 'Add to journey',
    values: entry || { date: todayIso(), category: state.filter !== 'all' ? state.filter : 'art' },
    fields: [
      { name: 'title', label: 'What happened?', required: true, max: 160 },
      { name: 'category', label: 'Area', type: 'select', options: catOptions() },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'notes', label: 'Notes — scores, feedback, how it felt', type: 'textarea', max: 5000 },
      { name: 'files', label: editing ? 'Add more photos, recordings or PDFs' : 'Photos, recordings, videos or PDFs', type: 'files', hint: 'Up to 8 files, 80 MB each.' },
    ],
    extra: existing,
    onSubmit: async ({ values, files }) => {
      if (editing) {
        await api('PUT', `/api/entries/${entry.id}`, { title: values.title, category: values.category, date: values.date, notes: values.notes });
        if (files.length) { const fd = new FormData(); files.forEach((f) => fd.append('files', f)); await api('POST', `/api/entries/${entry.id}/media`, fd); }
      } else {
        const fd = new FormData();
        ['title', 'category', 'date', 'notes'].forEach((k) => fd.set(k, values[k]));
        files.forEach((f) => fd.append('files', f));
        await api('POST', `/api/children/${c.id}/entries`, fd);
      }
      state.filter = 'all';
      refresh();
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/entries/${entry.id}`); closeModal(); refresh(); } : null,
  });
}

/* ---------- dashboard (parents) ---------- */
async function viewDashboard(main) {
  const c = child();
  const [sum, events, activities, ladder] = await Promise.all([
    api('GET', `/api/children/${c.id}/summary`),
    api('GET', `/api/children/${c.id}/events`),
    api('GET', `/api/children/${c.id}/activities`),
    api('GET', `/api/children/${c.id}/ladder`),
  ]);
  const tile = (n, label) => h('div', { class: 'card tile' }, h('b', null, n), h('span', null, label));
  const tiles = h('div', { class: 'tiles' },
    tile(sum.entries, 'moments saved'), tile(sum.activeActivities, 'active activities'),
    tile(sum.upcomingEvents, 'coming up'), tile(sum.examsPassed, 'levels passed'));

  /* events */
  const upcoming = events.filter((e) => e.status === 'upcoming');
  const past = events.filter((e) => e.status !== 'upcoming').reverse().slice(0, 5);
  const eventRow = (e) => {
    const d = parseDay(e.date);
    const overdue = e.status === 'upcoming' && e.date < todayIso();
    return h('div', { class: `card item ${e.status === 'done' ? 'done' : ''}` },
      h('div', { class: 'datebox' }, d.toLocaleDateString(undefined, { month: 'short' }), h('b', null, d.getDate())),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, e.title),
        h('div', { class: 'small muted' }, [(EVENT_KINDS.find((k) => k[0] === e.kind) || [])[1], e.location, e.result && `Result: ${e.result}`, overdue && 'date passed — update?'].filter(Boolean).join(' · '))),
      h('div', { class: 'acts' },
        e.status === 'upcoming' && h('button', { class: 'btn small', onclick: () => eventForm(c, { ...e, status: 'done' }) }, 'Done'),
        h('button', { class: 'btn small ghost', 'aria-label': `Edit ${e.title}`, onclick: () => eventForm(c, e) }, 'Edit')));
  };

  /* activities */
  const actRow = (a) => h('div', { class: `card item ${a.active ? '' : 'done'}`, 'data-cat': a.category || 'other' },
    h('span', { class: 'badge' }, (CATS[a.category] || CATS.other)[0]),
    h('div', { class: 'main' }, h('div', { class: 'title' }, a.name),
      h('div', { class: 'small muted' }, [a.schedule, a.provider, !a.active && 'paused'].filter(Boolean).join(' · '))),
    h('button', { class: 'btn small ghost', 'aria-label': `Edit ${a.name}`, onclick: () => activityForm(c, a) }, 'Edit'));

  /* exam ladder */
  const tracks = new Map();
  ladder.forEach((l) => { if (!tracks.has(l.track)) tracks.set(l.track, []); tracks.get(l.track).push(l); });
  const ladderCard = (track, steps) => h('div', { class: 'card track' }, h('h3', null, track),
    h('div', { class: 'steps' }, steps.map((s) => h('button', { class: `step ${s.status}`, onclick: () => ladderForm(c, s, ladder) },
      h('div', { class: 'dot' }, s.status === 'passed' ? '✓' : s.status === 'preparing' ? '…' : ''),
      h('div', { class: 'lvl' }, s.level),
      h('div', { class: 'sc' }, [s.score, s.date && fmtDate(s.date)].filter(Boolean).join(' · ') || s.status)))));

  const sec = (title, addLabel, onAdd, content) => [
    h('div', { class: 'section-head' }, h('h2', null, title), h('button', { class: 'btn small', onclick: onAdd }, addLabel)), content];
  const emptyBox = (t) => h('div', { class: 'empty' }, t);

  main.replaceChildren(
    tiles,
    ...sec('Coming up', '＋ Event', () => eventForm(c), upcoming.length ? h('div', { class: 'list' }, upcoming.map(eventRow)) : emptyBox('No contests or exams planned. Add the next one.')),
    ...(past.length ? [h('div', { class: 'month' }, 'Recently done'), h('div', { class: 'list' }, past.map(eventRow))] : []),
    ...sec('Activities', '＋ Activity', () => activityForm(c), activities.length ? h('div', { class: 'list' }, activities.map(actRow)) : emptyBox('Hindi tuition, art class, Toastmasters youth… add them here.')),
    ...sec('Exam ladder', '＋ Level', () => ladderForm(c, null, ladder), tracks.size ? h('div', { class: 'list' }, [...tracks].map(([t, s]) => ladderCard(t, s))) : emptyBox('Add exam levels to track progress.')));
}

function eventForm(c, ev) {
  const editing = !!(ev && ev.id);
  openForm({
    title: editing ? 'Edit event' : 'New event', values: ev || { date: todayIso(), kind: 'contest', status: 'upcoming' },
    fields: [
      { name: 'title', label: 'Event', required: true, max: 160 },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'kind', label: 'Type', type: 'select', options: EVENT_KINDS },
      { name: 'location', label: 'Where', max: 160 },
      { name: 'status', label: 'Status', type: 'select', options: [['upcoming', 'Upcoming'], ['done', 'Done'], ['skipped', 'Skipped']] },
      { name: 'result', label: 'Result / placing', max: 300 },
      { name: 'notes', label: 'Notes', type: 'textarea', max: 2000 },
    ],
    onSubmit: async ({ values }) => {
      await api(editing ? 'PUT' : 'POST', editing ? `/api/events/${ev.id}` : `/api/children/${c.id}/events`, values);
      refresh();
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/events/${ev.id}`); closeModal(); refresh(); } : null,
  });
}

function activityForm(c, a) {
  const editing = !!a;
  openForm({
    title: editing ? 'Edit activity' : 'New activity', values: a || { active: true, category: 'other' },
    fields: [
      { name: 'name', label: 'Activity', required: true, max: 120 },
      { name: 'category', label: 'Area', type: 'select', options: catOptions() },
      { name: 'schedule', label: 'When (e.g. Sat 10am)', max: 200 },
      { name: 'provider', label: 'Teacher / place', max: 120 },
      { name: 'notes', label: 'Notes', type: 'textarea', max: 2000 },
      { name: 'active', label: 'Currently active', type: 'checkbox', default: true },
    ],
    onSubmit: async ({ values }) => {
      await api(editing ? 'PUT' : 'POST', editing ? `/api/activities/${a.id}` : `/api/children/${c.id}/activities`, values);
      refresh();
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/activities/${a.id}`); closeModal(); refresh(); } : null,
  });
}

function ladderForm(c, step, all) {
  const editing = !!step;
  const trackList = h('datalist', { id: 'tracks' }, [...new Set(all.map((l) => l.track))].map((t) => h('option', { value: t })));
  openForm({
    title: editing ? 'Edit level' : 'New level', values: step || { status: 'planned', track: all[0]?.track || '' },
    fields: [
      { name: 'track', label: 'Track (e.g. Cambridge English, Hindi)', required: true, max: 80, list: 'tracks' },
      { name: 'level', label: 'Level', required: true, max: 80 },
      { name: 'status', label: 'Status', type: 'select', options: [['planned', 'Planned'], ['preparing', 'Preparing'], ['passed', 'Passed']] },
      { name: 'date', label: 'Exam / result date', type: 'date' },
      { name: 'score', label: 'Score (e.g. 15 shields)', max: 120 },
      { name: 'notes', label: 'Notes', type: 'textarea', max: 2000 },
      { name: 'sort', label: 'Order within track (0 = first)', type: 'number', default: all.filter((l) => l.track === (all[0]?.track)).length },
    ],
    extra: trackList,
    onSubmit: async ({ values }) => {
      await api(editing ? 'PUT' : 'POST', editing ? `/api/ladder/${step.id}` : `/api/children/${c.id}/ladder`, values);
      refresh();
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/ladder/${step.id}`); closeModal(); refresh(); } : null,
  });
}

/* ---------- settings / family ---------- */
async function viewSettings(main) {
  const c = child();
  const parts = [];

  if (isParent() && c) {
    parts.push(
      h('div', { class: 'section-head' }, h('h2', null, `${c.nickname || c.name}’s profile`),
        h('button', { class: 'btn small', onclick: () => childForm(c) }, 'Edit')),
      h('div', { class: 'card' }, h('strong', null, c.name), h('div', { class: 'muted small' }, [c.dob && `Born ${fmtDate(c.dob)} (${ageText(c.dob)})`, c.bio].filter(Boolean).join(' · ') || 'Add a birthday and a short bio.')),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => childForm(null) }, '＋ Add another child')));

    const users = await api('GET', '/api/users');
    parts.push(
      h('div', { class: 'section-head' }, h('h2', null, 'Who can sign in'), h('button', { class: 'btn small', onclick: () => userForm() }, '＋ Invite')),
      h('p', { class: 'muted small' }, 'Family members can view the portfolio only. Parents can add and edit everything. Share the password yourself — nothing is ever public.'),
      h('div', { class: 'list' }, users.map((u) => h('div', { class: 'card item' },
        h('div', { class: 'main' }, h('div', { class: 'title' }, u.name, u.id === state.user.id && ' (you)'), h('div', { class: 'small muted' }, `${u.email} · ${u.role}`)),
        u.id !== state.user.id && h('button', { class: 'btn small danger', onclick: async () => {
          if (await confirmBox(`Remove ${u.name}’s access?`, 'Remove')) { await api('DELETE', `/api/users/${u.id}`); refresh(); }
        } }, 'Remove')))));
  }

  parts.push(
    h('div', { class: 'section-head' }, h('h2', null, 'Your account')),
    h('div', { class: 'card stack' },
      h('div', null, h('strong', null, state.user.name), h('div', { class: 'small muted' }, `${state.user.email} · ${state.user.role}`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: passwordForm }, 'Change password'),
        h('button', { class: 'btn', onclick: async () => { await api('POST', '/api/logout'); state.user = null; boot(); } }, 'Sign out'))));
  main.replaceChildren(...parts);
}

function childForm(c) {
  const editing = !!c;
  openForm({
    title: editing ? 'Edit profile' : 'Add a child', values: c || {},
    fields: [
      { name: 'name', label: 'Full name', required: true, max: 120 },
      { name: 'nickname', label: 'Short name shown in the app', max: 60 },
      { name: 'dob', label: 'Date of birth', type: 'date' },
      { name: 'bio', label: 'A line about them', type: 'textarea', max: 2000 },
    ],
    onSubmit: async ({ values }) => {
      if (editing) { const u = await api('PUT', `/api/children/${c.id}`, values); Object.assign(c, u); }
      else { const n = await api('POST', '/api/children', values); state.children.push(n); state.childId = n.id; state.view = 'portfolio'; }
      refresh();
    },
  });
}
function userForm() {
  openForm({
    title: 'Invite someone', submitLabel: 'Create account', values: { role: 'family' },
    fields: [
      { name: 'name', label: 'Name', required: true, max: 80 },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Temporary password (8+ characters)', required: true, type: 'text', autocomplete: 'off' },
      { name: 'role', label: 'Access', type: 'select', options: [['family', 'Family — view only'], ['parent', 'Parent — can edit']] },
    ],
    onSubmit: async ({ values }) => { await api('POST', '/api/users', values); toast('Account created — share the password with them'); refresh(); },
  });
}
function passwordForm() {
  openForm({
    title: 'Change password', values: {},
    fields: [
      { name: 'current', label: 'Current password', type: 'password', required: true, autocomplete: 'current-password' },
      { name: 'next', label: 'New password (8+ characters)', type: 'password', required: true, autocomplete: 'new-password' },
    ],
    onSubmit: async ({ values }) => { await api('POST', '/api/me/password', values); toast('Password updated'); },
  });
}

/* ---------- go ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
