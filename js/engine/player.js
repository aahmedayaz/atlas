// Lesson view. Desktop: everything fits the viewport (no page scroll) — panels scroll internally if they must.
//   centre sheet: title · view tabs · [walkthrough: stats + controls · diagram (+ code) · stepper]
//   right rail:   step narration · Back/Next   (other views: score / checklist)
import { Scene } from './scene.js';
import { layout } from './layout.js';
import { esc, fmt, highlight } from './text.js';

const VIEWS = [
  ['steps', 'Walkthrough', (l) => l.steps?.length],
  ['scenarios', 'Scenario lab', (l) => l.scenarios?.length],
  ['interview', 'Interview', (l) => l.interview?.length],
  ['quiz', 'Quiz', (l) => l.quiz?.length],
  ['history', 'History & alternatives', (l) => (l.history ? 1 : 0)],
  ['cheat', 'Cheat sheet', (l) => (l.cheat ? 1 : 0)],
];
const COUNTED = new Set(['interview', 'scenarios', 'quiz']);
const LV = { J: ['Junior', 'Beginner'], M: ['Mid', 'Intermediate'], S: ['Senior', 'Advanced'] };
const lvBadge = (l) => `<span class="badge lv-${(LV[l] || LV.M)[1]}">${(LV[l] || LV.M)[0]}</span>`;
const store = {
  get(k, d) { try { const v = localStorage.getItem('atlas:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('atlas:' + k, JSON.stringify(v)); } catch {} },
};

export function renderLesson(root, L, ctx) {
  const views = VIEWS.filter(([, , has]) => has(L));
  const view = views.some(([v]) => v === ctx.view) ? ctx.view : 'steps';
  const chNum = String(ctx.chapterIndex + 1).padStart(2, '0');
  root.innerHTML = `
    <div class="lesson">
      <section class="sheet center">
        <header class="lhead">
          <div class="top-row">
            <div class="crumb"><a href="#${ctx.tab.id}">${chNum}. ${esc(ctx.chapter.title)}</a> / Lesson ${ctx.index + 1} of ${ctx.chapter.lessons.length}</div>
            <div class="pills">
              <span class="pill t-time">◷ ${L.minutes} min</span>
              <span class="pill t-lvl">▮ ${esc(L.level)}</span>
              <span class="pill t-steps">☰ ${L.steps.length} steps</span>
            </div>
          </div>
          <h1 title="${esc(L.title)}">${esc(L.title)}</h1>
          <p class="sum" title="${esc(String(L.summary).replace(/`/g, ''))}">${fmt(L.summary)}</p>
        </header>
        <nav class="views">${views.map(([v, label, has]) => `<a href="#${L.id}${v === 'steps' ? '' : '-' + v}" class="${v === view ? 'on' : ''}">${label}${COUNTED.has(v) ? `<span class="n">${has(L)}</span>` : ''}</a>`).join('')}</nav>
        <div class="vbody"></div>
      </section>
      <aside class="rail"></aside>
    </div>`;
  const body = root.querySelector('.vbody'), rail = root.querySelector('.rail');
  if (view === 'steps') return walkthrough(body, rail, L, ctx);
  body.classList.add('scroll');
  if (view === 'scenarios') return scenarioLab(body, rail, L, ctx);
  if (view === 'quiz') return quiz(body, rail, L, ctx);
  ({ interview, history, cheat })[view](body, L, ctx);
  rail.innerHTML = learnBox(L, ctx) + practiceBox(L, ctx, views, view);
  return () => {};
}

function learnBox(L, ctx) {
  if (!L.learn) return '';
  const seen = (ctx.progress.seen || []).length, N = L.steps.length;
  return `<div class="sheet learnbox"><div class="h">You’ll learn</div>${L.learn.map((x, k) => `<div class="li${seen >= Math.ceil(((k + 1) / L.learn.length) * N) ? ' on' : ''}"><span>${fmt(x)}</span></div>`).join('')}</div>`;
}
function practiceBox(L, ctx, views, view) {
  return `<div class="sheet learnbox"><div class="h">Practise this lesson</div>
    ${views.filter(([v]) => v !== view).map(([v, label]) => `<a href="#${L.id}${v === 'steps' ? '' : '-' + v}">→ ${label}</a>`).join('')}
    ${ctx.next ? `<a href="#${ctx.next.id}" style="margin-top:6px;font-weight:700">Next lesson: ${esc(ctx.next.title)} →</a>` : ''}</div>`;
}

// ---------------------------------------------------------------- walkthrough
function walkthrough(body, rail, L, ctx) {
  const N = L.steps.length;
  let i = Math.min(Math.max(0, ctx.step || 0), N - 1);
  let playing = false, timer = null, prevFacts = {};
  let showCode = store.get('code', true);
  body.innerHTML = `
    <div class="stagebar"><div class="facts"></div></div>
    <div class="work">
      <div class="stage" tabindex="-1">
        <div class="svgwrap"></div><div class="legend"></div>
        <div class="fs-top"><span class="fs-pos"></span><b class="fs-title"></b><span class="sp"></span>
          <button class="pbtn fs-notes" title="Notes & code (N)">☰ Notes &amp; code <kbd>N</kbd></button><button class="pbtn fs-exit" title="Exit fullscreen (Esc)">✕ Exit <kbd>Esc</kbd></button></div>
        <div class="fs-drawer"></div>
        <div class="fs-bottom">
          <button class="pbtn fs-prev">← Back</button><button class="pbtn fs-play" title="Auto-play (space)">▶</button><button class="pbtn green fs-next"></button>
          <span class="fs-gap"></span>
          <button class="pbtn fs-rp" title="Replay (R)">↻ Replay</button><button class="pbtn fs-pz" title="Pause packets (P)">❚❚ Pause</button><button class="pbtn fs-spd" title="Speed (S)">1×</button>
          <span class="fs-dots"></span>
          <span class="fs-keys"><kbd>←</kbd><kbd>→</kbd> step · <kbd>space</kbd> play · <kbd>R</kbd> replay · <kbd>P</kbd> pause · <kbd>S</kbd> speed · <kbd>N</kbd> notes · <kbd>F</kbd> exit</span>
        </div>
      </div>
      <div class="codep" hidden></div>
    </div>
    <div class="inlesson"><div class="hd"><span class="hdl">In this lesson</span><span class="ctrl">
      <button class="pbtn fsbtn" title="Fullscreen (F)" aria-label="Fullscreen">⛶<span>Fullscreen</span></button>
      <button class="pbtn ctog" title="Show or hide the code panel">&lt;/&gt; Code</button>
      <button class="pbtn rp" title="Replay the animation">↻ Replay</button><button class="pbtn pz" title="Pause packets">❚❚ Pause</button><button class="pbtn spd" title="Animation speed">1×</button></span><span class="pos"></span></div>
      <div class="stepper" role="tablist">${L.steps.map((s, k) => `<button data-k="${k}" title="${esc(s.title)}"><span class="n">${k + 1}</span><span class="t">${esc(s.short || s.title)}</span></button>`).join('')}</div>
    </div>`;
  rail.innerHTML = `
    <article class="sheet narr" aria-live="polite"></article>
    <div class="navwrap">
      <div class="navbar"><button class="pbtn prev">← Back</button><button class="pbtn play" title="Auto-play (space)">▶</button><button class="pbtn green next"></button></div>
      <div class="kbdhint"><kbd>←</kbd> <kbd>→</kbd> step · <kbd>space</kbd> auto-play · <kbd>F</kbd> fullscreen</div>
    </div>`;
  const $ = (s) => body.querySelector(s) || rail.querySelector(s);
  const scene = new Scene($('.svgwrap'));
  const stepBtns = [...body.querySelectorAll('.stepper button')];
  const seen = new Set(ctx.progress.seen || []);
  // phones: the narration sits right under the diagram instead of in the rail
  let fsOn = false;
  const mq = matchMedia('(max-width: 900px)');
  const narrEl = rail.querySelector('.narr'), navEl = rail.querySelector('.navwrap'), workEl = body.querySelector('.work'), codeEl = body.querySelector('.codep');
  // wide centre column: code beside the diagram, unless this lesson's pictures are so wide that stacking shows them bigger
  const views = L.steps.map((st) => layout(st.scene || {}).view);
  const arrange = () => {
    const W = workEl.clientWidth, H = workEl.clientHeight;
    if (!W || !H) return;
    const med = (f) => { const v = views.map(f).sort((a, b) => a - b); return v[Math.floor(v.length * 0.35)]; };
    const row = med((v) => Math.min((W * 0.56 - 12) / v.w, (H - 34) / v.h));
    const col = med((v) => Math.min(W / v.w, (H * 0.66 - 46) / v.h));
    workEl.classList.toggle('stack', col > row * 1.08);
  };
  const ro = new ResizeObserver(arrange); ro.observe(workEl);
  const placeRail = () => { if (fsOn) return; if (mq.matches) { workEl.insertBefore(narrEl, codeEl); workEl.insertBefore(navEl, codeEl); } else { rail.prepend(navEl); rail.prepend(narrEl); } };
  mq.addEventListener('change', placeRail); placeRail();

  // controls exist twice (page + fullscreen HUD); keep both in sync
  const $$ = (sel) => [...body.querySelectorAll(sel), ...rail.querySelectorAll(sel)];
  const setText = (sel, t) => $$(sel).forEach((b) => (b.textContent = t));
  const replay = () => scene.replay();
  const togglePause = () => { scene.paused = !scene.paused; setText('.pz, .fs-pz', scene.paused ? '▶ Play' : '❚❚ Pause'); };
  const cycleSpeed = () => { const s2 = { 1: 0.5, 0.5: 2, 2: 1 }[scene.speed]; scene.speed = s2; setText('.spd, .fs-spd', s2 + '×'); };
  $$('.rp, .fs-rp').forEach((b) => (b.onclick = replay));
  $$('.pz, .fs-pz').forEach((b) => (b.onclick = togglePause));
  $$('.spd, .fs-spd').forEach((b) => (b.onclick = cycleSpeed));

  // ---- fullscreen stage: real fullscreen when the browser allows it, otherwise a fixed overlay
  const stageEl = body.querySelector('.stage'), drawer = stageEl.querySelector('.fs-drawer');
  const factsEl = body.querySelector('.stagebar');
  let realFs = false, notesOn = store.get('fsNotes', true);
  const paintNotes = () => { stageEl.classList.toggle('notes', notesOn); stageEl.querySelector('.fs-notes').classList.toggle('green', notesOn); };
  async function enterFs() {
    if (fsOn) return;
    fsOn = true;
    stageEl.classList.add('fs'); document.body.classList.add('fs-open');
    drawer.append(narrEl, codeEl); stageEl.append(factsEl);
    paintNotes(); paintCode();
    try { if (stageEl.requestFullscreen) { await stageEl.requestFullscreen({ navigationUI: 'hide' }); realFs = true; } } catch { realFs = false; }
    stageEl.focus({ preventScroll: true });
  }
  function exitFs() {
    if (!fsOn) return;
    fsOn = false;
    stageEl.classList.remove('fs', 'notes'); document.body.classList.remove('fs-open');
    workEl.append(codeEl); body.insertBefore(factsEl, workEl);
    placeRail(); paintCode();
    if (realFs && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    realFs = false;
  }
  const toggleFs = () => (fsOn ? exitFs() : enterFs());
  $('.svgwrap').addEventListener('dblclick', (ev) => { ev.preventDefault(); toggleFs(); });
  $('.svgwrap').title = 'Double-click for full screen';
  const onFsChange = () => { if (fsOn && realFs && !document.fullscreenElement) { realFs = false; exitFs(); } };
  document.addEventListener('fullscreenchange', onFsChange);
  body.querySelector('.fsbtn').onclick = enterFs;
  stageEl.querySelector('.fs-exit').onclick = exitFs;
  stageEl.querySelector('.fs-notes').onclick = () => { notesOn = !notesOn; store.set('fsNotes', notesOn); paintNotes(); };
  $('.ctog').onclick = () => { showCode = !showCode; store.set('code', showCode); paintCode(); };
  function paintCode() {
    const has = !!L.steps[i].code;
    $('.work').classList.toggle('hascode', has && showCode);
    $('.codep').hidden = fsOn ? !has : !(has && showCode);
    $('.ctog').disabled = !has;
    $('.ctog').classList.toggle('green', has && showCode);
  }

  function show(k, push = true) {
    i = Math.min(Math.max(0, k), N - 1);
    const s = L.steps[i];
    seen.add(i);
    ctx.save({ seen: [...seen], max: Math.max(ctx.progress.max ?? -1, i), done: ctx.progress.done || seen.size === N });
    ctx.progress = { ...ctx.progress, seen: [...seen] };
    scene.set(s.scene || {});
    $('.svgwrap').scrollLeft = 0;
    stepBtns.forEach((b, k2) => { b.classList.toggle('on', k2 === i); b.classList.toggle('seen', seen.has(k2) && k2 !== i); });
    const sp = $('.stepper'), btn = stepBtns[i];
    sp.scrollTo({ left: btn.offsetLeft - sp.clientWidth / 2 + btn.clientWidth / 2, behavior: 'smooth' });
    $('.pos').textContent = `Step ${i + 1} of ${N}`;
    stageEl.querySelector('.fs-pos').textContent = `${i + 1} / ${N}`;
    stageEl.querySelector('.fs-title').textContent = s.title;
    stageEl.querySelector('.fs-dots').innerHTML = L.steps.map((_, k2) => `<i class="${k2 === i ? 'on' : seen.has(k2) ? 'seen' : ''}" data-k="${k2}" title="Step ${k2 + 1}"></i>`).join('');
    stageEl.querySelectorAll('.fs-dots i').forEach((d) => (d.onclick = () => { stop(); show(+d.dataset.k); }));
    $('.legend').innerHTML = (s.legend || []).map((x) => { const [t, c] = String(x).split('|'); return `<span style="--lc:${c || 'var(--muted2)'}">${esc(t)}</span>`; }).join('');
    $('.legend').hidden = !s.legend;
    stageEl.classList.toggle('hasfacts', !!(s.facts && s.facts.length));
    stageEl.classList.toggle('haslegend', !!s.legend);
    const facts = s.facts || [];
    $('.facts').innerHTML = facts.map(([k2, v]) => `<div class="${prevFacts[k2] !== undefined && prevFacts[k2] !== v ? 'chg' : ''}"><small>${esc(k2)}</small><b>${esc(v)}</b></div>`).join('');
    prevFacts = Object.fromEntries(facts);
    $('.stagebar').hidden = !facts.length;
    $('.narr').innerHTML = `
      <div class="st">STEP ${i + 1} / ${N} ${s.tag ? `<span class="tag ${s.tag}">${s.tag}</span>` : ''}</div>
      <h2>${esc(s.title)}</h2>
      ${s.simple ? `<div class="simple"><div><b class="k">In plain words</b>${fmt(s.simple[0])}</div>${s.simple[1] ? `<div><b class="k">Real example</b>${fmt(s.simple[1])}</div>` : ''}</div>` : ''}
      ${(Array.isArray(s.body) ? s.body : [s.body]).filter(Boolean).map((p) => (/^\s*<(ul|ol|table|div)/.test(p) ? fmt(p) : `<p>${fmt(p)}</p>`)).join('')}
      ${s.callout ? `<div class="callout ${s.callout.kind || 'insight'}"><div><b class="k">${esc(s.callout.title || { tip: 'Good to know', warn: 'Watch out', insight: 'Key insight', bad: 'Common mistake' }[s.callout.kind || 'insight'])}</b>${fmt(s.callout.text)}</div></div>` : ''}
      ${s.vars ? `<div class="vars"><div class="h">${esc(s.varsTitle || 'What changed')}</div>${Object.entries(s.vars).map(([k2, v]) => `<div class="li"><span><b>${esc(k2)}:</b> ${fmt(String(v))}</span></div>`).join('')}</div>` : ''}
      ${s.interview ? `<div class="iv"><b class="k">Interview angle</b>${fmt(s.interview)}</div>` : ''}`;
    $('.narr').scrollTop = 0;
    const cp = $('.codep');
    if (s.code) {
      const hl = expand(s.code.hl);
      const lines = highlight(s.code.src.replace(/^\n/, ''), s.code.lang || 'js');
      cp.innerHTML = `<div class="ch"><span class="dots"><i></i><i></i><i></i></span><span>${esc(s.code.file || '')}</span><span class="lang">${esc(s.code.lang || 'js')}</span><button class="cp">Copy</button></div>
        <pre>${lines.map((ln, k2) => `<span class="ln${hl.has(k2 + 1) ? ' hl' : hl.size && s.code.focus ? ' dimln' : ''}">${ln || ' '}</span>`).join('')}</pre>
        ${s.code.note ? `<div class="note">${fmt(s.code.note)}</div>` : ''}`;
      cp.querySelector('.cp').onclick = async (ev) => {
        try { await navigator.clipboard.writeText(s.code.src.replace(/^\n/, '')); ev.target.textContent = 'Copied'; } catch { ev.target.textContent = 'Select & copy'; }
        setTimeout(() => (ev.target.textContent = 'Copy'), 1400);
      };
    }
    paintCode();
    if (s.code) {
      const first = cp.querySelector('.ln.hl');
      if (first) { const pre = cp.querySelector('pre'); requestAnimationFrame(() => (pre.scrollTop = Math.max(0, first.offsetTop - pre.clientHeight / 3))); }
    }
    $('.prev').disabled = i === 0;
    let label;
    if (i < N - 1) label = `Next: ${L.steps[i + 1].short || L.steps[i + 1].title}`;
    else if (L.scenarios) label = `Scenario lab: ${L.scenarios.length} problems`;
    else if (L.quiz) label = `Quiz: ${L.quiz.length} questions`;
    else if (ctx.next) label = `Next lesson: ${ctx.next.title}`;
    else label = `Back to ${ctx.tab.title}`;
    $('.next').innerHTML = `<span>${esc(label)}</span><span>→</span>`;
    stageEl.querySelector('.fs-next').innerHTML = `<span>${esc(i < N - 1 ? label : 'Finish lesson')}</span><span>→</span>`;
    stageEl.querySelector('.fs-prev').disabled = i === 0;
    if (push) ctx.setHash(i === 0 ? L.id : `${L.id}-s${i + 1}`);
    if (playing) schedule();
  }
  function next() {
    if (i < N - 1) return show(i + 1);
    stop(); exitFs();
    location.hash = L.scenarios ? `${L.id}-scenarios` : L.quiz ? `${L.id}-quiz` : ctx.next ? ctx.next.id : ctx.tab.id;
  }
  function schedule() {
    clearTimeout(timer);
    const s = L.steps[i];
    const words = (Array.isArray(s.body) ? s.body.join(' ') : s.body || '').split(/\s+/).length + (s.callout ? 25 : 0);
    timer = setTimeout(() => (i < N - 1 ? show(i + 1) : stop()), Math.min(16000, 3500 + words * 230));
  }
  function stop() { playing = false; clearTimeout(timer); setText('.play, .fs-play', '▶'); }
  const togglePlay = () => { playing = !playing; setText('.play, .fs-play', playing ? '❚❚' : '▶'); playing ? schedule() : stop(); };
  $$('.play, .fs-play').forEach((b) => (b.onclick = togglePlay));
  $$('.prev, .fs-prev').forEach((b) => (b.onclick = () => { stop(); show(i - 1); }));
  $$('.next, .fs-next').forEach((b) => (b.onclick = () => { stop(); next(); }));
  stepBtns.forEach((b) => (b.onclick = () => { stop(); show(+b.dataset.k); }));
  const onKey = (ev) => {
    if (ev.target.closest('input,textarea') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === 'ArrowRight') { stop(); next(); }
    else if (ev.key === 'ArrowLeft') { stop(); show(i - 1); }
    else if (ev.key === ' ' && !ev.target.closest('a')) { ev.preventDefault(); togglePlay(); }
    else if (ev.key === 'f' || ev.key === 'F') { ev.preventDefault(); toggleFs(); }
    else if (ev.key === 'Escape' && fsOn) { ev.preventDefault(); exitFs(); }
    else if (ev.key === 'r' || ev.key === 'R') replay();
    else if (ev.key === 'p' || ev.key === 'P') togglePause();
    else if (ev.key === 's' || ev.key === 'S') cycleSpeed();
    else if ((ev.key === 'n' || ev.key === 'N') && fsOn) stageEl.querySelector('.fs-notes').click();
  };
  addEventListener('keydown', onKey);
  let sx = null;
  $('.stage').addEventListener('touchstart', (ev) => (sx = ev.touches[0].clientX), { passive: true });
  $('.stage').addEventListener('touchend', (ev) => { if (sx == null) return; const d = ev.changedTouches[0].clientX - sx; if (Math.abs(d) > 60 && $('.svgwrap').scrollWidth <= $('.svgwrap').clientWidth) { stop(); d < 0 ? next() : show(i - 1); } sx = null; });
  show(i, false);
  return () => { ro.disconnect(); stop(); exitFs(); scene.destroy(); removeEventListener('keydown', onKey); mq.removeEventListener('change', placeRail); document.removeEventListener('fullscreenchange', onFsChange); };
}

function expand(hl) {
  const s = new Set();
  for (const x of hl || []) {
    if (typeof x === 'number') s.add(x);
    else { const [a, b] = String(x).split('-').map(Number); for (let k = a; k <= (b || a); k++) s.add(k); }
  }
  return s;
}

// ---------------------------------------------------------------- scenario lab
// One problem at a time: read the situation → commit to a diagnosis → see timeline, root cause, fix → answer the twist.
function scenarioLab(body, rail, L, ctx) {
  const S = L.scenarios;
  const results = { ...(ctx.progress.scen || {}) };   // index → chosen option
  let k = 0;
  body.classList.add('lab');
  const solved = () => Object.entries(results).filter(([i2, v]) => S[i2] && (S[i2].o ? v === S[i2].a : v === 'seen')).length;
  const st = (j) => (results[j] == null ? '' : !S[j].o || results[j] === S[j].a ? 'ok' : 'x');
  function paintRail() {
    rail.innerHTML = `
      <div class="sheet learnbox"><div class="h">Your score</div>
        <div class="bigscore">${solved()} <small>/ ${S.length} diagnosed correctly</small></div>
        <div class="dots5">${S.map((s, j) => `<i class="${st(j)}${j === k ? ' cur' : ''}"></i>`).join('')}</div></div>
      <div class="sheet learnbox"><div class="h">How seniors attack a problem</div>
        ${['Restate the symptom precisely — who, what, when, how often', 'Ask what changed (deploy, traffic, data, config)', 'Form 2–3 hypotheses before touching anything', 'Pick the cheapest test that rules one out', 'Fix the root cause, not the symptom', 'Prevent it: test, alert, or guardrail'].map((t, j) => `<div class="li on"><span><b>${j + 1}.</b> ${t}</span></div>`).join('')}</div>
      ${practiceBox(L, ctx, VIEWS.filter(([, , h]) => h(L)), 'scenarios')}`;
  }
  function draw() {
    const s = S[k];
    const chosen = results[k];
    const answered = chosen != null && s.o;
    body.innerHTML = `
      <div class="labbar">${S.map((x, j) => `<button class="chip${j === k ? ' on' : ''} ${st(j)}" data-j="${j}" title="${esc(x.title.replace(/`/g, ''))}">${j + 1}</button>`).join('')}
        <span class="labpos">Scenario ${k + 1} of ${S.length}</span></div>
      <div class="labgrid">
        <section class="sheet labcase">
          <div class="labmeta">${s.kind ? `<span class="tag scenario">${esc(s.kind)}</span>` : ''} ${lvBadge(s.lvl)}</div>
          <h2>${fmt(s.title)}</h2>
          <p class="sit">${fmt(s.sit)}</p>
          ${s.evidence ? `<div class="evid"><div class="eh">${esc(s.evidence.label || 'Evidence')}</div><pre>${highlight(s.evidence.src.replace(/^\n/, ''), s.evidence.lang || 'text').join('\n')}</pre></div>` : ''}
          ${s.o ? `<div class="ask">${fmt(s.ask || 'What is the most likely explanation?')}</div>
            <div class="opts">${s.o.map((o, j) => `<button data-o="${j}" class="${answered ? (j === s.a ? 'right' : j === chosen ? 'wrong' : 'off') : ''}"${answered ? ' disabled' : ''}><span class="ol">${'ABCD'[j]}</span>${fmt(o)}</button>`).join('')}</div>`
          : `<div class="ask">Think it through first: what happens, and why?</div><button class="pbtn green reveal">Show what happens</button>`}
        </section>
        <section class="sheet labans${answered || (!s.o && chosen === 'seen') ? '' : ' locked'}">
          ${answered || (!s.o && chosen === 'seen') ? `
            ${s.o ? `<div class="verdict ${chosen === s.a ? 'ok' : 'x'}">${chosen === s.a ? '✅ Correct diagnosis.' : `❌ Not quite — it’s <b>${'ABCD'[s.a]}</b>.`}</div><p>${fmt(s.why || '')}</p>` : ''}
            <div class="h">What actually happens</div>
            <div class="tl">${s.steps.map(([c, t]) => `<div class="ev ${c}"><p>${fmt(t)}</p></div>`).join('')}</div>
            ${s.fix && s.fix !== '—' ? `<div class="callout tip"><div><b class="k">Fix / best practice</b>${fmt(s.fix)}</div></div>` : ''}
            ${s.twist ? `<details class="twist"><summary><b>Twist:</b> ${fmt(s.twist.q)}</summary><p>${fmt(s.twist.a)}</p></details>` : ''}`
          : `<div class="lockmsg"><div class="lk">?</div><b>Make your call first.</b><span>Committing to a diagnosis before seeing the answer is what builds problem-solving instinct. The timeline, root cause, fix and a follow-up twist unlock here.</span></div>`}
        </section>
      </div>
      <div class="labnav"><button class="pbtn lp"${k === 0 ? ' disabled' : ''}>← Previous</button><button class="pbtn green ln2">${k < S.length - 1 ? 'Next scenario →' : L.quiz ? 'Take the quiz →' : 'Done →'}</button></div>`;
    body.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { k = +b.dataset.j; draw(); }));
    body.querySelectorAll('.opts button').forEach((b) => (b.onclick = () => { results[k] = +b.dataset.o; ctx.save({ scen: results }); draw(); }));
    const rv = body.querySelector('.reveal'); if (rv) rv.onclick = () => { results[k] = 'seen'; ctx.save({ scen: results }); draw(); };
    body.querySelector('.lp').onclick = () => { if (k > 0) { k--; draw(); } };
    body.querySelector('.ln2').onclick = () => { if (k < S.length - 1) { k++; draw(); } else location.hash = L.quiz ? `${L.id}-quiz` : ctx.next ? ctx.next.id : ctx.tab.id; };
    body.scrollTop = 0;
    paintRail();
  }
  const onKey = (ev) => {
    if (ev.target.closest('input,textarea') || ev.metaKey || ev.ctrlKey) return;
    if (ev.key === 'ArrowRight' && k < S.length - 1) { k++; draw(); }
    else if (ev.key === 'ArrowLeft' && k > 0) { k--; draw(); }
    else if (/^[a-d1-4]$/i.test(ev.key) && S[k].o && results[k] == null) { const j = isNaN(+ev.key) ? 'abcd'.indexOf(ev.key.toLowerCase()) : +ev.key - 1; if (j < S[k].o.length) { results[k] = j; ctx.save({ scen: results }); draw(); } }
  };
  addEventListener('keydown', onKey);
  draw();
  return () => removeEventListener('keydown', onKey);
}

// ---------------------------------------------------------------- quiz (one question at a time)
function quiz(body, rail, L, ctx) {
  const Q = L.quiz, ans = {};
  let k = 0;
  body.classList.add('lab');
  const score = () => Object.entries(ans).filter(([i2, v]) => v === Q[i2].a).length;
  function draw() {
    const q = Q[k], chosen = ans[k], done = chosen != null;
    body.innerHTML = `
      <div class="labbar">${Q.map((x, j) => `<button class="chip${j === k ? ' on' : ''}${ans[j] == null ? '' : ans[j] === x.a ? ' ok' : ' x'}" data-j="${j}">${j + 1}</button>`).join('')}<span class="labpos">Question ${k + 1} of ${Q.length}</span></div>
      <section class="sheet labcase quizcase">
        <h2>${fmt(q.q)}</h2>
        <div class="opts">${q.o.map((o, j) => `<button data-o="${j}" class="${done ? (j === q.a ? 'right' : j === chosen ? 'wrong' : 'off') : ''}"${done ? ' disabled' : ''}><span class="ol">${'ABCD'[j]}</span>${fmt(o)}</button>`).join('')}</div>
        ${done ? `<div class="verdict ${chosen === q.a ? 'ok' : 'x'}">${chosen === q.a ? '✅ Correct.' : '❌ Not quite.'}</div><p>${fmt(q.why)}</p>` : ''}
      </section>
      <div class="labnav"><button class="pbtn lp"${k === 0 ? ' disabled' : ''}>← Previous</button><button class="pbtn green ln2">${k < Q.length - 1 ? 'Next question →' : ctx.next ? `Next lesson: ${esc(ctx.next.title)} →` : 'Done →'}</button></div>`;
    body.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { k = +b.dataset.j; draw(); }));
    body.querySelectorAll('.opts button').forEach((b) => (b.onclick = () => {
      ans[k] = +b.dataset.o;
      if (Object.keys(ans).length === Q.length) ctx.save({ quiz: Math.max(score(), ctx.progress.quiz || 0) });
      draw();
    }));
    body.querySelector('.lp').onclick = () => { if (k > 0) { k--; draw(); } };
    body.querySelector('.ln2').onclick = () => { if (k < Q.length - 1) { k++; draw(); } else location.hash = ctx.next ? ctx.next.id : ctx.tab.id; };
    rail.innerHTML = `<div class="sheet learnbox"><div class="h">Score</div><div class="bigscore">${score()} <small>/ ${Q.length}</small></div>
      <div class="dots5">${Q.map((x, j) => `<i class="${ans[j] == null ? '' : ans[j] === x.a ? 'ok' : 'x'}${j === k ? ' cur' : ''}"></i>`).join('')}</div>
      ${ctx.progress.quiz != null ? `<small style="color:var(--muted)">Best so far: ${ctx.progress.quiz} / ${Q.length}</small>` : ''}</div>` + learnBox(L, ctx) + practiceBox(L, ctx, VIEWS.filter(([, , h]) => h(L)), 'quiz');
  }
  const onKey = (ev) => {
    if (ev.target.closest('input,textarea') || ev.metaKey || ev.ctrlKey) return;
    if (ev.key === 'ArrowRight' && k < Q.length - 1) { k++; draw(); }
    else if (ev.key === 'ArrowLeft' && k > 0) { k--; draw(); }
    else if (/^[a-d1-4]$/i.test(ev.key) && ans[k] == null) { const j = isNaN(+ev.key) ? 'abcd'.indexOf(ev.key.toLowerCase()) : +ev.key - 1; if (j < Q[k].o.length) { ans[k] = j; draw(); } }
  };
  addEventListener('keydown', onKey);
  draw();
  return () => removeEventListener('keydown', onKey);
}

// ---------------------------------------------------------------- reference views
function interview(root, L) {
  root.innerHTML = `<p class="vintro">Answer out loud first, then open the card. Each answer gives the <b>what</b>, the <b>why</b> (the reasoning interviewers listen for) and likely follow-ups.</p>` +
    L.interview.map((q, k) => `<details class="qa"${k === 0 ? ' open' : ''}><summary><span>${fmt(q.q)}</span><span class="lvl">${lvBadge(q.lvl)}</span></summary>
      <div class="body">${(Array.isArray(q.a) ? q.a : [q.a]).map((p) => `<p>${fmt(p)}</p>`).join('')}
      ${q.why ? `<div class="why"><b>Why interviewers ask:</b> ${fmt(q.why)}</div>` : ''}
      ${q.follow ? `<div class="fu"><b>Likely follow-ups:</b> ${q.follow.map(fmt).join(' · ')}</div>` : ''}</div></details>`).join('');
  // accordion: opening one closes the others, so the panel stays short
  root.querySelectorAll('details.qa').forEach((d) => d.addEventListener('toggle', () => { if (d.open) root.querySelectorAll('details.qa').forEach((o) => o !== d && (o.open = false)); }));
}

function history(root, L) {
  const H = L.history;
  root.innerHTML = `<div class="hgrid">
    <div class="prose"><h3>How we got here — who, when, why</h3>${H.intro ? `<p class="vintro">${fmt(H.intro)}</p>` : ''}<div class="tl">${H.timeline.map((t) => `<div class="ev ${t.c || ''}"><div class="yr">${esc(t.yr)}</div><h4>${fmt(t.title)}</h4><p>${fmt(t.text)}</p></div>`).join('')}</div></div>
    ${H.alts ? `<div class="prose"><h3>Current alternatives — when to pick which</h3><div class="tblw"><table class="t"><tr>${H.alts.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${H.alts.rows.map((r) => `<tr>${r.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</table></div></div>` : ''}</div>`;
}

function cheat(root, L) { root.innerHTML = `<div class="prose cheatp">${fmt(L.cheat)}</div>`; }
