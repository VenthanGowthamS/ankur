'use strict';
/* Ankur — a private growth portfolio. Vanilla JS, no build step.
   All DOM is built with h() (never innerHTML with user data), so notes and titles can't inject markup. */

const CATS = {
  art: ['🎨', 'Art'], speech: ['🎤', 'Speech'], exam: ['📜', 'Exams'], olympiad: ['🧮', 'Olympiads'], coding: ['💻', 'Coding'], robotics: ['🤖', 'Robotics'], hindi: ['🪔', 'Hindi'],
  martial: ['🥋', 'Martial arts'], sports: ['⚽', 'Sports'], skating: ['⛸️', 'Skating'],
  accolade: ['🏅', 'Accolades'], school: ['🏫', 'School'], other: ['✨', 'Other'],
};
const LEVELS = [['school', '🏫 School'], ['zonal', '📍 Zonal'], ['national', '🏆 National'], ['international', '🌍 International']];
const SUBJECTS = [['maths', '🔢 Maths'], ['english', '📖 English'], ['science', '🔬 Science'], ['computer', '💻 Computer'],
  ['gk', '🌍 General knowledge'], ['hindi', '🪔 Hindi'], ['social', '🗺️ Social studies'], ['other', '✨ Other']];
const subjectLabel = (k) => (SUBJECTS.find((x) => x[0] === k) || [, k])[1];
// "52 / 60" -> "52 / 60 · 87%"; anything else is shown as typed.
function scoreText(e) {
  if (!e.score) return '';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(e.score);
  return m && Number(m[2]) > 0 ? `${e.score.trim()} · ${Math.round((Number(m[1]) / Number(m[2])) * 100)}%` : e.score;
}
// Ready-made ladders (belts, olympiad rounds…). Editable after adding.
const LADDERS = {
  'Karate belts': ['White belt', 'Yellow belt', 'Orange belt', 'Green belt', 'Blue belt', 'Brown belt', 'Black belt'],
  'Taekwondo belts': ['White belt', 'Yellow belt', 'Green belt', 'Blue belt', 'Red belt', 'Black belt'],
  'SOF Olympiad stages': ['Level 1', 'Level 2'],
  'SASMO awards': ['Participation', 'Honourable mention', 'Bronze', 'Silver', 'Gold', 'Perfect score'],
  'Skating levels': ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
  'Coding levels': ['Block coding (Scratch)', 'Python basics', 'Games & apps', 'Web basics', 'Own projects'],
  'Robotics levels': ['Build basics', 'Sensors & motors', 'Programming robots', 'Autonomous challenges', 'Robotics competition'],
  'Football': ['School team', 'Zonal team', 'National squad', 'International'],
};
const EVENT_KINDS = [['contest', 'Contest'], ['exam', 'Exam'], ['performance', 'Performance'], ['school', 'School'], ['other', 'Other']];
const catOptions = () => Object.entries(CATS).map(([v, [e, l]]) => [v, `${e} ${l}`]);

const state = { user: null, children: [], childId: null, view: 'portfolio', filter: 'all', buddy: null, previewKid: false };

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
const isParent = () => !!state.user && state.user.role === 'parent' && !state.previewKid;
const isKid = () => !!state.user && (state.user.role === 'child' || state.previewKid === true);
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
    if (isKid()) state.view = 'portfolio';
    renderShell();
  } catch (ex) {
    root().replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'card' }, h('p', null, ex.message), h('button', { class: 'btn', onclick: boot }, 'Try again'))));
  }
}

function renderAuth(needsSetup) {
  let kid = false;
  let creating = needsSetup; // a fresh install opens on "Create account"; otherwise on "Sign in"
  if (!needsSetup) { try { kid = localStorage.getItem('ankur_login_kid') === '1'; } catch { /* private mode: fine */ } }

  const draw = () => {
    const setup = creating && needsSetup && !kid;       // the one-time first-parent form
    const invitedOnly = creating && !needsSetup && !kid; // accounts already exist: new people are invited
    const err = h('div', { class: 'error', role: 'alert' });
    const field = (label, name, type = 'text', extra = {}) => h('label', { class: 'field' }, label, h('input', { name, type, required: true, ...extra }));
    const form = h('form', {
      class: 'fields',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        const d = Object.fromEntries(new FormData(form));
        try {
          await api('POST', setup ? '/api/setup' : '/api/login', d);
          state.view = 'portfolio'; state.filter = 'all'; state.previewKid = false;
          await boot();
        } catch (ex) {
          err.textContent = kid && /wrong|password/i.test(ex.message) ? 'Oops! That name or secret word doesn’t match. Try again 🙂'
            : needsSetup && !setup && /wrong/i.test(ex.message) ? 'No accounts exist yet — tap “Create account” below to make the first one.' : ex.message;
        }
      },
    },
    setup && field('Your name', 'name', 'text', { autocomplete: 'name' }),
    kid
      ? field('Your name', 'email', 'text', { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'the name your parents gave you here' })
      : field('Email or username', 'email', 'text', { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' }),
    kid ? field('Your secret word', 'password', 'password', { autocomplete: 'current-password' })
      : field(setup ? 'Choose a password (8+ characters)' : 'Password', 'password', 'password', { autocomplete: setup ? 'new-password' : 'current-password', minlength: setup ? 8 : 1 }),
    kid && h('label', { class: 'field check' }, h('input', { type: 'checkbox', onchange: (e) => { form.elements.password.type = e.target.checked ? 'text' : 'password'; } }), 'Show my secret word'),
    setup && field('Child’s name', 'childName'),
    setup && h('label', { class: 'field' }, 'Child’s date of birth (optional)', h('input', { name: 'childDob', type: 'date' })),
    err,
    h('button', { class: `btn primary${kid ? ' big' : ''}`, type: 'submit' }, setup ? 'Create our Ankur' : kid ? 'Let’s go! 🚀' : 'Sign in'));

    const setMode = (v) => {
      kid = v;
      if (v) creating = false;
      try { localStorage.setItem('ankur_login_kid', v ? '1' : '0'); } catch { /* ignore */ }
      draw();
    };
    const modeSwitch = !needsSetup && h('div', { class: 'seg', role: 'group', 'aria-label': 'Who is signing in?' },
      h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(!kid), onclick: () => setMode(false) }, '🧑 Grown-up'),
      h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(kid), onclick: () => setMode(true) }, '🧒 I’m a kid'));

    // Sign in / Create account, both always one tap away for grown-ups.
    const swap = !kid && h('p', { class: 'swap' }, creating ? 'Already have an account? ' : 'New here? ',
      h('button', { type: 'button', class: 'link', onclick: () => { creating = !creating; draw(); } }, creating ? 'Sign in' : 'Create account'));

    const tag = setup ? 'First time here — set up the parent account.'
      : invitedOnly ? 'Ankur is private.'
      : kid ? 'Type your name and your secret word to see your journey.' : 'A private place where our children’s journey grows.';
    const invitedNote = h('div', { class: 'note' },
      'Accounts here are by invitation, so strangers can’t sign up. Ask a parent to add you from ', h('strong', null, 'Family → Invite'), ', then come back and sign in.');

    root().replaceChildren(h('main', { class: `auth${kid ? ' kid-login' : ''}` }, h('div', { class: 'card' },
      modeSwitch,
      kid ? buddyFace('logo kid-logo') : sproutSvg('logo'),
      h('h1', null, kid ? 'Hi there! 👋' : 'Ankur'),
      h('p', { class: 'tag' }, tag),
      invitedOnly ? invitedNote : form,
      swap)));
    form.querySelector('input')?.focus();
  };
  draw();
}

/* ---------- shell ---------- */
function renderShell() {
  document.querySelector('.buddy')?.remove();
  const kids = state.children;
  const tabs = isKid() ? [] : [['portfolio', '🌱', 'Portfolio'], ...(isParent() ? [['dashboard', '📊', 'Dashboard']] : []), ['settings', '⚙️', isParent() ? 'Family' : 'Account']];
  const main = h('main', { id: 'main' });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' }, tabs.map(([id, ic, label]) =>
    h('button', { 'aria-current': state.view === id ? 'page' : null, onclick: () => { state.view = id; renderShell(); } }, h('span', { class: 'ic' }, ic), label)));
  const switcher = kids.length > 1 && h('label', { class: 'child-switch' }, h('span', { class: 'sr' }, 'Child'),
    h('select', { onchange: (e) => { state.childId = Number(e.target.value); renderShell(); } },
      kids.map((c) => h('option', { value: c.id, selected: c.id === state.childId }, c.nickname || c.name))));
  const bye = isKid() && h('button', { class: 'btn small', onclick: async () => {
    if (state.previewKid) { state.previewKid = false; state.view = 'settings'; return renderShell(); }
    await api('POST', '/api/logout'); state.user = null; state.buddy = null; boot();
  } }, state.previewKid ? '← Back to parent view' : 'Bye 👋');
  root().replaceChildren(h('div', { class: `shell${isKid() ? ' kid' : ''}` },
    h('header', { class: 'topbar' }, h('div', { class: 'brand' }, isKid() ? buddyFace() : sproutSvg(), 'Ankur'), h('div', { class: 'spacer' }), switcher, bye),
    tabs.length ? nav : null, main));
  if (isKid() && child()) mountBuddy(child());
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
    h('h1', null, isKid() ? `Hi ${c.nickname || c.name}! 🌟` : c.name),
    h('p', { class: 'muted' }, isKid() ? 'This is your journey — everything you’ve done and loved.' : [ageText(c.dob), c.bio].filter(Boolean).join(' · ') || 'Every small step, kept safe.'),
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
      entries.length ? 'Nothing here yet for this area.' : isParent() ? 'Plant the first moment — a painting, a speech, a certificate.' : 'Nothing has been added yet.',
      !entries.length && isParent() && h('p', null, h('button', { class: 'btn', onclick: () => loadSamples(c) }, '✨ Or load sample moments to try the app')));
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
        h('div', { class: 'when' }, fmtDate(e.date)),
        (e.level || e.result || e.subject || e.score) && h('div', { class: 'wins' },
          e.subject && h('span', { class: 'win subject' }, subjectLabel(e.subject)),
          e.score && h('span', { class: 'win score' }, `📝 ${scoreText(e)}`),
          e.result && h('span', { class: 'win result' }, `🏅 ${e.result}`),
          e.level && h('span', { class: 'win level' }, (LEVELS.find((l) => l[0] === e.level) || [, e.level])[1]))),
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
      { name: 'subject', label: 'Subject — for olympiads and tests', type: 'select', options: [['', '— none —'], ...SUBJECTS] },
      { name: 'score', label: 'Score', max: 40, hint: 'Marks out of total, e.g. 52 / 60 — the percentage is worked out for you' },
      { name: 'level', label: 'Level of the event', type: 'select', options: [['', '— not a competition —'], ...LEVELS] },
      { name: 'result', label: 'Result — medal, rank, belt, badge', max: 120, hint: 'e.g. Gold medal · Zonal rank 9 · Honourable mention · Yellow belt' },
      { name: 'notes', label: 'Notes — scores, feedback, how it felt', type: 'textarea', max: 5000 },
      { name: 'files', label: editing ? 'Add more photos, recordings or PDFs' : 'Photos, recordings, videos or PDFs', type: 'files', hint: 'Up to 8 files, 80 MB each.' },
    ],
    extra: existing,
    onSubmit: async ({ values, files }) => {
      if (editing) {
        await api('PUT', `/api/entries/${entry.id}`, { title: values.title, category: values.category, date: values.date, notes: values.notes, level: values.level, result: values.result, subject: values.subject, score: values.score });
        if (files.length) { const fd = new FormData(); files.forEach((f) => fd.append('files', f)); await api('POST', `/api/entries/${entry.id}/media`, fd); }
      } else {
        const fd = new FormData();
        ['title', 'category', 'date', 'notes', 'level', 'result', 'subject', 'score'].forEach((k) => fd.set(k, values[k]));
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
  const [sum, events, activities, ladder, olympiads] = await Promise.all([
    api('GET', `/api/children/${c.id}/summary`),
    api('GET', `/api/children/${c.id}/events`),
    api('GET', `/api/children/${c.id}/activities`),
    api('GET', `/api/children/${c.id}/ladder`),
    api('GET', `/api/children/${c.id}/entries?category=olympiad`),
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

  const bySubject = new Map();
  olympiads.forEach((e) => { const k = e.subject || 'other'; if (!bySubject.has(k)) bySubject.set(k, []); bySubject.get(k).push(e); });
  const scoreCard = (k, rows) => h('div', { class: 'card' }, h('h3', null, subjectLabel(k)),
    h('div', { class: 'scores' }, rows.map((r) => h('div', { class: 'score-row' },
      h('div', { class: 'main' }, h('div', { class: 'title' }, r.title), h('div', { class: 'small muted' }, [fmtDate(r.date), r.result].filter(Boolean).join(' · '))),
      h('b', { class: 'pts' }, scoreText(r) || '—')))));

  const sec = (title, addLabel, onAdd, content, extra) => [
    h('div', { class: 'section-head' }, h('h2', null, title), h('div', { class: 'row' }, extra, h('button', { class: 'btn small', onclick: onAdd }, addLabel))), content];
  const emptyBox = (t) => h('div', { class: 'empty' }, t);

  main.replaceChildren(
    tiles,
    ...sec('Coming up', '＋ Event', () => eventForm(c), upcoming.length ? h('div', { class: 'list' }, upcoming.map(eventRow)) : emptyBox('No contests or exams planned. Add the next one.')),
    ...(past.length ? [h('div', { class: 'month' }, 'Recently done'), h('div', { class: 'list' }, past.map(eventRow))] : []),
    ...sec('Activities', '＋ Activity', () => activityForm(c), activities.length ? h('div', { class: 'list' }, activities.map(actRow)) : emptyBox('Hindi tuition, art class, Toastmasters youth… add them here.')),
    ...(olympiads.length ? [h('div', { class: 'section-head' }, h('h2', null, 'Olympiad scores')), h('div', { class: 'list' }, [...bySubject].map(([k, r]) => scoreCard(k, r)))] : []),
    ...sec('Ladders & levels', '＋ Level', () => ladderForm(c, null, ladder), tracks.size ? h('div', { class: 'list' }, [...tracks].map(([t, s]) => ladderCard(t, s))) : emptyBox('Exam levels, belts, olympiad rounds — add a ladder to track progress.'),
      h('button', { class: 'btn small', onclick: () => ladderTemplateForm(c, tracks) }, '＋ Ladder')));
}

function ladderTemplateForm(c, existingTracks) {
  openForm({
    title: 'Add a ladder', submitLabel: 'Add ladder', values: { template: Object.keys(LADDERS)[0] },
    fields: [{ name: 'template', label: 'Choose one — you can rename or edit any step afterwards', type: 'select', options: Object.entries(LADDERS).map(([k, v]) => [k, `${k} (${v.length} steps)`]) }],
    onSubmit: async ({ values }) => {
      const track = values.template;
      if (existingTracks.has(track)) throw new Error(`“${track}” is already on the dashboard.`);
      for (const [i, level] of LADDERS[track].entries()) await api('POST', `/api/children/${c.id}/ladder`, { track, level, status: 'planned', sort: i });
      refresh();
    },
  });
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
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => childForm(null) }, '＋ Add another child')),
      h('div', { class: 'card item' },
        h('div', { class: 'main' }, h('div', { class: 'title' }, `See what ${c.nickname || c.name} sees`),
          h('div', { class: 'small muted' }, 'Preview the kid view with Buddy. Nothing changes.')),
        h('button', { class: 'btn', onclick: () => { state.previewKid = true; state.view = 'portfolio'; renderShell(); } }, '👀 Preview kid view')));

    const sum = await api('GET', `/api/children/${c.id}/summary`);
    parts.push(
      h('div', { class: 'card item' },
        h('div', { class: 'main' }, h('div', { class: 'title' }, 'Sample moments'),
          h('div', { class: 'small muted' }, sum.samples
            ? `${sum.samples} made-up moments (plus events and activities) are loaded so you can explore. Real ones you add are never touched.`
            : 'Fill the journey with made-up moments, a sound clip and a certificate, to see how everything works.')),
        sum.samples
          ? h('button', { class: 'btn danger', onclick: async () => {
            if (!(await confirmBox('Remove all the sample moments, events and activities? Anything you added yourself stays.', 'Remove samples'))) return;
            try { await api('DELETE', `/api/children/${c.id}/samples`); toast('Sample moments removed'); refresh(); } catch (ex) { toast(ex.message); }
          } }, 'Remove samples')
          : h('button', { class: 'btn', onclick: () => loadSamples(c) }, '✨ Load samples')));

    const users = await api('GET', '/api/users');
    parts.push(
      h('div', { class: 'section-head' }, h('h2', null, 'Who can sign in'), h('button', { class: 'btn small', onclick: () => userForm() }, '＋ Invite')),
      h('p', { class: 'muted small' }, 'Family members can view the portfolio only. Parents can add and edit everything. Share the password yourself — nothing is ever public.'),
      h('div', { class: 'list' }, users.map((u) => h('div', { class: 'card item' },
        h('div', { class: 'main' }, h('div', { class: 'title' }, u.name, u.id === state.user.id && ' (you)'), h('div', { class: 'small muted' }, u.role === 'child' ? `username “${u.email}” · kid login — tap “I’m a kid” on the sign-in page` : `${u.email} · ${u.role}`)),
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

async function loadSamples(c) {
  try {
    await api('POST', `/api/children/${c.id}/samples`);
    state.view = 'portfolio'; state.filter = 'all';
    toast('Sample moments added — remove them any time in the Family tab');
    refresh();
  } catch (ex) { toast(ex.message); }
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
      { name: 'email', label: 'Email — or a simple username for a child', required: true, hint: 'Kids sign in with a short username like “mira”.' },
      { name: 'password', label: 'Password (8+ characters; 6+ for a child)', required: true, type: 'text', autocomplete: 'off' },
      { name: 'role', label: 'Access', type: 'select', options: [['family', 'Family — view only'], ['child', `Child — ${(child() || {}).name || 'kid'}’s own login, view only`], ['parent', 'Parent — can edit']] },
    ],
    onSubmit: async ({ values }) => {
      if (values.role === 'child') values.childId = state.childId;
      await api('POST', '/api/users', values);
      toast(values.role === 'child' ? `Done! On the sign-in page, ${values.name} taps “I’m a kid”.` : 'Account created — share the password with them'); refresh();
    },
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


/* ---------- Buddy: Ankur the sprout, for kid logins only ----------
   Deliberately scripted: it only reads facts from /buddy and never takes free text,
   so a child can't type anything to it and it can't say anything unexpected. */
function buddyFace(cls) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  const add = (tag, attrs) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); s.append(e); };
  add('path', { d: 'M50 30 C50 14 38 8 26 10 C26 24 34 32 50 30z', fill: '#4f7f3a' });
  add('path', { d: 'M50 30 C50 12 64 6 76 9 C77 24 66 33 50 30z', fill: '#e8a33d' });
  add('circle', { cx: 50, cy: 60, r: 30, fill: '#8bbf6a' });
  add('circle', { cx: 39, cy: 56, r: 5, fill: '#2b2a22' }); add('circle', { cx: 61, cy: 56, r: 5, fill: '#2b2a22' });
  add('circle', { cx: 41, cy: 54, r: 1.8, fill: '#fff' }); add('circle', { cx: 63, cy: 54, r: 1.8, fill: '#fff' });
  add('circle', { cx: 32, cy: 66, r: 5, fill: '#f4a58a', opacity: '.6' }); add('circle', { cx: 68, cy: 66, r: 5, fill: '#f4a58a', opacity: '.6' });
  add('path', { d: 'M41 68 Q50 77 59 68', stroke: '#2b2a22', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' });
  return s;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const CHEERS = [
  'You are growing every single day! 🌱', 'Brave, curious and kind — that’s you!', 'Every little step counts. Look how far you’ve come!',
  'Practice makes sparkle ✨', 'I’m so proud of you! 🎉', 'You can do hard things. I believe in you! 💪',
];

async function mountBuddy(c) {
  if (!state.buddy || state.buddy.childId !== c.id) {
    try { state.buddy = { childId: c.id, facts: await api('GET', `/api/children/${c.id}/buddy`) }; } catch { return; }
  }
  if (!document.getElementById('app').querySelector('.shell.kid')) return;
  const f = state.buddy.facts;
  const name = f.name;
  const say = h('div', { class: 'bubble', 'aria-live': 'polite' });
  const pic = h('div', { class: 'bubble-pic' });
  const chips = h('div', { class: 'buddy-chips' });
  const panel = h('div', { class: 'buddy-panel hidden', role: 'dialog', 'aria-label': 'Ankur the sprout' },
    h('div', { class: 'buddy-head' }, h('strong', null, 'Ankur the sprout 🌱'),
      h('button', { class: 'btn small ghost', 'aria-label': 'Close', onclick: () => panel.classList.add('hidden') }, '✕')),
    say, pic, chips);

  const areas = Object.keys(f.counts).length;
  const talk = (text, imageId, alt) => {
    say.textContent = text;
    pic.replaceChildren(...(imageId ? [h('img', { src: `/media/${imageId}`, alt: alt || '' })] : []));
  };
  const goTo = (cat) => { state.filter = cat; refresh(); document.getElementById('main')?.scrollIntoView({ behavior: 'smooth' }); };

  const topics = [];
  if (f.total > 0) {
    topics.push(['⭐ How many moments?', () => talk(`You have ${f.total} moment${f.total > 1 ? 's' : ''} saved in ${areas} area${areas > 1 ? 's' : ''}. Wow, ${name}!`)]);
    topics.push(['💭 Remember something', () => {
      const r = f.remember;
      talk(`Remember “${r.title}” from ${fmtDate(r.date)}? That was a good one!`, r.imageId, r.title);
    }]);
    topics.push(['🏆 What am I proud of?', () => {
      if (f.lastPassed) talk(`You passed ${f.lastPassed.level}${f.lastPassed.score ? ` with ${f.lastPassed.score}` : ''}! 🎉`);
      else talk(`Your newest moment is “${f.latest.title}”. Keep going!`, f.latest.imageId, f.latest.title);
    }]);
  }
  topics.push(['📅 What’s coming up?', () => talk(f.nextEvent
    ? `${f.nextEvent.title} is on ${fmtDate(f.nextEvent.date)}. You’ve got this! 💪`
    : 'Nothing is planned yet. Ask Mummy or Papa about the next contest!')]);
  Object.entries(f.counts).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([cat]) => {
    const [emoji, label] = CATS[cat] || CATS.other;
    topics.push([`${emoji} Show my ${label}`, () => { talk(`Here are your ${label} moments!`); goTo(cat); }]);
  });
  if (state.filter !== 'all') topics.push(['🌈 Show everything', () => goTo('all')]);
  topics.push(['🎉 Cheer me on', () => talk(pick(CHEERS))]);

  chips.replaceChildren(...topics.map(([label, fn]) => h('button', { class: 'chip', onclick: fn }, label)));
  const hello = () => talk(f.total > 0
    ? `Hi ${name}! I’m Ankur, your sprout friend. I keep all your moments safe. What would you like to see?`
    : `Hi ${name}! Your journey is just starting. Ask Mummy or Papa to add your first moment!`);

  const btn = h('button', { class: 'buddy-btn', 'aria-label': 'Talk to Ankur the sprout', onclick: () => {
    panel.classList.toggle('hidden');
    hint.remove();
    if (!panel.classList.contains('hidden')) hello();
  } }, buddyFace());
  const hint = h('div', { class: 'buddy-hint' }, `Hi ${name}! Tap me 👋`);
  document.body.append(h('div', { class: 'buddy' }, panel, hint, btn));
}

/* ---------- go ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
