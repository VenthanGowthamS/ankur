'use strict';
/* Kaizen Folio — a private growth portfolio and extra-curricular tracker. Vanilla JS, no build step.
   All DOM is built with h() (never innerHTML with user data), so notes and titles can't inject markup. */

const { GROUPS, CATS, LEVELS, SUBJECTS, OLYMPIADS, ROLES, AUTHORSHIP, LADDERS, EVENT_KINDS, PATHWAY, GOAL_IDEAS, DSA_AREAS, GOAL_STATUS, UNI_REGIONS, UNIS, AGE_GUIDE } = window.ANKUR; // from catalog.js
const subjectLabel = (k) => (SUBJECTS.find((x) => x[0] === k) || [, k])[1];
const authorLabel = (k) => { const a = AUTHORSHIP.find((x) => x[0] === k); return a ? `${a[1]} ${a[2]}` : ''; };
const levelLabel = (k) => (LEVELS.find((x) => x[0] === k) || [, k])[1];
const groupOf = (cat) => (CATS[cat] || CATS.other)[2];
// "52 / 60" -> "52 / 60 · 87%"; anything else is shown as typed.
function scoreText(e) {
  if (!e.score) return '';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(e.score);
  return m && Number(m[2]) > 0 ? `${e.score.trim()} · ${Math.round((Number(m[1]) / Number(m[2])) * 100)}%` : e.score;
}
const catOptions = () => Object.entries(CATS).map(([v, [e, l]]) => [v, `${e} ${l}`]);

const state = { user: null, children: [], childId: null, view: 'portfolio', group: 'all', filter: 'all', buddy: null, previewKid: false };

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
    else if (f.type === 'files') input = h('input', { type: 'file', name: f.name, accept: f.accept || 'image/*,audio/*,video/*,application/pdf', multiple: !f.single });
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
  document.querySelector('.buddy')?.remove(); document.querySelector('.surfer')?.remove();
  try {
    const me = await api('GET', '/api/me');
    if (!me.user) return renderAuth(me.needsSetup);
    if (!state.user || state.user.id !== me.user.id) state.buddy = null;
    state.user = me.user;
    state.children = await api('GET', '/api/children');
    if (!state.children.find((c) => c.id === state.childId)) state.childId = state.children[0]?.id ?? null;
    if (!isParent() && ['dashboard', 'goals'].includes(state.view)) state.view = 'portfolio';
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
          Object.assign(state, { view: 'portfolio', group: 'all', filter: 'all', previewKid: false });
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
    h('button', { class: `btn primary${kid ? ' big' : ''}`, type: 'submit' }, setup ? 'Create our Kaizen Folio' : kid ? 'Let’s go! 🚀' : 'Sign in'));

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
      : invitedOnly ? 'Kaizen Folio is private.'
      : kid ? 'Type your name and your secret word to see your journey.' : 'Small steps, every day — a private place where our children’s journey grows.';
    const invitedNote = h('div', { class: 'note' },
      'Accounts here are by invitation, so strangers can’t sign up. Ask a parent to add you from ', h('strong', null, 'Family → Invite'), ', then come back and sign in.');

    root().replaceChildren(h('main', { class: `auth${kid ? ' kid-login' : ''}` }, h('div', { class: 'card' },
      modeSwitch,
      kid ? buddyFace('logo kid-logo') : sproutSvg('logo'),
      h('h1', null, kid ? 'Hi there! 👋' : 'Kaizen Folio'),
      h('p', { class: 'tag' }, tag),
      invitedOnly ? invitedNote : form,
      swap)));
    form.querySelector('input')?.focus();
  };
  draw();
}

/* ---------- confetti: a short burst of celebration (skipped when the device asks for less motion) ---------- */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const colours = ['#e8a33d', '#4f7f3a', '#f6a8c2', '#7cc4e8', '#c4b0f2', '#ffd37a', '#9fe0b4'];
  const bits = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
    c: colours[Math.floor(Math.random() * colours.length)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const age = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of bits) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 2600);
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (age < 2600) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- theme: Light, or Midnight (dark, glowing). Saved per device. ---------- */
function themeButton() {
  const root = document.documentElement;
  const current = () => root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'light');
  const btn = h('button', { class: 'btn small ghost theme-btn', type: 'button' });
  const paint = () => {
    const dark = current() === 'midnight';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', dark ? 'Switch to the light theme' : 'Switch to the Midnight theme');
    btn.title = dark ? 'Light theme' : 'Midnight theme';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#090a0f' : '#4f7f3a');
  };
  btn.addEventListener('click', () => {
    const next = current() === 'midnight' ? 'light' : 'midnight';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('kf_theme', next); } catch { /* ignore */ }
    paint();
  });
  paint();
  return btn;
}

/* ---------- shell ---------- */
function renderShell() {
  document.title = 'Kaizen Folio';
  document.querySelector('.buddy')?.remove();
  document.querySelector('.surfer')?.remove();
  const kids = state.children;
  const tabs = isKid() ? [] : [['portfolio', '🌱', 'Portfolio'], ...(isParent() ? [['dashboard', '📊', 'Dashboard'], ['goals', '🎯', 'Goals']] : []), ['settings', '⚙️', isParent() ? 'Family' : 'Account']];
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
    h('header', { class: 'topbar' }, h('div', { class: 'brand' }, isKid() ? h('span', { class: 'brand-ic' }, buddyAvatar()) : sproutSvg(), 'Kaizen Folio'), h('div', { class: 'spacer' }), switcher, themeButton(), bye),
    tabs.length ? nav : null, main));
  if (isKid() && child()) mountBuddy(child());
  if (state.view === 'book' && isKid()) state.view = 'portfolio';
  const views = { portfolio: viewPortfolio, dashboard: viewDashboard, goals: viewGoals, settings: viewSettings, book: viewBook };
  views[state.view](main).catch((ex) => main.replaceChildren(h('div', { class: 'empty' }, ex.message)));
}
const refresh = () => renderShell();
function setFilter(group, cat) { state.group = group; state.filter = cat; refresh(); }

/* ---------- portfolio ---------- */
async function viewPortfolio(main) {
  const c = child();
  if (!c) return main.replaceChildren(h('div', { class: 'empty' }, 'No child yet.'));
  const entries = await api('GET', `/api/children/${c.id}/entries`);
  const counts = {};
  entries.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
  if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';
  const inGroup = state.group === 'all' ? entries : entries.filter((e) => groupOf(e.category) === state.group);
  const shown = state.filter === 'all' ? inGroup : inGroup.filter((e) => e.category === state.filter);

  const pdfBtn = !isKid() && entries.length > 0 && h('button', { class: 'btn big-cta', title: 'Make a PDF portfolio', onclick: () => { state.view = 'book'; renderShell(); } }, '📄 PDF portfolio ', h('span', { class: 'arrow' }, '→'));
  const mainCta = isParent()
    ? h('button', { class: 'btn primary big-cta', onclick: () => entryForm(c) }, '＋ Add moment')
    : isKid() && entries.length > 0 && h('button', { class: 'btn primary big-cta', onclick: () => document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' }) }, '✨ See my moments ', h('span', { class: 'arrow' }, '↓'));
  const hero = h('section', { class: 'hero' },
    sproutSvg('sprout'),
    h('span', { class: 'eyebrow' }, isKid() ? 'My journey' : 'Portfolio · small steps, every day'),
    h('h1', null, isKid() ? `Hi ${c.nickname || c.name}! 🌟` : c.name),
    h('p', { class: 'muted' }, isKid() ? 'This is your journey — everything you’ve done and loved.' : [ageText(c.dob), c.bio].filter(Boolean).join(' · ') || 'Every class, contest and small step — kept safe.'),
    h('div', { class: 'stats' },
      h('span', { class: 'stat' }, h('b', null, entries.length), 'moments'),
      h('span', { class: 'stat' }, h('b', null, entries.reduce((n, e) => n + e.media.length, 0)), 'photos & files'),
      h('span', { class: 'stat' }, h('b', null, Object.keys(counts).length), 'areas')),
    (mainCta || pdfBtn) ? h('div', { class: 'hero-cta' }, mainCta || null, pdfBtn || null) : null);

  // Tabs (Study · Sports · Arts & stage · Awards) and, inside a tab, one chip per area.
  const groupCount = (g) => entries.filter((e) => groupOf(e.category) === g).length;
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' },
    [['all', '🌈', 'All', 'All', entries.length], ...GROUPS.map(([g, e, title, l]) => [g, e, title, l, groupCount(g)])].map(([g, e, title, l, n]) =>
      h('button', { class: 'tab', role: 'tab', title, 'aria-label': `${title}, ${n} moments`, 'aria-selected': String(state.group === g), onclick: () => setFilter(g, 'all') },
        h('span', { class: 'tab-ic' }, e), h('span', { class: 'tab-l' }, l), h('span', { class: 'tab-n' }, n))));
  const areaKeys = Object.keys(CATS).filter((k) => counts[k] && (state.group === 'all' || groupOf(k) === state.group));
  const chips = areaKeys.length > 1 && h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by area' },
    [['all', state.group === 'all' ? 'Every area' : 'All of these']].concat(areaKeys.map((k) => [k, `${CATS[k][0]} ${CATS[k][1]} · ${counts[k]}`]))
      .map(([k, label]) => h('button', { class: 'chip', 'aria-pressed': String(state.filter === k), onclick: () => setFilter(state.group, k) }, label)));

  const head = h('div', { class: 'section-head', id: 'journey' }, h('h2', null, 'Journey'),
    h('span', { class: 'count-pill' }, `${shown.length} moment${shown.length === 1 ? '' : 's'}`));

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
  main.replaceChildren(hero, tabs, chips || '', head, timeline);
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
        (e.level || e.result || e.subject || e.score || e.role || e.authorship) && h('div', { class: 'wins' },
          e.authorship && h('span', { class: `win made ${e.authorship}` }, authorLabel(e.authorship)),
          e.role && h('span', { class: 'win role' }, `👑 ${e.role}`),
          e.subject && h('span', { class: 'win subject' }, subjectLabel(e.subject)),
          e.score && h('span', { class: 'win score' }, `📝 ${scoreText(e)}`),
          e.result && h('span', { class: 'win result' }, `🏅 ${e.result}`),
          e.level && h('span', { class: 'win level' }, levelLabel(e.level)))),
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
    values: entry || { date: todayIso(), category: state.filter !== 'all' ? state.filter : (Object.entries(CATS).find(([, v]) => v[2] === state.group) || ['art'])[0] },
    fields: [
      { name: 'title', label: 'What happened?', required: true, max: 160, list: 'olympiad-names', hint: 'For an olympiad, start typing — e.g. SASMO, SEAMO, ICAS, Math Kangaroo' },
      { name: 'category', label: 'Area', type: 'select', options: catOptions() },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'subject', label: 'Subject — for olympiads and tests', type: 'select', options: [['', '— none —'], ...SUBJECTS] },
      { name: 'score', label: 'Score', max: 40, hint: 'Marks out of total, e.g. 52 / 60 — the percentage is worked out for you' },
      { name: 'level', label: 'Level of the event', type: 'select', options: [['', '— not a competition —'], ...LEVELS] },
      { name: 'result', label: 'Result — medal, rank, belt, badge', max: 120, hint: 'e.g. Gold medal · Zonal rank 9 · Honourable mention · Yellow belt' },
      { name: 'role', label: 'Role — if she led or organised it', max: 60, list: 'role-names', hint: 'e.g. Team captain, Class monitor, Club leader, MUN delegate — leave blank if she just took part' },
      { name: 'authorship', label: 'Who made this?', type: 'select', options: [['', '— not stated —'], ...AUTHORSHIP.map(([k, e, l]) => [k, `${e} ${l}`])], hint: 'Honest records matter later: say if it was their own work, made with help, or AI-assisted.' },
      { name: 'notes', label: 'Notes — scores, feedback, how it felt', type: 'textarea', max: 5000 },
      { name: 'files', label: editing ? 'Add more photos, recordings or PDFs' : 'Photos, recordings, videos or PDFs', type: 'files', hint: 'Up to 8 files, 80 MB each.' },
    ],
    extra: [h('datalist', { id: 'olympiad-names' }, OLYMPIADS.map((o) => h('option', { value: o }))),
      h('datalist', { id: 'role-names' }, ROLES.map((r) => h('option', { value: r }))), existing],
    onSubmit: async ({ values, files }) => {
      let saved;
      if (editing) {
        saved = await api('PUT', `/api/entries/${entry.id}`, { title: values.title, category: values.category, date: values.date, notes: values.notes, level: values.level, result: values.result, subject: values.subject, score: values.score, role: values.role, authorship: values.authorship });
        if (files.length) { const fd = new FormData(); files.forEach((f) => fd.append('files', f)); await api('POST', `/api/entries/${entry.id}/media`, fd); }
      } else {
        const fd = new FormData();
        ['title', 'category', 'date', 'notes', 'level', 'result', 'subject', 'score', 'role', 'authorship'].forEach((k) => fd.set(k, values[k]));
        files.forEach((f) => fd.append('files', f));
        saved = await api('POST', `/api/children/${c.id}/entries`, fd);
      }
      refresh();
      if (!editing && saved && (saved.result || saved.level || saved.role || saved.category === 'accolade')) setTimeout(confetti, 250);
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/entries/${entry.id}`); closeModal(); refresh(); } : null,
  });
}

/* ---------- PDF portfolio ----------
   A print-ready A4 book built from the same data. "Save as PDF" uses the browser's own print engine,
   which shapes Hindi, Chinese and emoji correctly — something server-side PDF libraries can't do well. */
const LEVEL_RANK = { international: 4, national: 3, zonal: 2, school: 1 };
const pct = (e) => {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(e.score || '');
  return m && Number(m[2]) > 0 ? Math.round((Number(m[1]) / Number(m[2])) * 100) : null;
};

async function viewBook(main) {
  const c = child();
  const parent = isParent();
  const [entries, ladder, activities, goals] = await Promise.all([
    api('GET', `/api/children/${c.id}/entries`),
    parent ? api('GET', `/api/children/${c.id}/ladder`) : [],
    parent ? api('GET', `/api/children/${c.id}/activities`) : [],
    parent ? api('GET', `/api/children/${c.id}/goals`) : [],
  ]);
  document.title = `${c.name} — Kaizen Folio`;
  const opts = state.book || (state.book = { group: 'all', from: '', to: '', photos: true, notes: true, ladders: true, goals: true });
  const book = h('div', { class: 'book' });

  const draw = () => {
    const picked = entries.filter((e) => (opts.group === 'all' || groupOf(e.category) === opts.group)
      && (!opts.from || e.date >= opts.from) && (!opts.to || e.date <= opts.to));
    book.replaceChildren(...bookPages(c, picked, parent && opts.ladders ? ladder : [], parent ? activities.filter((a) => a.active) : [], opts, parent && opts.goals ? goals : []));
  };

  const set = (k) => (ev) => { opts[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; draw(); };
  const save = h('button', { class: 'btn primary', onclick: async () => {
    save.disabled = true; save.textContent = 'Preparing photos…';
    // Wait for every photo so none print as blank boxes.
    await Promise.all([...book.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
    save.disabled = false; save.textContent = '⬇️ Save as PDF';
    window.print();
  } }, '⬇️ Save as PDF');
  const toolbar = h('div', { class: 'card book-tools no-print' },
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { state.view = 'portfolio'; renderShell(); } }, '← Back'),
      h('div', { class: 'spacer' }), save),
    h('div', { class: 'book-opts' },
      h('label', { class: 'field' }, 'Include', h('select', { onchange: set('group') },
        [['all', 'Everything'], ...GROUPS.map(([g, e, l]) => [g, `${e} ${l} only`])].map(([v, l]) => h('option', { value: v, selected: opts.group === v }, l)))),
      h('label', { class: 'field' }, 'From', h('input', { type: 'date', value: opts.from, onchange: set('from') })),
      h('label', { class: 'field' }, 'To', h('input', { type: 'date', value: opts.to, onchange: set('to') })),
      h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: opts.photos, onchange: set('photos') }), 'Photos'),
      h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: opts.notes, onchange: set('notes') }), 'Notes'),
      parent && h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: opts.ladders, onchange: set('ladders') }), 'Levels & activities'),
      parent && h('label', { class: 'field check' }, h('input', { type: 'checkbox', checked: opts.goals !== false, onchange: set('goals') }), 'Goals')),
    h('p', { class: 'small muted' }, 'Tip: in the print window choose “Save as PDF”. On iPhone, tap Share → Print, then pinch out on the preview to get the PDF.'));
  draw();
  main.replaceChildren(toolbar, book);
}

function bookPages(c, entries, ladder, activities, opts, goals = []) {
  const name = c.nickname || c.name;
  const dates = entries.map((e) => e.date).sort();
  const range = dates.length ? `${fmtDate(opts.from || dates[0])} – ${fmtDate(opts.to || dates[dates.length - 1])}` : 'No moments in this range';
  const wins = entries.filter((e) => e.result || e.level);
  const roles = entries.filter((e) => e.role).sort((a, b) => b.date.localeCompare(a.date));
  const olympiads = entries.filter((e) => e.category === 'olympiad');
  const passed = ladder.filter((l) => l.status === 'passed');
  const areas = new Set(entries.map((e) => e.category));
  const stat = (n, l) => h('div', { class: 'b-stat' }, h('b', null, n), h('span', null, l));
  const table = (head, rows) => h('table', { class: 'b-table' }, h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((x) => h('td', null, x ?? ''))))));
  const pages = [];

  // Cover
  pages.push(h('section', { class: 'b-cover' },
    sproutSvg('b-logo'),
    h('div', { class: 'b-kicker' }, 'Growth portfolio & extra-curricular record'),
    h('h1', null, c.name),
    h('p', { class: 'b-sub' }, [ageText(c.dob) && `Age ${ageText(c.dob)}`, c.bio].filter(Boolean).join(' · ')),
    h('p', { class: 'b-range' }, range),
    h('div', { class: 'b-stats' }, stat(entries.length, 'moments'), stat(areas.size, 'areas'), stat(wins.length, 'results & awards'),
      stat(olympiads.length, 'olympiads'), ladder.length ? stat(passed.length, 'levels passed') : null),
    h('div', { class: 'b-areas' }, GROUPS.map(([g, e, l]) => {
      const ks = Object.keys(CATS).filter((k) => CATS[k][2] === g && areas.has(k));
      return ks.length ? h('div', null, h('strong', null, `${e} ${l}: `), ks.map((k) => CATS[k][1]).join(', ')) : null;
    }))));

  // Highlights: the biggest stage first
  if (wins.length) {
    const top = [...wins].sort((a, b) => (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0) || b.date.localeCompare(a.date)).slice(0, 15);
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '🏆 Highlights'),
      table(['Date', 'Area', 'What', 'Level', 'Result'], top.map((e) => [fmtDate(e.date), `${CATS[e.category]?.[0] || ''} ${CATS[e.category]?.[1] || ''}`, e.title, e.level ? levelLabel(e.level) : '', e.result]))));
  }

  // Leadership & responsibility: every moment where she led, organised or represented others —
  // the single thing both US (Common App) and UK (UCAS) admissions, and schools here, weigh most.
  if (roles.length) {
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '👑 Leadership & responsibility'),
      table(['Date', 'Area', 'Role', 'What'], roles.map((e) => [fmtDate(e.date), `${CATS[e.category]?.[0] || ''} ${CATS[e.category]?.[1] || ''}`, e.role, e.title]))));
  }

  // Olympiad record, by subject, with best and average percentage
  if (olympiads.length) {
    const bySubject = new Map();
    olympiads.forEach((e) => { const k = e.subject || 'other'; if (!bySubject.has(k)) bySubject.set(k, []); bySubject.get(k).push(e); });
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '🧮 Olympiad record'),
      h('div', { class: 'b-cards' }, [...bySubject].map(([k, rows]) => {
        const p = rows.map(pct).filter((x) => x != null);
        return h('div', { class: 'b-card' }, h('strong', null, subjectLabel(k)),
          h('span', null, `${rows.length} olympiad${rows.length > 1 ? 's' : ''}`),
          p.length ? h('span', null, `Best ${Math.max(...p)}% · Average ${Math.round(p.reduce((a, b) => a + b, 0) / p.length)}%`) : null);
      })),
      table(['Date', 'Olympiad', 'Subject', 'Score', 'Level', 'Result'],
        [...olympiads].sort((a, b) => b.date.localeCompare(a.date)).map((e) => [fmtDate(e.date), e.title, e.subject ? subjectLabel(e.subject) : '', scoreText(e), e.level ? levelLabel(e.level) : '', e.result]))));
  }

  // Levels, belts and grades
  if (ladder.length) {
    const tracks = new Map();
    ladder.forEach((l) => { if (!tracks.has(l.track)) tracks.set(l.track, []); tracks.get(l.track).push(l); });
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '🪜 Levels, belts & grades'),
      h('div', { class: 'b-cards' }, [...tracks].map(([t, steps]) => h('div', { class: 'b-card' }, h('strong', null, t),
        h('div', { class: 'b-steps' }, steps.map((s) => h('span', { class: `b-step ${s.status}` },
          `${s.status === 'passed' ? '✓ ' : s.status === 'preparing' ? '… ' : ''}${s.level}${s.score ? ` (${s.score})` : ''}`))))))));
  }
  if (activities.length) {
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '📅 Current classes & activities'),
      table(['Activity', 'Area', 'When', 'Teacher / place'], activities.map((a) => [a.name, CATS[a.category]?.[1] || '', a.schedule, a.provider]))));
  }

  // Pathway goals, stage by stage
  if (goals.length) {
    pages.push(h('section', { class: 'b-sec' }, h('h2', null, '🎯 Pathway goals'),
      PATHWAY.filter((s) => goals.some((g) => g.stage === s.key)).map((s) => h('div', { class: 'b-card b-goals' },
        h('strong', null, `${s.emoji} ${s.title}`),
        goals.filter((g) => g.stage === s.key).map((g) => h('div', null,
          `${(GOAL_STATUS.find((x) => x[0] === g.status) || [, ''])[1]} — ${g.title}${g.target ? ` · ${g.target}` : ''}`))))));
  }

  // The journey, tab by tab, area by area
  for (const [g, ge, gl] of GROUPS) {
    const ks = Object.keys(CATS).filter((k) => CATS[k][2] === g && areas.has(k));
    if (!ks.length) continue;
    pages.push(h('section', { class: 'b-sec b-group' }, h('h2', null, `${ge} ${gl}`),
      ks.map((k) => h('div', { class: 'b-area', 'data-cat': k }, h('h3', null, `${CATS[k][0]} ${CATS[k][1]}`),
        entries.filter((e) => e.category === k).map((e) => {
          const imgs = opts.photos ? e.media.filter((m) => m.mime.startsWith('image/')).slice(0, 3) : [];
          const extras = e.media.filter((m) => !m.mime.startsWith('image/')).length;
          return h('article', { class: 'b-entry' },
            h('div', { class: 'b-when' }, fmtDate(e.date)),
            h('div', { class: 'b-body' },
              h('h4', null, e.title),
              (e.result || e.level || e.score || e.subject || e.role || e.authorship) && h('div', { class: 'b-badges' },
                [e.authorship && authorLabel(e.authorship), e.role && `👑 ${e.role}`, e.subject && subjectLabel(e.subject), e.score && `📝 ${scoreText(e)}`, e.result && `🏅 ${e.result}`, e.level && levelLabel(e.level)].filter(Boolean).map((t) => h('span', null, t))),
              opts.notes && e.notes && h('p', null, e.notes),
              imgs.length > 0 && h('div', { class: 'b-photos' }, imgs.map((m) => h('img', { src: `/media/${m.id}`, alt: m.original || '' }))),
              extras > 0 && h('div', { class: 'b-more' }, `+ ${extras} recording${extras > 1 ? 's' : ''} or document${extras > 1 ? 's' : ''} kept in Kaizen Folio`)));
        })))));
  }
  pages.push(h('footer', { class: 'b-foot' }, `${name}’s portfolio · made with Kaizen Folio on ${fmtDate(todayIso())} · a private family record`));
  return pages;
}

/* ---------- Goals: the pathway PSLE → secondary → JC/poly → university ----------
   Each stage shows what it asks for (from the catalog), the evidence already in her portfolio,
   and the goals we set — so "how do we get there" is answered by her own record. */
const psleYearOf = (c) => c.psle_year || (c.dob ? Number(c.dob.slice(0, 4)) + 12 : null);
function stageNow(c) {
  const p = psleYearOf(c), y = new Date().getFullYear();
  if (!p || y <= p) return 'psle';
  return y <= p + 4 ? 'secondary' : 'university';
}
const LEVEL_NAME = ['', 'School', 'Zonal', 'National', 'International'];
const LANG_SUBJECTS = ['english', 'chinese', 'hindi'];
const bestLevel = (rows) => rows.reduce((b, e) => Math.max(b, LEVEL_RANK[e.level] || 0), 0);
const yearsOf = (rows) => {
  if (rows.length < 2) return 0;
  const d = rows.map((r) => r.date).sort();
  return (parseDay(d[d.length - 1]) - parseDay(d[0])) / (365.25 * 864e5);
};
const yrs = (n) => (n >= 1 ? `${n.toFixed(1)} yrs` : n > 0 ? `${Math.max(1, Math.round(n * 12))} months` : 'just started');
function inDsaArea(e, cats) {
  if (cats === 'role') return !!e.role;
  if (e.category === 'olympiad') return cats.includes('olympiad') ? !LANG_SUBJECTS.includes(e.subject) : cats.includes('chinese') && LANG_SUBJECTS.includes(e.subject);
  return cats.includes(e.category);
}

// One evidence row: label, what she has, and a nudge when it's empty.
const evRow = (icon, label, value, detail, gap, pctWidth) => h('div', { class: `ev-row${value ? '' : ' gap'}` },
  h('span', { class: 'ev-ic' }, icon),
  h('div', { class: 'main' },
    h('div', { class: 'ev-top' }, h('strong', null, label), h('span', { class: 'ev-n' }, value ? String(value) : '—')),
    pctWidth != null && h('div', { class: 'meter' }, h('span', { 'data-w': pctWidth })),
    h('div', { class: 'small muted' }, value ? detail : gap)));

function evidenceFor(stage, entries, activities) {
  const roles = entries.filter((e) => e.role);
  const community = entries.filter((e) => e.category === 'community');
  const repped = entries.filter((e) => e.level);
  const byCat = new Map();
  entries.forEach((e) => { if (!byCat.has(e.category)) byCat.set(e.category, []); byCat.get(e.category).push(e); });
  const latest = (rows) => rows.slice().sort((a, b) => b.date.localeCompare(a.date))[0];

  if (stage === 'psle') {
    // Where would a DSA-Sec application be strongest? Count, highest level and years of commitment per talent area.
    const areas = DSA_AREAS.map(([label, icon, cats]) => {
      const rows = entries.filter((e) => inDsaArea(e, cats));
      const best = bestLevel(rows);
      return { label, icon, rows, best, strength: rows.length + best * 3 };
    }).sort((a, b) => b.strength - a.strength);
    const max = Math.max(1, ...areas.map((a) => a.strength));
    return [
      h('p', { class: 'small muted' }, 'DSA-Sec talent areas, strongest first — built from her moments.'),
      ...areas.map((a, i) => {
        const row = evRow(a.icon, a.label, a.rows.length,
          [`${a.rows.length} moment${a.rows.length > 1 ? 's' : ''}`, a.best && `best: ${LEVEL_NAME[a.best]} level`, yrs(yearsOf(a.rows))].filter(Boolean).join(' · '),
          'Nothing yet — fine if this isn’t her area.', Math.round((a.strength / max) * 100));
        if (i === 0 && a.rows.length) row.classList.add('top');
        return row;
      }),
    ];
  }
  if (stage === 'secondary') {
    const longest = [...byCat].map(([k, rows]) => [k, yearsOf(rows)]).sort((a, b) => b[1] - a[1])[0];
    const r = latest(roles);
    return [
      h('p', { class: 'small muted' }, 'LEAPS — what secondary schools count for co-curricular bonus points.'),
      evRow('👑', 'Leadership', roles.length, r ? `latest: ${r.role} — ${r.title}` : '', 'No roles yet. Class monitor, team presenter or a VIA project lead all count — add a role to the moment.'),
      evRow('🏆', 'Achievement', repped.length, `represented at school level or above · best: ${LEVEL_NAME[bestLevel(repped)] || '—'}`, 'No representation yet. Set the “Level” on contests she takes part in.'),
      evRow('📅', 'Participation', activities.filter((a) => a.active).length,
        longest && longest[1] ? `active classes · longest commitment: ${CATS[longest[0]]?.[1] || longest[0]}, ${yrs(longest[1])}` : 'active classes',
        'No regular activities yet — add them on the Dashboard.'),
      evRow('🤝', 'Service', community.length, `community moments · latest: ${latest(community)?.title || ''}`, 'No community service yet. Values in Action (VIA) projects count — use the Community area.'),
    ];
  }
  // university
  const deep = [...byCat].filter(([, rows]) => rows.length >= 2).map(([k, rows]) => [k, yearsOf(rows), rows.length])
    .sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 3);
  const top = entries.filter((e) => ['national', 'international'].includes(e.level));
  const subjects = new Set(entries.filter((e) => e.subject && ['olympiad', 'exam'].includes(e.category)).map((e) => e.subject));
  return [
    h('p', { class: 'small muted' }, 'What aptitude-based admission here, and US and UK universities, look for.'),
    evRow('🌳', 'Depth — her 3 longest-running areas', deep.length, deep.map(([k, y]) => `${CATS[k]?.[1] || k} (${yrs(y)})`).join(' · '), 'Not enough moments yet to show depth.'),
    evRow('👑', 'Leadership', roles.length, `${roles.length} role${roles.length > 1 ? 's' : ''} recorded`, 'No roles yet.'),
    evRow('🤝', 'Community service', community.length, `${community.length} moment${community.length > 1 ? 's' : ''}`, 'None yet.'),
    evRow('🌍', 'Exceptional talent', top.length, `${top.length} national or international result${top.length > 1 ? 's' : ''}`, 'No national or international results yet.'),
    evRow('📚', 'Subject depth (UK)', subjects.size, `olympiads or exams in ${[...subjects].map(subjectLabel).join(', ')}`, 'No olympiads or exams with a subject yet.'),
  ];
}

async function viewGoals(main) {
  const c = child();
  if (!c) return main.replaceChildren(h('div', { class: 'empty' }, 'Add a child first, from the Family tab.'));
  const [entries, activities, goals] = await Promise.all([
    api('GET', `/api/children/${c.id}/entries`),
    api('GET', `/api/children/${c.id}/activities`),
    api('GET', `/api/children/${c.id}/goals`),
  ]);
  const psle = psleYearOf(c);
  const now = stageNow(c);
  const name = c.nickname || c.name;

  const steps = h('div', { class: 'path-steps', role: 'list' }, PATHWAY.map((s, i) => h('a', {
    class: `path-step${s.key === now ? ' now' : ''}`, role: 'listitem', href: `#stage-${s.key}`,
    onclick: (ev) => { ev.preventDefault(); const d = document.getElementById(`stage-${s.key}`); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  },
  h('span', { class: 'ps-ic' }, s.emoji),
  h('span', { class: 'ps-t' }, s.exam),
  h('span', { class: 'ps-y' }, psle ? `≈ ${psle + s.offset}` : '—'),
  i < PATHWAY.length - 1 ? h('span', { class: 'ps-arrow', 'aria-hidden': 'true' }, '→') : null)));

  const goalCard = (g) => {
    const rows = g.category ? entries.filter((e) => e.category === g.category).sort((a, b) => b.date.localeCompare(a.date)) : [];
    const [emo, lab] = g.category ? (CATS[g.category] || CATS.other) : ['🎯', ''];
    return h('div', { class: `card goal ${g.status}`, 'data-cat': g.category || 'other' },
      h('div', { class: 'goal-head' },
        h('span', { class: `chip status ${g.status}` }, (GOAL_STATUS.find((s) => s[0] === g.status) || [, g.status])[1]),
        h('div', { class: 'spacer' }),
        g.status !== 'achieved' && h('button', { class: 'btn small', onclick: async () => {
          try { await api('PUT', `/api/goals/${g.id}`, { status: 'achieved' }); toast('Goal achieved — well done! 🎉'); refresh(); } catch (ex) { toast(ex.message); }
        } }, '✓ Achieved'),
        h('button', { class: 'btn small ghost', 'aria-label': `Edit ${g.title}`, onclick: () => goalForm(c, g.stage, g) }, 'Edit')),
      h('h3', null, g.title),
      g.target && h('p', { class: 'goal-target' }, `🎯 ${g.target}`),
      h('div', { class: 'small muted' }, [g.due && `by ${fmtDate(g.due)}`, g.category && `${emo} ${lab}`].filter(Boolean).join(' · ')),
      g.category && h('div', { class: 'goal-ev' }, rows.length
        ? `${rows.length} ${lab} moment${rows.length > 1 ? 's' : ''} so far · latest: ${rows[0].title}${rows[0].result ? ` — ${rows[0].result}` : ''}`
        : `No ${lab} moments yet — they’ll show here as you add them.`),
      g.notes && h('p', { class: 'small' }, g.notes));
  };

  const stageCard = (s) => {
    const mine = goals.filter((g) => g.stage === s.key);
    const done = mine.filter((g) => g.status === 'achieved').length;
    if (!state.openStages) state.openStages = new Set([now]);
    const det = h('details', { class: 'card stage', id: `stage-${s.key}`, open: state.openStages.has(s.key),
      ontoggle: (ev) => { state.openStages[ev.target.open ? 'add' : 'delete'](s.key); } },
      h('summary', null,
        h('span', { class: 'st-ic' }, s.emoji),
        h('div', { class: 'main' }, h('h2', null, s.title),
          h('div', { class: 'small muted' }, [`${s.exam}${psle ? ` ≈ ${psle + s.offset}` : ''}`, s.key === now && 'where she is now', mine.length && `${done}/${mine.length} goals achieved`].filter(Boolean).join(' · ')))),
      h('div', { class: 'stage-body' },
        h('h3', null, 'What it asks for'),
        h('ul', { class: 'asks' }, s.asks.map((a) => h('li', null, a))),
        h('h3', null, `${name}’s evidence so far`),
        h('div', { class: 'evidence' }, evidenceFor(s.key, entries, activities)),
        h('div', { class: 'section-head' }, h('h3', null, 'Our goals'), h('button', { class: 'btn small primary', onclick: () => goalForm(c, s.key) }, '＋ Goal')),
        mine.length ? h('div', { class: 'list' }, mine.map(goalCard)) : h('div', { class: 'empty small' }, 'No goals for this stage yet. Tap ＋ Goal — there are ideas to start from.'),
        h('p', { class: 'sources small muted' }, 'Rules as published in 2026 — they change, so check each year. Sources: ',
          s.sources.map(([t, u], i) => [i ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, t)]))));
    return det;
  };

  main.replaceChildren(
    h('section', { class: 'hero goals-hero' },
      h('h1', null, `${name}’s pathway`),
      h('p', { class: 'muted' }, psle
        ? `PSLE ≈ ${psle}${c.psle_year ? '' : ' (estimated from the birthday — set the exact year in Family → Edit profile)'}. Each stage shows what it asks for, what her record already has, and the goals you set.`
        : 'Add her date of birth or PSLE year in Family → Edit profile to see the timeline.'),
      steps),
    ...PATHWAY.map(stageCard),
    uniSection(c, now, psle));
  // meter widths are set here, not inline, so the strict CSP (no inline styles) stays intact
  main.querySelectorAll('.meter span[data-w]').forEach((el) => { el.style.width = `${el.dataset.w}%`; });
}

/* ---------- Universities: where, and how they admit ----------
   Parked while she's in primary school: at 7–12 the best preparation for any university is breadth and
   enjoyment, and a target university tends to narrow what a child is allowed to love. Parents can still look.
   Her own kid login never shows any of this. */
const UNI_K = 1000 / 360; // matches scripts/build-worldmap.mjs: x = (lon + 180)·k, y = (90 − lat)·k
function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  kids.forEach((kid) => kid != null && el.append(kid.nodeType ? kid : document.createTextNode(String(kid))));
  return el;
}
function uniMap(region, onPick) {
  const [, , label, [w, s, e, n]] = UNI_REGIONS.find((r) => r[0] === region);
  // Equirectangular stretches maps away from the equator; squeeze x by cos(latitude) for regional views.
  const kx = region === 'all' ? 1 : Math.cos(((s + n) / 2) * Math.PI / 180);
  const X = (lon) => (lon + 180) * UNI_K * kx, Y = (lat) => (90 - lat) * UNI_K;
  const x0 = X(w), y0 = Y(n), vw = X(e) - x0, vh = Y(s) - y0;
  const unis = UNIS.filter((u) => u.region === region);
  const svg = svgEl('svg', { class: 'uni-map', viewBox: `${x0} ${y0} ${vw} ${vh}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': `Map of universities — ${label}` },
    svgEl('rect', { class: 'sea', x: x0 - vw, y: y0 - vh, width: vw * 3, height: vh * 3 }),
    // Singapore uses its own detailed outline; the world outline is too coarse to show the island.
    svgEl('path', { class: 'land', d: (region === 'sg' && window.ANKUR_WORLD_SG) || window.ANKUR_WORLD || '', transform: `scale(${kx} 1)`, 'vector-effect': 'non-scaling-stroke' }));
  // The map box is 16:9 and the view is fitted inside it, so size pins against the width actually shown.
  const shownW = Math.max(vw, vh * 16 / 9);
  const r = shownW / 150, font = shownW / 42, near = shownW / 22;
  // World view: one pin per region (tap to zoom in). Regional views: one pin per university, merging any that would overlap.
  const groups = [];
  if (region === 'all') {
    for (const [k] of UNI_REGIONS.slice(1)) {
      const items = UNIS.filter((u) => u.region === k);
      if (items.length) groups.push({ x: items.reduce((a, u) => a + X(u.lon), 0) / items.length, y: items.reduce((a, u) => a + Y(u.lat), 0) / items.length, items, zoom: k });
    }
  } else {
    for (const u of unis) {
      const x = X(u.lon), y = Y(u.lat);
      const g = groups.find((k) => Math.hypot(k.x - x, k.y - y) < near);
      if (g) { g.items.push(u); g.x = (g.x * (g.items.length - 1) + x) / g.items.length; g.y = (g.y * (g.items.length - 1) + y) / g.items.length; }
      else groups.push({ x, y, items: [u] });
    }
  }
  const placed = []; // label boxes already drawn, so labels never sit on top of each other
  for (const g of groups) {
    const one = g.items.length === 1 && !g.zoom;
    const text = g.zoom ? `${UNI_REGIONS.find((rr) => rr[0] === g.zoom)[2]} · ${g.items.length}` : one ? g.items[0].short : g.items.map((u) => u.short).join(' · ');
    const flip = g.x > x0 + shownW * 0.72 - (shownW - vw) / 2; // near the right edge: put the label on the left
    const tw = text.length * font * 0.56;
    let ty = g.y + font * 0.35;
    const box = () => { const lx = flip ? g.x - r * 2 - tw : g.x + r * 2; return [lx, ty - font, lx + tw, ty + font * 0.25]; };
    const hits = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
    for (let i = 0; i < 6 && hits(box()); i++) ty += font * 1.25;
    placed.push(box());
    const dot = svgEl('g', { class: `pin${one ? '' : ' many'}`, tabindex: 0, role: 'button', 'aria-label': g.zoom ? `Zoom to ${text}` : text },
      ty - font * 0.35 !== g.y ? svgEl('line', { class: 'leader', x1: g.x, y1: g.y, x2: g.x + (flip ? -1 : 1) * r * 1.6, y2: ty - font * 0.35, 'stroke-width': r * 0.3 }) : null,
      svgEl('circle', { cx: g.x, cy: g.y, r: one ? r : r * 1.5, 'stroke-width': r * 0.35 }),
      svgEl('text', { x: g.x + (flip ? -1 : 1) * r * 2, y: ty, 'font-size': font, 'text-anchor': flip ? 'end' : 'start', 'stroke-width': font * 0.16 }, text));
    const go = () => onPick(g.items, g.zoom || null);
    dot.addEventListener('click', go);
    dot.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
    svg.append(dot);
  }
  return svg;
}

function uniSection(c, now, psle) {
  const sec = h('section', { class: 'card unis', id: 'universities' });
  const parked = now === 'psle' && !state.unisOpen;
  const age = c.dob ? Math.floor((Date.now() - parseDay(c.dob)) / (365.25 * 864e5)) : null;
  const draw = () => {
    if (parked && !state.unisOpen) {
      sec.replaceChildren(
        h('div', { class: 'unis-head' }, h('span', { class: 'st-ic' }, '🌍'), h('div', null, h('h2', null, 'Universities'),
          h('div', { class: 'small muted' }, `Parked until secondary school${psle ? ` (≈ ${psle + 1})` : ''}`))),
        h('p', null, 'At this age the best preparation for any university is breadth and enjoyment. A target university this early tends to narrow what a child is allowed to love — so we keep this out of sight until she leaves primary school.'),
        h('p', { class: 'small muted' }, 'She never sees this page; it lives only in your Goals tab.'),
        h('button', { class: 'btn', onclick: () => { state.unisOpen = true; draw(); } }, 'Look anyway'));
      return;
    }
    const region = state.uniRegion || 'all';
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Region' }, UNI_REGIONS.map(([k, flag, label]) =>
      h('button', { class: 'chip', 'aria-pressed': String(region === k), onclick: () => { state.uniRegion = k; draw(); } }, `${flag} ${label}`)));
    const list = h('div', { class: 'list uni-list' });
    const shown = region === 'all' ? UNIS : UNIS.filter((u) => u.region === region);
    const card = (u) => {
      const flag = UNI_REGIONS.find((rr) => rr[0] === u.region)[1];
      return h('article', { class: 'card uni', id: `uni-${u.key}` },
        h('div', { class: 'uni-top' }, h('span', { class: 'uni-flag' }, flag), h('div', { class: 'main' }, h('h3', null, u.name), h('div', { class: 'small muted' }, u.city))),
        h('dl', null,
          h('dt', null, '📝 How they admit'), h('dd', null, u.how),
          h('dt', null, '🧪 Tests & interviews'), h('dd', null, u.tests),
          h('dt', null, '⭐ What they look for'), h('dd', null, u.weighs)),
        h('div', { class: 'row uni-acts' },
          h('a', { class: 'btn small', href: u.url, target: '_blank', rel: 'noopener noreferrer' }, 'Official admissions ↗'),
          h('a', { class: 'btn small ghost', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(u.name)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Map ↗'),
          h('button', { class: 'btn small ghost', onclick: () => goalForm(c, 'university', null, { title: `Apply to ${u.short}`, target: u.weighs, status: 'idea' }) }, '🎯 Make it a goal')));
    };
    if (region === 'all') {
      for (const [k, flag, label] of UNI_REGIONS.slice(1)) {
        list.append(h('div', { class: 'month' }, `${flag} ${label}`), ...UNIS.filter((u) => u.region === k).map(card));
      }
    } else list.append(...shown.map(card));

    const map = uniMap(region, (items, zoomTo) => {
      if (zoomTo) { state.uniRegion = zoomTo; draw(); return; }
      const el = document.getElementById(`uni-${items[0].key}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('flash'); setTimeout(() => el?.classList.remove('flash'), 1400);
    });
    const ageNow = age == null ? null : age <= 12 ? 0 : age <= 16 ? 1 : 2;
    sec.replaceChildren(
      h('div', { class: 'unis-head' }, h('span', { class: 'st-ic' }, '🌍'), h('div', null, h('h2', null, 'Universities'),
        h('div', { class: 'small muted' }, 'Major universities and how they admit — checked October 2026.'))),
      chips,
      h('div', { class: 'map-wrap' }, map, h('div', { class: 'small muted map-hint' }, region === 'all' ? 'Tap a group to zoom in, or a name to jump to it.' : 'Tap a name to jump to it.')),
      h('h3', null, 'What matters at each age'),
      h('div', { class: 'age-guide' }, AGE_GUIDE.map(([ages, stage, text], i) =>
        h('div', { class: `age-row${i === ageNow ? ' now' : ''}` }, h('div', { class: 'age-k' }, h('b', null, ages), h('span', null, stage)), h('p', null, text)))),
      list,
      h('p', { class: 'small muted' }, 'Rules change almost every year — each card links to the official page, which always wins. ',
        now === 'psle' ? h('button', { class: 'link', onclick: () => { state.unisOpen = false; draw(); } }, 'Park this again') : null));
  };
  draw();
  return sec;
}

function goalForm(c, stage, g, prefill = {}) {
  const editing = !!g;
  const ideas = h('datalist', { id: 'goal-ideas' }, (GOAL_IDEAS[stage] || []).map((t) => h('option', { value: t })));
  openForm({
    title: editing ? 'Edit goal' : `New goal — ${(PATHWAY.find((s) => s.key === stage) || {}).title || ''}`,
    submitLabel: editing ? 'Save' : 'Add goal',
    values: g || { stage, status: 'working', ...prefill },
    fields: [
      { name: 'title', label: 'Goal', required: true, max: 160, list: 'goal-ideas', hint: 'Start typing for ideas, or write your own.' },
      { name: 'target', label: 'What “done” looks like', max: 200, hint: 'e.g. A zonal robotics award by Primary 5 · AL3 or better in every subject' },
      { name: 'category', label: 'Linked area — its moments show up as progress', type: 'select', options: [['', '— none —'], ...catOptions()] },
      { name: 'due', label: 'By when', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: GOAL_STATUS },
      { name: 'stage', label: 'Stage', type: 'select', options: PATHWAY.map((s) => [s.key, `${s.emoji} ${s.title}`]) },
      { name: 'notes', label: 'How we’ll get there', type: 'textarea', max: 2000 },
    ],
    extra: ideas,
    onSubmit: async ({ values }) => {
      await api(editing ? 'PUT' : 'POST', editing ? `/api/goals/${g.id}` : `/api/children/${c.id}/goals`, values);
      refresh();
    },
    onDelete: editing ? async () => { await api('DELETE', `/api/goals/${g.id}`); closeModal(); refresh(); } : null,
  });
}

/* ---------- dashboard (parents) ---------- */
async function viewDashboard(main) {
  const c = child();
  if (!c) return main.replaceChildren(h('div', { class: 'empty' }, 'Add a child first, from the Family tab.'));
  const [sum, events, activities, ladder, olympiads, allEntries] = await Promise.all([
    api('GET', `/api/children/${c.id}/summary`),
    api('GET', `/api/children/${c.id}/events`),
    api('GET', `/api/children/${c.id}/activities`),
    api('GET', `/api/children/${c.id}/ladder`),
    api('GET', `/api/children/${c.id}/entries?category=olympiad`),
    api('GET', `/api/children/${c.id}/entries`),
  ]);
  const roles = allEntries.filter((e) => e.role).sort((a, b) => b.date.localeCompare(a.date));
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
    (() => { const p = rows.map(pct).filter((x) => x != null); return p.length ? h('div', { class: 'small muted' }, `${rows.length} olympiad${rows.length > 1 ? 's' : ''} · best ${Math.max(...p)}% · average ${Math.round(p.reduce((a, b) => a + b, 0) / p.length)}%`) : null; })(),
    h('div', { class: 'scores' }, rows.map((r) => h('div', { class: 'score-row' },
      h('div', { class: 'main' }, h('div', { class: 'title' }, r.title), h('div', { class: 'small muted' }, [fmtDate(r.date), r.result].filter(Boolean).join(' · '))),
      h('b', { class: 'pts' }, scoreText(r) || '—')))));

  const roleRow = (e) => h('div', { class: 'card item', 'data-cat': e.category },
    h('span', { class: 'badge' }, (CATS[e.category] || CATS.other)[0]),
    h('div', { class: 'main' }, h('div', { class: 'title' }, e.role), h('div', { class: 'small muted' }, [fmtDate(e.date), e.title].filter(Boolean).join(' · '))),
    h('button', { class: 'btn small ghost', 'aria-label': `Edit ${e.title}`, onclick: () => entryForm(c, e) }, 'Edit'));

  const sec = (title, addLabel, onAdd, content, extra) => [
    h('div', { class: 'section-head' }, h('h2', null, title), h('div', { class: 'row' }, extra, h('button', { class: 'btn small', onclick: onAdd }, addLabel))), content];
  const emptyBox = (t) => h('div', { class: 'empty' }, t);

  main.replaceChildren(
    tiles,
    ...sec('Coming up', '＋ Event', () => eventForm(c), upcoming.length ? h('div', { class: 'list' }, upcoming.map(eventRow)) : emptyBox('No contests or exams planned. Add the next one.')),
    ...(past.length ? [h('div', { class: 'month' }, 'Recently done'), h('div', { class: 'list' }, past.map(eventRow))] : []),
    ...sec('Activities', '＋ Activity', () => activityForm(c), activities.length ? h('div', { class: 'list' }, activities.map(actRow)) : emptyBox('Hindi tuition, art class, Toastmasters youth… add them here.')),
    ...(roles.length ? [h('div', { class: 'section-head' }, h('h2', null, '👑 Leadership & responsibility')),
      h('p', { class: 'muted small lead-in' }, 'What universities and schools weigh most — not just taking part.'),
      h('div', { class: 'list' }, roles.map(roleRow))] : []),
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
        h('button', { class: 'btn', onclick: () => { state.previewKid = true; state.buddy = null; state.view = 'portfolio'; renderShell(); } }, '👀 Preview kid view')));

    // Buddy pictures: parents add them, the child chooses one by tapping Buddy.
    const pics = await api('GET', `/api/children/${c.id}/buddies`);
    const who = c.nickname || c.name;
    parts.push(
      h('div', { class: 'section-head' }, h('h2', null, `${who}’s buddies`),
        pics.buddies.length < 12 && h('button', { class: 'btn small', onclick: () => buddyPicForm(c) }, '＋ Buddy picture')),
      h('p', { class: 'muted small' }, `Zen friends (panda, dragon and cat) are built in. Add more favourite characters or toys as pictures. ${who} taps Buddy → “Pick my friend” to choose one. Pictures stay private to your family, like every photo here.`),
      h('div', { class: 'buddy-grid' },
        h('div', { class: `card buddy-card${pics.chosen == null ? ' on' : ''}` }, buddyFace(), h('strong', null, 'Kai the sprout'), h('span', { class: 'small muted' }, pics.chosen == null ? 'chosen' : 'default')),
        ZEN.map((z) => h('div', { class: `card buddy-card${pics.chosen === z.id ? ' on' : ''}` }, zenFace(z.key), h('strong', null, z.name), h('span', { class: 'small muted' }, pics.chosen === z.id ? 'chosen' : 'built in'))),
        pics.buddies.map((b) => h('div', { class: `card buddy-card${pics.chosen === b.id ? ' on' : ''}` },
          h('img', { src: `/buddy-pic/${b.id}`, alt: '' }), h('strong', null, b.name),
          h('span', { class: 'small muted' }, pics.chosen === b.id ? 'chosen' : ''),
          h('button', { class: 'btn small ghost', onclick: async () => {
            if (!(await confirmBox(`Remove ${b.name}?`, 'Remove'))) return;
            try { await api('DELETE', `/api/buddies/${b.id}`); state.buddy = null; refresh(); } catch (ex) { toast(ex.message); }
          } }, 'Remove')))));

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
          if (!(await confirmBox(`Remove ${u.name}’s access? They are signed out everywhere.`, 'Remove'))) return;
          try { await api('DELETE', `/api/users/${u.id}`); refresh(); } catch (ex) { toast(ex.message); }
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
    Object.assign(state, { view: 'portfolio', group: 'all', filter: 'all' });
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
      { name: 'psle_year', label: 'PSLE year', type: 'number', hint: 'Leave blank and we estimate it from the birthday (Primary 6 is the year they turn 12). Set it if different.' },
    ],
    onSubmit: async ({ values }) => {
      if (editing) { const u = await api('PUT', `/api/children/${c.id}`, values); Object.assign(c, u); }
      else { const n = await api('POST', '/api/children', values); state.children.push(n); state.childId = n.id; state.view = 'portfolio'; }
      refresh();
    },
  });
}
function buddyPicForm(c) {
  openForm({
    title: 'Add a buddy picture', submitLabel: 'Add buddy', values: {},
    fields: [
      { name: 'name', label: 'Buddy’s name', required: true, max: 40, hint: 'This is what the buddy calls itself, e.g. “Hi, it’s me, Rapunzel!”' },
      { name: 'picture', label: 'Picture (JPG, PNG, GIF or WebP, up to 8 MB)', type: 'files', accept: 'image/jpeg,image/png,image/gif,image/webp', single: true },
    ],
    onSubmit: async ({ values, files }) => {
      if (!files.length) throw new Error('Choose a picture');
      const fd = new FormData(); fd.set('name', values.name); fd.set('picture', files[0]);
      await api('POST', `/api/children/${c.id}/buddies`, fd);
      state.buddy = null; toast(`${values.name} added — ${c.nickname || c.name} can pick it from Buddy`); refresh();
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


/* ---------- Buddy: Kai the sprout, for kid logins only ----------
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
const ZEN_DONE = ['Lovely. Calm body, strong mind 🌿', 'That felt peaceful. Well done!', 'Slow and steady wins. You did it 🧘', 'Ahh… ready for anything now ✨'];
const CHEERS = [
  'You are growing every single day! 🌱', 'Brave, curious and kind — that’s you!', 'Every little step counts. Look how far you’ve come!',
  'Practice makes sparkle ✨', 'I’m so proud of you! 🎉', 'You can do hard things. I believe in you! 💪',
];

// The child's chosen Buddy: one of the pictures a parent uploaded, or Kai the sprout.
const chosenBuddy = () => {
  const b = state.buddy;
  if (!b || !b.pics) return null;
  const zen = ZEN.find((z) => z.id === b.pics.chosen);
  return zen || b.pics.buddies.find((x) => x.id === b.pics.chosen) || null;
};
function buddyAvatar(cls) {
  const b = chosenBuddy();
  if (b && b.key) return zenFace(b.key, cls);
  return b ? h('img', { class: `buddy-img ${cls || ''}`, src: `/buddy-pic/${b.id}`, alt: '' }) : buddyFace(cls);
}

// Zen friends: calm, original characters drawn right here (no pictures to load). Ids match BUILTIN_BUDDIES on the server.
const ZEN = [
  { id: -1, key: 'panda', name: 'Bao the zen panda' },
  { id: -2, key: 'dragon', name: 'Jade the zen dragon' },
  { id: -3, key: 'cat', name: 'Mochi the zen cat' },
];
function zenFace(key, cls) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', `zen zen-${key}${cls ? ` ${cls}` : ''}`);
  const add = (tag, attrs) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); s.append(e); };
  const line = (d, stroke, w) => add('path', { d, stroke, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none' });
  const cheeks = () => { add('circle', { cx: 30, cy: 68, r: 4, fill: '#f4a58a', opacity: '.55' }); add('circle', { cx: 70, cy: 68, r: 4, fill: '#f4a58a', opacity: '.55' }); };
  if (key === 'panda') {
    add('circle', { cx: 27, cy: 30, r: 10, fill: '#2b2a22' }); add('circle', { cx: 73, cy: 30, r: 10, fill: '#2b2a22' });
    add('circle', { cx: 50, cy: 58, r: 32, fill: '#fbfaf5', stroke: '#d9d6c8', 'stroke-width': 1.5 });
    add('ellipse', { cx: 36, cy: 55, rx: 8, ry: 10, fill: '#2b2a22', transform: 'rotate(-20 36 55)' });
    add('ellipse', { cx: 64, cy: 55, rx: 8, ry: 10, fill: '#2b2a22', transform: 'rotate(20 64 55)' });
    line('M31 55 Q36 60 41 55', '#fff', 2.6); line('M59 55 Q64 60 69 55', '#fff', 2.6);
    add('ellipse', { cx: 50, cy: 66, rx: 5, ry: 3.6, fill: '#2b2a22' });
    line('M50 69 V72', '#2b2a22', 2.2); line('M44 73 Q50 78 56 73', '#2b2a22', 2.4);
    cheeks();
    add('path', { d: 'M50 27 C50 18 56 14 62 15 C61 22 57 27 50 27z', fill: '#6fb04e' });
  } else if (key === 'dragon') {
    add('path', { d: 'M24 46 L8 40 L14 58 L26 56z', fill: '#8fe0c0' }); add('path', { d: 'M76 46 L92 40 L86 58 L74 56z', fill: '#8fe0c0' });
    add('path', { d: 'M38 30 Q34 14 42 10 Q44 22 46 30z', fill: '#e8a33d' }); add('path', { d: 'M62 30 Q66 14 58 10 Q56 22 54 30z', fill: '#e8a33d' });
    add('circle', { cx: 50, cy: 58, r: 30, fill: '#5fbf9a' });
    add('ellipse', { cx: 50, cy: 70, rx: 17, ry: 13, fill: '#bfeedb' });
    add('circle', { cx: 45, cy: 69, r: 1.7, fill: '#2f6b55' }); add('circle', { cx: 55, cy: 69, r: 1.7, fill: '#2f6b55' });
    line('M33 54 Q38 59 43 54', '#1f3d33', 3); line('M57 54 Q62 59 67 54', '#1f3d33', 3);
    line('M43 76 Q50 81 57 76', '#1f3d33', 2.4);
    line('M30 66 Q16 70 12 80', '#e8a33d', 2.2); line('M70 66 Q84 70 88 80', '#e8a33d', 2.2);
    cheeks();
    [42, 50, 58].forEach((x) => add('circle', { cx: x, cy: 42, r: 2, fill: '#8fe0c0' }));
  } else {
    add('path', { d: 'M24 40 L30 12 L48 30z', fill: '#f6efe2' }); add('path', { d: 'M29 36 L32 20 L42 30z', fill: '#f4a58a' });
    add('path', { d: 'M76 40 L70 12 L52 30z', fill: '#f6efe2' }); add('path', { d: 'M71 36 L68 20 L58 30z', fill: '#f4a58a' });
    add('circle', { cx: 50, cy: 60, r: 31, fill: '#f6efe2', stroke: '#e2d6bf', 'stroke-width': 1.5 });
    add('ellipse', { cx: 66, cy: 44, rx: 12, ry: 9, fill: '#e8a33d', opacity: '.85', transform: 'rotate(20 66 44)' });
    line('M32 56 Q37 61 42 56', '#2b2a22', 3); line('M58 56 Q63 61 68 56', '#2b2a22', 3);
    add('path', { d: 'M46 64 L54 64 L50 69z', fill: '#f08fa3' });
    line('M50 69 V72 M50 72 Q45 76 41 73 M50 72 Q55 76 59 73', '#2b2a22', 2);
    line('M30 66 L14 63 M30 70 L14 72 M70 66 L86 63 M70 70 L86 72', '#b9a98a', 1.6);
    cheeks();
  }
  return s;
}

async function mountBuddy(c, openWith) {
  if (!state.buddy || state.buddy.childId !== c.id) {
    try {
      const [facts, pics] = await Promise.all([api('GET', `/api/children/${c.id}/buddy`), api('GET', `/api/children/${c.id}/buddies`)]);
      state.buddy = { childId: c.id, facts, pics };
    } catch { return; }
  }
  if (!document.getElementById('app').querySelector('.shell.kid')) return;
  document.querySelector('.buddy')?.remove(); document.querySelector('.surfer')?.remove();
  document.querySelector('.topbar .brand-ic')?.replaceChildren(buddyAvatar());
  const f = state.buddy.facts;
  const name = f.name;
  const me = chosenBuddy();
  const buddyName = me ? me.name : 'Kai the sprout';
  const say = h('div', { class: 'bubble', 'aria-live': 'polite' });
  const pic = h('div', { class: 'bubble-pic' });
  const chips = h('div', { class: 'buddy-chips' });
  const panel = h('div', { class: 'buddy-panel hidden', role: 'dialog', 'aria-label': buddyName },
    h('div', { class: 'buddy-head' }, h('div', { class: 'buddy-who' }, buddyAvatar('mini'), h('strong', null, me ? buddyName : `${buddyName} 🌱`)),
      h('button', { class: 'btn small ghost', 'aria-label': 'Close', onclick: () => panel.classList.add('hidden') }, '✕')),
    say, pic, chips);

  const areas = Object.keys(f.counts).length;
  const talk = (text, imageId, alt) => {
    say.textContent = text;
    pic.replaceChildren(...(imageId ? [h('img', { src: `/media/${imageId}`, alt: alt || '' })] : []));
  };
  const goTo = (cat) => { if (cat === 'all') setFilter('all', 'all'); else setFilter(groupOf(cat), cat); document.getElementById('main')?.scrollIntoView({ behavior: 'smooth' }); };

  // Pick a buddy: the sprout, or any picture a parent added.
  const choose = () => {
    talk('Who do you want as your buddy? Tap one!');
    const options = [{ id: null, name: 'Kai the sprout' }, ...ZEN, ...state.buddy.pics.buddies];
    pic.replaceChildren(h('div', { class: 'buddy-pick' }, options.map((o) =>
      h('button', { class: 'pick', 'aria-pressed': String((state.buddy.pics.chosen ?? null) === o.id), onclick: async () => {
        try {
          const r = await api('PUT', `/api/children/${c.id}/buddy`, { buddyId: o.id });
          state.buddy.pics.chosen = r.chosen;
          mountBuddy(c, `Yay! I’m ${o.name}, your new buddy! Let’s look at your moments together. 🎉`);
        } catch (ex) { talk(ex.message); }
      } }, o.key ? zenFace(o.key) : o.id ? h('img', { src: `/buddy-pic/${o.id}`, alt: '' }) : buddyFace(), h('span', null, o.name)))));
  };

  // Three slow breaths with a growing and shrinking circle. Stops by itself if the panel changes or closes.
  const zenBreath = () => {
    const word = h('span', { class: 'zen-word' }, 'Ready?');
    const orb = h('div', { class: 'zen-orb' }, word);
    say.textContent = `Let’s take 3 slow breaths together, ${name}. Sit tall and let your shoulders drop.`;
    pic.replaceChildren(orb);
    let round = 0;
    const breatheIn = () => {
      if (!orb.isConnected) return;
      if (round === 3) { orb.className = 'zen-orb'; word.textContent = '😊'; say.textContent = pick(ZEN_DONE); return; }
      round += 1; orb.className = 'zen-orb in'; word.textContent = 'Breathe in…';
      setTimeout(() => {
        if (!orb.isConnected) return;
        orb.className = 'zen-orb out'; word.textContent = 'Breathe out…';
        setTimeout(breatheIn, 4000);
      }, 4000);
    };
    setTimeout(breatheIn, 1500);
  };

  const topics = [];
  if (f.total > 0) {
    topics.push(['⭐ How many moments?', () => talk(`You have ${f.total} moment${f.total > 1 ? 's' : ''} saved in ${areas} area${areas > 1 ? 's' : ''}. Wow, ${name}!`)]);
    topics.push(['💭 Remember something', () => {
      const r = f.remember;
      talk(`Remember “${r.title}” from ${fmtDate(r.date)}? That was a good one!`, r.imageId, r.title);
    }]);
    topics.push(['🏆 What am I proud of?', () => {
      if (f.lastPassed) { talk(`You passed ${f.lastPassed.level}${f.lastPassed.score ? ` with ${f.lastPassed.score}` : ''}! 🎉`); confetti(); }
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
  topics.push(['🎉 Cheer me on', () => { talk(pick(CHEERS)); confetti(); }]);
  topics.push(['🧘 Zen breath', zenBreath]);
  topics.push(['🎭 Pick my friend', choose]);

  chips.replaceChildren(...topics.map(([label, fn]) => h('button', { class: 'chip', onclick: fn }, label)));
  const hello = () => talk(f.total > 0
    ? (me ? `Hi ${name}! It’s me, ${buddyName}! I keep all your moments safe. What would you like to see?`
      : `Hi ${name}! I’m Kai, your sprout friend. I keep all your moments safe. What would you like to see?`)
    : `Hi ${name}! Your journey is just starting. Ask Mummy or Papa to add your first moment!`);

  // Buddy surfs around the screen; tapping it docks it bottom-right and opens the panel.
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let roam = null;
  const setOpen = (open, greet = true) => {
    panel.classList.toggle('hidden', !open);
    hint.remove();
    if (calm) { if (open && greet) hello(); return; }
    btn.classList.toggle('hidden', !open);
    surfer.classList.toggle('hidden', open);
    if (open) { if (greet) hello(); } else roam?.reset();
  };
  const btn = h('button', { class: `buddy-btn${calm ? '' : ' hidden'}`, 'aria-label': `Talk to ${buddyName}`, onclick: () => setOpen(panel.classList.contains('hidden')) }, buddyAvatar());
  const hint = h('div', { class: 'buddy-hint' }, `Hi ${name}! Tap me 👋`);
  panel.querySelector('.buddy-head .btn')?.addEventListener('click', () => setOpen(false));
  const surfBtn = h('button', { class: 'surfer-btn', 'aria-label': `Talk to ${buddyName}`, onclick: () => setOpen(true) }, buddyAvatar());
  const surfer = h('div', { class: 'surfer' }, openWith || calm ? null : hint,
    h('div', { class: 'surfer-ride' }, surfBtn, h('div', { class: 'board' }), surfWave()));
  document.body.append(h('div', { class: 'buddy' }, panel, openWith || !calm ? null : hint, btn));
  if (!calm) {
    document.body.append(surfer);
    roam = surfAround(surfer, () => !panel.classList.contains('hidden'));
  }
  if (openWith) { setOpen(true, false); talk(openWith); }
}

function surfWave() {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 112 26'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'surf-wave');
  const wave = (cls, d) => { const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d); if (cls) p.setAttribute('class', cls); s.append(p); };
  wave('', 'M0 12 Q14 0 28 12 T56 12 T84 12 T112 12 V26 H0Z');
  wave('w2', 'M0 18 Q14 8 28 18 T56 18 T84 18 T112 18 V26 H0Z');
  return s;
}

// Glide the surfer to a new spot every few seconds, tilting the way it travels.
function surfAround(el, isPaused) {
  const W = 92, H = 112, rand = (a, b) => a + Math.random() * (b - a);
  let x = 0, y = 0, timer;
  const bounds = () => ({ minX: 8, maxX: Math.max(9, innerWidth - W - 8), minY: Math.max(90, innerHeight * 0.38), maxY: Math.max(140, innerHeight - H - 84) });
  const place = (nx, ny, dur) => {
    el.classList.toggle('left', nx < x); x = nx; y = ny;
    el.style.setProperty('--dur', `${dur}s`); el.style.setProperty('--x', `${nx}px`); el.style.setProperty('--y', `${ny}px`);
  };
  const next = () => {
    if (!el.isConnected) return;
    if (isPaused() || document.hidden) { timer = setTimeout(next, 1500); return; }
    const b = bounds(), nx = rand(b.minX, b.maxX), ny = rand(b.minY, b.maxY);
    const dur = Math.min(8, Math.max(2.5, Math.hypot(nx - x, ny - y) / 80));
    place(nx, ny, dur);
    timer = setTimeout(next, dur * 1000 + rand(700, 3200));
  };
  const reset = () => {
    clearTimeout(timer);
    const b = bounds(); place(b.maxX, b.maxY, 0);
    timer = setTimeout(next, 1200);
  };
  reset();
  return { reset };
}

/* ---------- go ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
