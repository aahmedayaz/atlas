// App shell: tabs, sidebar, routing, search, theme, progress.
import { TABS, LESSONS } from './catalog.js';
import { GLOSSARY } from './glossary.js';
import { renderLesson } from './engine/player.js';
import { esc, fmt } from './engine/text.js';

// ---------- progress (one viewer's browser only; the course works without it) ----------
const store = {
  get() { try { return JSON.parse(localStorage.getItem('atlas:progress') || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem('atlas:progress', JSON.stringify(v)); } catch {} },
};
let P = store.get();
const prog = (id) => P[id] || {};
const saveProg = (id, patch) => { P[id] = { ...prog(id), ...patch }; store.set(P); paintSideDots(); };

// ---------- index ----------
const where = new Map(); // lessonId -> { tab, chapter, index }
TABS.forEach((tab) => tab.chapters.forEach((ch, chapterIndex) => ch.lessons.forEach((l, index) => where.set(l.id, { tab, chapter: ch, chapterIndex, index }))));
const built = (l) => !!l.steps;
function nextBuilt(id) {
  const w = where.get(id);
  const flat = w.tab.chapters.flatMap((c) => c.lessons).filter(built);
  const k = flat.findIndex((l) => l.id === id);
  return flat[k + 1] || null;
}

// ---------- shell ----------
const app = document.getElementById('app');
app.innerHTML = `
  <header class="top">
    <button class="iconbtn menu-btn" aria-label="Open the course menu">☰</button>
    <a class="brand" href="#eng"><span class="brand-mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z" fill="var(--green)"/><path d="M12 12l8.5-4.7M12 12v9.5M12 12L3.5 7.3"/></svg></span><span class="name">Engineering <span class="hl">Atlas</span></span></a>
    <nav class="tabs">${TABS.map((t) => `<a href="#${t.id}" data-tab="${t.id}"><span class="full">${esc(t.title)}</span><span class="short">${esc(t.short || t.title)}</span></a>`).join('')}</nav>
    <span class="sp"></span>
    <button class="iconbtn srch" aria-label="Search">⌕ <span class="lbl">Search lessons &amp; concepts…</span> <kbd>Ctrl K</kbd></button>
    <a class="iconbtn gl-link" href="#glossary" title="Glossary">Aa <span class="lbl">Glossary</span></a>
    <button class="iconbtn theme" aria-label="Toggle dark mode">◐</button>
  </header>
  <div class="layout"><aside class="side" id="side"></aside><main class="main" id="main"></main></div>
  <div class="modal" id="search"><div class="sbox"><input placeholder="Search lessons, steps and terms…" aria-label="Search"><div class="sres"></div></div></div>
  <div class="pop" id="pop"></div>`;
const side = document.getElementById('side'), main = document.getElementById('main');

document.querySelector('.theme').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('atlas:theme', dark ? 'dark' : 'light'); } catch {}
};
document.querySelector('.menu-btn').onclick = () => document.body.classList.toggle('side-open');

// ---------- sidebar ----------
let sideTab = null;
const FOLDER = ['#e3ae3c', '#3fa456', '#7c63d0', '#e8834d', '#2f86ce', '#d9577a', '#8c9a3c', '#64728a', '#2a9d8f'];
function renderSide(tab, activeId) {
  sideTab = tab;
  const all = tab.chapters.flatMap((c) => c.lessons);
  side.innerHTML = `<div class="course">▤ ${esc(tab.title)} <small>${all.filter(built).length} lessons</small></div>` +
    (tab.chapters.length ? '' : '<div style="padding:8px;color:var(--muted);font-size:12px">Curriculum coming soon.</div>') +
    tab.chapters.map((ch, ci) => {
      const open = !activeId ? ci === 0 || ch.lessons.some(built) : ch.lessons.some((l) => l.id === activeId);
      return `<details${open ? ' open' : ''}><summary><span class="chev">▶</span><span class="fold" style="--c:${FOLDER[ci % FOLDER.length]}"></span>${String(ci + 1).padStart(2, '0')}. ${esc(ch.title)}<span class="cnt" data-ch="${ci}">0/${ch.lessons.length}</span></summary>
      ${ch.lessons.map((l, k) => built(l)
        ? `<a class="ls${l.id === activeId ? ' on' : ''}" href="#${l.id}" data-id="${l.id}"><span class="dot">${k + 1}</span><span>${esc(l.title)}</span></a>`
        : `<a class="ls soon"><span class="dot">${k + 1}</span><span>${esc(l.title)}</span><span class="soon-tag">soon</span></a>`).join('')}</details>`;
    }).join('') +
    `<div class="prog">PROGRESS <span class="bar"><i></i></span><span class="pv"></span></div>`;
  paintSideDots();
}
function paintSideDots() {
  side.querySelectorAll('a.ls[data-id]').forEach((a) => {
    const p = prog(a.dataset.id), d = a.querySelector('.dot');
    d.classList.toggle('done', !!p.done); d.classList.toggle('part', !p.done && !!p.seen?.length);
    if (p.done) d.textContent = '✓';
  });
  if (!sideTab) return;
  let done = 0, total = 0;
  sideTab.chapters.forEach((ch, ci) => {
    const d = ch.lessons.filter((l) => prog(l.id).done).length;
    done += d; total += ch.lessons.length;
    const c = side.querySelector(`.cnt[data-ch="${ci}"]`); if (c) c.textContent = `${d}/${ch.lessons.length}`;
  });
  const pv = side.querySelector('.pv'); if (pv) pv.textContent = `${done} / ${total}`;
  const bar = side.querySelector('.prog .bar i'); if (bar) bar.style.width = (total ? (done / total) * 100 : 0) + '%';
}

// ---------- home (per tab) ----------
function renderHome(tab) {
  const all = tab.chapters.flatMap((c) => c.lessons);
  const ready = all.filter(built);
  const steps = ready.reduce((a, l) => a + l.steps.length, 0);
  main.innerHTML = `<div class="wrap">
    <section class="sheet hero">
      <div class="eyebrow">${esc(tab.title)} · ${ready.length} lessons · ${steps} animated steps</div>
      <h1>${esc(tab.headline)}</h1>
      <p>${fmt(tab.blurb)}</p>
      <div class="how">
        <div><b>1 · Watch</b>Every idea is an animated diagram. Step through it with → or swipe.</div>
        <div><b>2 · Read the code</b>Code panels highlight exactly the lines that matter at each step.</div>
        <div><b>3 · Interview-proof it</b>Each lesson has graded questions with the reasoning, plus history and alternatives.</div>
        <div><b>4 · Practise</b>Scenarios and a quiz close every lesson. Progress is saved in this browser.</div>
      </div>
    </section>
    ${tab.chapters.map((ch, ci) => `<section class="chapter">
      <h2>${String(ci + 1).padStart(2, '0')} · ${esc(ch.title)}</h2><div class="meta">${fmt(ch.blurb || '')}</div>
      <div class="cards">${ch.lessons.map((l, k) => built(l) ? `
        <a class="card" href="#${l.id}"><span class="num">${ci + 1}.${k + 1}</span><h3>${esc(l.title)}</h3><p>${fmt(l.summary)}</p>
          <div class="row"><span class="badge lv-${l.level}">${l.level}</span><span class="badge">${l.steps.length} steps</span><span class="badge">${l.minutes} min</span>${l.interview ? `<span class="badge">${l.interview.length} interview Qs</span>` : ''}</div>
          <div class="pbar"><i style="width:${Math.round(((prog(l.id).seen?.length || 0) / l.steps.length) * 100)}%"></i></div></a>`
        : `<div class="card soon"><span class="num">${ci + 1}.${k + 1}</span><h3>${esc(l.title)}</h3><p>${fmt(l.summary || 'Planned')}</p><div class="row"><span class="badge">Coming soon</span></div></div>`).join('')}</div>
    </section>`).join('')}
  </div>`;
}

function renderGlossary() {
  main.innerHTML = `<div class="wrap"><div class="crumb">Reference</div><header class="lhead"><h1>Glossary</h1><p class="sum">Every dotted term in the lessons. Filter to find one.</p></header>
    <input class="glq" placeholder="Filter… e.g. fiber, hydration, CDN" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:15px;margin:14px 0">
    <div class="cards gl"></div></div>`;
  const draw = (q) => (main.querySelector('.gl').innerHTML = Object.entries(GLOSSARY).filter(([k, [t, d]]) => !q || (k + t + d).toLowerCase().includes(q)).sort((a, b) => a[1][0].localeCompare(b[1][0]))
    .map(([, [t, d]]) => `<div class="card"><h3 style="font-size:15.5px">${esc(t)}</h3><p>${esc(d)}</p></div>`).join(''));
  main.querySelector('.glq').oninput = (ev) => draw(ev.target.value.toLowerCase().trim());
  draw('');
}

// ---------- routing ----------
let cleanup = () => {};
// replaceState does not fire hashchange, so stepping through a lesson never re-renders the page
function setHash(h) { try { history.replaceState(null, '', '#' + h); } catch {} }
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  cleanup(); cleanup = () => {};
  document.body.classList.remove('side-open');
  const tab = TABS.find((t) => t.id === h);
  if (!h || tab) {
    const t = tab || TABS[0];
    setTabs(t.id); renderSide(t, null); renderHome(t);
  } else if (h === 'glossary') {
    setTabs(null); renderSide(sideTab || TABS[0], null); renderGlossary();
  } else {
    const m = h.match(/^(.*?)(?:-(s\d+|interview|scenarios|history|quiz|cheat))?$/);
    const L = LESSONS[m[1]];
    if (!L || !built(L)) { location.hash = 'eng'; return; }
    const w = where.get(L.id);
    setTabs(w.tab.id); renderSide(w.tab, L.id);
    const sub = m[2] || '';
    const step = sub.startsWith('s') ? parseInt(sub.slice(1), 10) - 1 : 0;
    const view = sub && !sub.startsWith('s') ? sub : 'steps';
    cleanup = renderLesson(main, L, {
      ...w, step, view, next: nextBuilt(L.id), progress: prog(L.id),
      save: (patch) => saveProg(L.id, patch), setHash,
    }) || (() => {});
    document.title = `${L.title} · Engineering Atlas`;
    side.querySelector('a.on')?.scrollIntoView({ block: 'nearest' });
  }
  if (!h || !LESSONS[h.replace(/-(s\d+|interview|scenarios|history|quiz|cheat)$/, '')]) document.title = 'Engineering Atlas — learn software engineering step by step';
  scrollTo({ top: 0 });
}
function setTabs(id) { document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === id)); }
addEventListener('hashchange', route);
route();

// ---------- glossary popover ----------
const pop = document.getElementById('pop');
function showPop(t) {
  const g = GLOSSARY[t.dataset.t]; if (!g) return;
  pop.innerHTML = `<b>${esc(g[0])}</b>${esc(g[1])}`; pop.style.display = 'block';
  const r = t.getBoundingClientRect();
  let x = Math.min(r.left, innerWidth - pop.offsetWidth - 10), y = r.bottom + 8;
  if (y + pop.offsetHeight > innerHeight - 8) y = r.top - pop.offsetHeight - 8;
  pop.style.left = Math.max(8, x) + 'px'; pop.style.top = y + 'px';
}
document.addEventListener('mouseover', (ev) => { const t = ev.target.closest?.('.term'); if (t) showPop(t); });
document.addEventListener('mouseout', (ev) => { if (ev.target.closest?.('.term')) pop.style.display = 'none'; });
document.addEventListener('focusin', (ev) => { const t = ev.target.closest?.('.term'); if (t) showPop(t); });
document.addEventListener('focusout', () => (pop.style.display = 'none'));
document.addEventListener('click', (ev) => { const t = ev.target.closest?.('.term'); if (t) showPop(t); else pop.style.display = 'none'; });
addEventListener('scroll', () => (pop.style.display = 'none'), { passive: true });

// ---------- search ----------
const S = document.getElementById('search'), Sin = S.querySelector('input'), Sres = S.querySelector('.sres');
const INDEX = [];
for (const L of Object.values(LESSONS)) {
  if (!built(L)) continue;
  const w = where.get(L.id);
  INDEX.push({ g: 'Lessons', t: L.title, s: `${w.tab.title} · ${w.chapter.title}`, h: L.id, x: (L.title + ' ' + L.summary + ' ' + (L.tags || []).join(' ')).toLowerCase() });
  L.steps.forEach((st, k) => INDEX.push({ g: 'Steps', t: st.title, s: L.title + ` · step ${k + 1}`, h: k ? `${L.id}-s${k + 1}` : L.id, x: (st.title + ' ' + (Array.isArray(st.body) ? st.body.join(' ') : st.body || '')).toLowerCase() }));
  (L.interview || []).forEach((q) => INDEX.push({ g: 'Interview questions', t: q.q.replace(/`/g, ''), s: L.title, h: `${L.id}-interview`, x: q.q.toLowerCase() }));
}
for (const [k, [t, d]] of Object.entries(GLOSSARY)) INDEX.push({ g: 'Terms', t, s: d, h: 'glossary', x: (k + ' ' + t + ' ' + d).toLowerCase() });
let sel = 0;
function search(q) {
  q = q.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  const hits = (words.length ? INDEX.filter((it) => words.every((w) => it.x.includes(w))).sort((a, b) => (b.t.toLowerCase().includes(q) - a.t.toLowerCase().includes(q))) : INDEX.filter((i) => i.g === 'Lessons')).slice(0, 40);
  let g = '';
  Sres.innerHTML = hits.map((it, k) => (it.g !== g ? `<div class="grp">${(g = it.g)}</div>` : '') + `<a href="#${it.h}" class="${k === sel ? 'sel' : ''}">${esc(it.t)}<small>${esc(it.s.slice(0, 120))}</small></a>`).join('') || '<div class="grp">No matches</div>';
}
function openSearch() { S.classList.add('on'); Sin.value = ''; sel = 0; search(''); setTimeout(() => Sin.focus(), 10); }
function closeSearch() { S.classList.remove('on'); }
document.querySelector('.srch').onclick = openSearch;
S.onclick = (ev) => { if (ev.target === S || ev.target.closest('a')) closeSearch(); };
Sin.oninput = () => { sel = 0; search(Sin.value); };
Sin.onkeydown = (ev) => {
  const links = [...Sres.querySelectorAll('a')];
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, Math.min(links.length - 1, sel + (ev.key === 'ArrowDown' ? 1 : -1))); links.forEach((a, k) => a.classList.toggle('sel', k === sel)); links[sel]?.scrollIntoView({ block: 'nearest' }); }
  if (ev.key === 'Enter' && links[sel]) { location.hash = links[sel].getAttribute('href').slice(1); closeSearch(); }
  if (ev.key === 'Escape') closeSearch();
};
addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); }
  else if (ev.key === '/' && !ev.target.closest('input,textarea')) { ev.preventDefault(); openSearch(); }
  else if (ev.key === 'Escape') closeSearch();
});
