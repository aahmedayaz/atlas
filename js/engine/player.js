// Lesson view: centre sheet (title, diagram, code, stepper) + right rail (step narration, nav, checklist).
import { Scene } from './scene.js';
import { esc, fmt, highlight } from './text.js';

const VIEWS = [
  ['steps', 'Walkthrough', (l) => l.steps?.length],
  ['interview', 'Interview', (l) => l.interview?.length],
  ['scenarios', 'Scenarios', (l) => l.scenarios?.length],
  ['history', 'History & alternatives', (l) => (l.history ? 1 : 0)],
  ['quiz', 'Quiz', (l) => l.quiz?.length],
  ['cheat', 'Cheat sheet', (l) => (l.cheat ? 1 : 0)],
];
const COUNTED = new Set(['interview', 'scenarios', 'quiz']);

export function renderLesson(root, L, ctx) {
  const views = VIEWS.filter(([, , has]) => has(L));
  const view = views.some(([v]) => v === ctx.view) ? ctx.view : 'steps';
  const chNum = String(ctx.chapterIndex + 1).padStart(2, '0');
  root.innerHTML = `
    <div class="lesson">
      <section class="sheet center">
        <header class="lhead">
          <div class="top-row">
            <div style="min-width:0;flex:1 1 360px">
              <div class="crumb"><a href="#${ctx.tab.id}">${chNum}. ${esc(ctx.chapter.title)}</a> / Lesson ${ctx.index + 1} of ${ctx.chapter.lessons.length}</div>
              <h1>${esc(L.title)}</h1>
            </div>
            <div class="pills">
              <span class="pill t-time">◷ ${L.minutes} min</span>
              <span class="pill t-lvl">▮ ${esc(L.level)}</span>
              <span class="pill t-steps">☰ ${L.steps.length} steps</span>
            </div>
          </div>
          <p class="sum">${fmt(L.summary)}</p>
        </header>
        <nav class="views">${views.map(([v, label, has]) => `<a href="#${L.id}${v === 'steps' ? '' : '-' + v}" class="${v === view ? 'on' : ''}">${label}${COUNTED.has(v) ? `<span class="n">${has(L)}</span>` : ''}</a>`).join('')}</nav>
        <div class="vbody"></div>
      </section>
      <aside class="rail"></aside>
    </div>`;
  const body = root.querySelector('.vbody'), rail = root.querySelector('.rail');
  if (view === 'steps') return walkthrough(body, rail, L, ctx);
  ({ interview, scenarios, history, quiz, cheat })[view](body, L, ctx);
  rail.innerHTML = learnBox(L, ctx) + `<div class="sheet learnbox"><div class="h">Practice this lesson</div>
    ${views.filter(([v]) => v !== view).map(([v, label]) => `<a href="#${L.id}${v === 'steps' ? '' : '-' + v}">→ ${label}</a>`).join('')}
    ${ctx.next ? `<a href="#${ctx.next.id}" style="margin-top:6px;font-weight:700">Next lesson: ${esc(ctx.next.title)} →</a>` : ''}</div>`;
  return () => {};
}

function learnBox(L, ctx) {
  if (!L.learn) return '';
  const seen = (ctx.progress.seen || []).length, N = L.steps.length;
  return `<div class="sheet learnbox"><div class="h">You’ll learn</div>${L.learn.map((x, k) => `<div class="li${seen >= Math.ceil(((k + 1) / L.learn.length) * N) ? ' on' : ''}"><span>${fmt(x)}</span></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- walkthrough
function walkthrough(body, rail, L, ctx) {
  const N = L.steps.length;
  let i = Math.min(Math.max(0, ctx.step || 0), N - 1);
  let playing = false, timer = null, prevFacts = {};
  body.innerHTML = `
    <div class="stagebar"><div class="facts"></div><div class="ctrl"><button class="pbtn rp" title="Replay the animation">↻ Replay</button><button class="pbtn pz" title="Pause packets">❚❚ Pause</button><button class="pbtn spd" title="Animation speed">1×</button></div></div>
    <div class="stage"><div class="svgwrap"></div></div>
    <div class="legend"></div>
    <div class="codep" hidden></div>
    <div class="inlesson"><div class="hd">In this lesson <span class="pos"></span></div>
      <div class="stepper" role="tablist">${L.steps.map((s, k) => `<button data-k="${k}" title="${esc(s.title)}"><span class="n">${k + 1}</span><span class="t">${esc(s.short || s.title)}</span></button>`).join('')}</div>
    </div>`;
  rail.innerHTML = `
    <article class="sheet narr" aria-live="polite"></article>
    <div class="navwrap">
      <div class="navbar"><button class="pbtn prev">← Back</button><button class="pbtn play" title="Auto-play (space)">▶</button><button class="pbtn green next"></button></div>
      <div class="kbdhint"><kbd>←</kbd> <kbd>→</kbd> step · <kbd>space</kbd> auto-play</div>
    </div>
    <div class="lb"></div>`;
  const $ = (s) => body.querySelector(s) || rail.querySelector(s);
  const scene = new Scene($('.svgwrap'));
  const stepBtns = [...body.querySelectorAll('.stepper button')];
  const seen = new Set(ctx.progress.seen || []);
  // on narrow screens the narration sits right under the diagram instead of in the right rail
  const mq = matchMedia('(max-width: 1240px)');
  const narrEl = rail.querySelector('.narr'), navEl = rail.querySelector('.navwrap'), codeEl = body.querySelector('.codep');
  const placeRail = () => { if (mq.matches) { body.insertBefore(narrEl, codeEl); body.insertBefore(navEl, codeEl); } else { rail.prepend(navEl); rail.prepend(narrEl); } };
  mq.addEventListener('change', placeRail); placeRail();

  $('.rp').onclick = () => scene.replay();
  $('.pz').onclick = () => { scene.paused = !scene.paused; $('.pz').textContent = scene.paused ? '▶ Play' : '❚❚ Pause'; };
  $('.spd').onclick = () => { const s = { 1: 0.5, 0.5: 2, 2: 1 }[scene.speed]; scene.speed = s; $('.spd').textContent = s + '×'; };

  function show(k, push = true) {
    i = Math.min(Math.max(0, k), N - 1);
    const s = L.steps[i];
    seen.add(i);
    ctx.save({ seen: [...seen], max: Math.max(ctx.progress.max ?? -1, i), done: ctx.progress.done || seen.size === N });
    ctx.progress = { ...ctx.progress, seen: [...seen] };
    scene.set(s.scene || {});
    const sw = $('.svgwrap'); sw.scrollLeft = (sw.scrollWidth - sw.clientWidth) / 2;   // centre wide diagrams on phones
    stepBtns.forEach((b, k2) => { b.classList.toggle('on', k2 === i); b.classList.toggle('seen', seen.has(k2) && k2 !== i); });
    const sp = $('.stepper'), btn = stepBtns[i];
    sp.scrollTo({ left: btn.offsetLeft - sp.clientWidth / 2 + btn.clientWidth / 2, behavior: 'smooth' });
    $('.pos').textContent = `Step ${i + 1} of ${N}`;
    $('.legend').innerHTML = (s.legend || []).map((x) => { const [t, c] = String(x).split('|'); return `<span style="--lc:${c || 'var(--muted2)'}">${esc(t)}</span>`; }).join('');
    // facts row (stat tiles above the diagram)
    const facts = s.facts || [];
    $('.facts').innerHTML = facts.map(([k2, v]) => `<div class="${prevFacts[k2] !== undefined && prevFacts[k2] !== v ? 'chg' : ''}"><small>${esc(k2)}</small><b>${esc(v)}</b></div>`).join('');
    prevFacts = Object.fromEntries(facts);
    // narration
    $('.narr').innerHTML = `
      <div class="st">STEP ${i + 1} / ${N} ${s.tag ? `<span class="tag ${s.tag}">${s.tag}</span>` : ''}</div>
      <h2>${esc(s.title)}</h2>
      ${(Array.isArray(s.body) ? s.body : [s.body]).filter(Boolean).map((p) => (/^\s*<(ul|ol|table|div)/.test(p) ? fmt(p) : `<p>${fmt(p)}</p>`)).join('')}
      ${s.callout ? `<div class="callout ${s.callout.kind || 'insight'}"><div><b class="k">${esc(s.callout.title || { tip: 'Good to know', warn: 'Watch out', insight: 'Key insight', bad: 'Common mistake' }[s.callout.kind || 'insight'])}</b>${fmt(s.callout.text)}</div></div>` : ''}
      ${s.vars ? `<div class="vars"><div class="h">${esc(s.varsTitle || 'What changed')}</div>${Object.entries(s.vars).map(([k2, v]) => `<div class="li"><span><b>${esc(k2)}:</b> ${fmt(String(v))}</span></div>`).join('')}</div>` : ''}
      ${s.interview ? `<div class="iv"><b class="k">Interview angle</b>${fmt(s.interview)}</div>` : ''}`;
    $('.narr').scrollTop = 0;
    $('.lb').innerHTML = learnBox(L, ctx);
    // code
    const cp = $('.codep');
    if (s.code) {
      cp.hidden = false;
      const hl = expand(s.code.hl);
      const lines = highlight(s.code.src.replace(/^\n/, ''), s.code.lang || 'js');
      cp.innerHTML = `<div class="ch"><span class="dots"><i></i><i></i><i></i></span><span>${esc(s.code.file || '')}</span><span class="lang">${esc(s.code.lang || 'js')}</span><button class="cp">Copy</button></div>
        <pre>${lines.map((ln, k2) => `<span class="ln${hl.has(k2 + 1) ? ' hl' : hl.size && s.code.focus ? ' dimln' : ''}">${ln || ' '}</span>`).join('')}</pre>
        ${s.code.note ? `<div class="note">${fmt(s.code.note)}</div>` : ''}`;
      cp.querySelector('.cp').onclick = async (ev) => {
        try { await navigator.clipboard.writeText(s.code.src.replace(/^\n/, '')); ev.target.textContent = 'Copied'; } catch { ev.target.textContent = 'Select & copy'; }
        setTimeout(() => (ev.target.textContent = 'Copy'), 1400);
      };
      const first = cp.querySelector('.ln.hl');
      if (first) { const pre = cp.querySelector('pre'); pre.scrollTop = Math.max(0, first.offsetTop - pre.clientHeight / 3); }
    } else cp.hidden = true;
    // nav
    $('.prev').disabled = i === 0;
    const nx = $('.next');
    let label;
    if (i < N - 1) label = `Next: ${L.steps[i + 1].short || L.steps[i + 1].title}`;
    else if (L.quiz) label = `Quiz: ${L.quiz.length} questions`;
    else if (ctx.next) label = `Next lesson: ${ctx.next.title}`;
    else label = `Back to ${ctx.tab.title}`;
    nx.innerHTML = `<span>${esc(label)}</span><span>→</span>`;
    if (push) ctx.setHash(i === 0 ? L.id : `${L.id}-s${i + 1}`);
    if (playing) schedule();
  }
  function next() {
    if (i < N - 1) return show(i + 1);
    stop();
    location.hash = L.quiz ? `${L.id}-quiz` : ctx.next ? ctx.next.id : ctx.tab.id;
  }
  function schedule() {
    clearTimeout(timer);
    const s = L.steps[i];
    const words = (Array.isArray(s.body) ? s.body.join(' ') : s.body || '').split(/\s+/).length + (s.callout ? 25 : 0);
    timer = setTimeout(() => (i < N - 1 ? show(i + 1) : stop()), Math.min(16000, 3500 + words * 230));
  }
  function stop() { playing = false; clearTimeout(timer); $('.play').textContent = '▶'; }
  $('.play').onclick = () => { playing = !playing; $('.play').textContent = playing ? '❚❚' : '▶'; playing ? schedule() : stop(); };
  $('.prev').onclick = () => { stop(); show(i - 1); };
  $('.next').onclick = () => { stop(); next(); };
  stepBtns.forEach((b) => (b.onclick = () => { stop(); show(+b.dataset.k); }));
  const onKey = (ev) => {
    if (ev.target.closest('input,textarea') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'ArrowRight') { stop(); next(); }
    else if (ev.key === 'ArrowLeft') { stop(); show(i - 1); }
    else if (ev.key === ' ' && !ev.target.closest('button,a')) { ev.preventDefault(); $('.play').click(); }
  };
  addEventListener('keydown', onKey);
  // swipe on the diagram (only when it is not horizontally scrollable)
  let sx = null;
  $('.stage').addEventListener('touchstart', (ev) => (sx = ev.touches[0].clientX), { passive: true });
  $('.stage').addEventListener('touchend', (ev) => { if (sx == null) return; const d = ev.changedTouches[0].clientX - sx; if (Math.abs(d) > 60 && $('.svgwrap').scrollWidth <= $('.svgwrap').clientWidth) { stop(); d < 0 ? next() : show(i - 1); } sx = null; });
  show(i, false);
  return () => { stop(); scene.destroy(); removeEventListener('keydown', onKey); mq.removeEventListener('change', placeRail); };
}

function expand(hl) {
  const s = new Set();
  for (const x of hl || []) {
    if (typeof x === 'number') s.add(x);
    else { const [a, b] = String(x).split('-').map(Number); for (let k = a; k <= (b || a); k++) s.add(k); }
  }
  return s;
}

// ---------------------------------------------------------------- other views
function interview(root, L) {
  const lv = { J: ['Junior', 'Beginner'], M: ['Mid', 'Intermediate'], S: ['Senior', 'Advanced'] };
  root.innerHTML = `<p class="vintro">Answer out loud first, then open the card. Each answer gives the <b>what</b>, the <b>why</b> (the reasoning interviewers listen for) and likely follow-ups.</p>` +
    L.interview.map((q, k) => `<details class="qa"${k === 0 ? ' open' : ''}><summary><span>${fmt(q.q)}</span><span class="badge lvl lv-${(lv[q.lvl] || lv.M)[1]}">${(lv[q.lvl] || lv.M)[0]}</span></summary>
      <div class="body">${(Array.isArray(q.a) ? q.a : [q.a]).map((p) => `<p>${fmt(p)}</p>`).join('')}
      ${q.why ? `<div class="why"><b>Why interviewers ask:</b> ${fmt(q.why)}</div>` : ''}
      ${q.follow ? `<div class="fu"><b>Likely follow-ups:</b> ${q.follow.map(fmt).join(' · ')}</div>` : ''}</div></details>`).join('');
}

function scenarios(root, L) {
  root.innerHTML = `<p class="vintro">Real situations. Predict what happens before opening the timeline.</p>` +
    L.scenarios.map((s) => `<div class="sc"><h3>${fmt(s.title)}</h3><p class="sit">${fmt(s.sit)}</p>
      <details><summary class="pbtn">Show what happens</summary><div class="tl" style="margin-top:14px">${s.steps.map(([c, t]) => `<div class="ev ${c}"><p>${fmt(t)}</p></div>`).join('')}</div>
      ${s.fix ? `<div class="callout tip"><div><b class="k">Fix / best practice</b>${fmt(s.fix)}</div></div>` : ''}</details></div>`).join('');
}

function history(root, L) {
  const H = L.history;
  root.innerHTML = `
    ${H.intro ? `<p class="vintro">${fmt(H.intro)}</p>` : ''}
    <div class="prose"><h3>How we got here — who, when, why</h3><div class="tl">${H.timeline.map((t) => `<div class="ev ${t.c || ''}"><div class="yr">${esc(t.yr)}</div><h4>${fmt(t.title)}</h4><p>${fmt(t.text)}</p></div>`).join('')}</div></div>
    ${H.alts ? `<div class="prose" style="margin-top:12px"><h3>Current alternatives — when to pick which</h3><div class="tblw"><table class="t"><tr>${H.alts.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${H.alts.rows.map((r) => `<tr>${r.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</table></div></div>` : ''}`;
}

function quiz(root, L, ctx) {
  let score = 0, answered = 0;
  root.innerHTML = `<div class="score">Score&nbsp;<span class="s">0</span>&nbsp;/ ${L.quiz.length}</div><div class="quiz">${L.quiz.map((q, k) => `<div class="q" data-k="${k}"><b>${k + 1}. ${fmt(q.q)}</b><div class="opts">${q.o.map((o, j) => `<button data-j="${j}">${fmt(o)}</button>`).join('')}</div><div class="fb" hidden></div></div>`).join('')}</div>`;
  root.querySelectorAll('.q').forEach((el) => {
    const q = L.quiz[+el.dataset.k];
    let done = false;
    el.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      if (done) return; done = true; answered++;
      const j = +b.dataset.j, btns = el.querySelectorAll('button');
      btns[q.a].classList.add('right');
      if (j === q.a) score++; else b.classList.add('wrong');
      root.querySelector('.score .s').textContent = score;
      const fb = el.querySelector('.fb'); fb.hidden = false;
      fb.innerHTML = (j === q.a ? '✅ <b>Correct.</b> ' : '❌ <b>Not quite.</b> ') + fmt(q.why);
      if (answered === L.quiz.length) ctx.save({ quiz: Math.max(score, ctx.progress.quiz || 0) });
    }));
  });
}

function cheat(root, L) { root.innerHTML = `<div class="prose">${fmt(L.cheat)}</div>`; }
