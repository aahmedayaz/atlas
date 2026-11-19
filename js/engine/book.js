// Magic Book — a book-style modal that teaches a lesson's theory from zero to advanced.
// Book data lives in js/books/<lesson-id>.js and is loaded only when the book is opened.
// Shape: { title, intro, chapters: [{ level: 1|2|3, title, text: [para…], words: [[term, plain meaning]…],
//          example: 'real-life story', remember: 'one-line takeaway', check: [question, answer] }] }
import { esc, fmt as baseFmt } from './text.js';

// book text also understands **bold** and *italic*
const fmt = (s) => baseFmt(String(s ?? '')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*\w`])\*([^*\s`][^*`]*?)\*(?![*\w])/g, '$1<i>$2</i>'));

const LEVELS = { 1: ['Basic', 'lv1'], 2: ['Core', 'lv2'], 3: ['Advanced', 'lv3'] };
const store = {
  get(k, d) { try { const v = localStorage.getItem('atlas:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('atlas:' + k, JSON.stringify(v)); } catch {} },
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let openEl = null;

export const hasBook = (L) => !!L.book;

export async function openBook(L) {
  if (openEl) return;
  let B;
  try { B = (await import(`../books/${L.id}.js`)).default; } catch (err) { console.error(err); return; }
  const host = document.fullscreenElement || document.body;
  const el = document.createElement('div');
  el.className = 'bookwrap';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Magic Book: ${B.title}`);
  host.appendChild(el); openEl = el;
  const prevFocus = document.activeElement;
  const N = B.chapters.length;               // spreads: 0 = cover + contents, 1..N = chapters
  let at = Math.min(store.get('book:' + L.id, 0), N);
  let size = store.get('bookSize', 0);
  const done = new Set(store.get('bookDone:' + L.id, []));

  el.innerHTML = `
    <div class="book" style="--bk-size:${size}">
      <header class="bk-top">
        <span class="bk-mark">📖 Magic Book</span>
        <b class="bk-title">${esc(B.title)}</b>
        <span class="bk-tools">
          <button class="pbtn sm bk-toc" title="Contents">☰ Contents</button>
          <button class="pbtn sm bk-a" data-d="-1" title="Smaller text" aria-label="Smaller text">A−</button>
          <button class="pbtn sm bk-a" data-d="1" title="Bigger text" aria-label="Bigger text">A+</button>
          <button class="pbtn sm bk-x" title="Close (Esc)" aria-label="Close the book">✕</button>
        </span>
      </header>
      <div class="bk-spread"><article class="pg left"></article><div class="bk-spine"></div><article class="pg right"></article></div>
      <footer class="bk-bot">
        <button class="pbtn bk-prev">← Previous</button>
        <div class="bk-track"></div>
        <button class="pbtn green bk-next">Next page →</button>
      </footer>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const left = $('.pg.left'), right = $('.pg.right'), track = $('.bk-track');

  const lvl = (c) => LEVELS[c.level] || LEVELS[1];
  const cover = () => {
    left.innerHTML = `
      <div class="bk-cover">
        <div class="bk-kicker">Lesson ${esc(L.title)}</div>
        <h2>${esc(B.title)}</h2>
        <p class="bk-intro">${fmt(B.intro)}</p>
        <div class="bk-how">
          <div class="h">How to read this book</div>
          <p>Every chapter is one idea. The <b>left page</b> explains it in plain words. The <b>right page</b> explains every new word, shows it in real life, and asks you one question.</p>
          <p class="bk-lvls">${Object.values(LEVELS).map(([n, c]) => `<span class="bk-lv ${c}">${n}</span>`).join(' → ')}</p>
          <p class="mut">Read in order the first time: each chapter only uses words you have already met. Keys: ← → turn pages · Esc closes.</p>
        </div>
      </div>`;
    right.innerHTML = `
      <div class="h bk-h">Contents</div>
      <ol class="bk-contents">${B.chapters.map((c, k) => `
        <li><button data-go="${k + 1}" class="${done.has(k + 1) ? 'done' : ''}">
          <span class="num">${k + 1}</span><span class="t">${esc(c.title)}</span><span class="bk-lv ${lvl(c)[1]}">${lvl(c)[0]}</span>${done.has(k + 1) ? '<span class="tick" aria-label="read">✓</span>' : ''}
        </button></li>`).join('')}</ol>
      <div class="bk-start"><button class="pbtn green" data-go="${Math.min(N, Math.max(1, ...[...done].map((d) => d + 1).filter((d) => d <= N), 1))}">${done.size ? 'Continue reading →' : 'Start at chapter 1 →'}</button></div>`;
  };
  const chapter = (i) => {
    const c = B.chapters[i - 1];
    const [lname, lcls] = lvl(c);
    left.innerHTML = `
      <div class="bk-meta"><span class="bk-lv ${lcls}">${lname}</span><span>Chapter ${i} of ${N}</span></div>
      <h2 class="bk-ch">${esc(c.title)}</h2>
      ${(c.text || []).map((p) => `<p>${fmt(p)}</p>`).join('')}
      ${c.example ? `<section class="bk-box life"><div class="h">🌍 In real life</div><p>${fmt(c.example)}</p></section>` : ''}
      <div class="bk-pno">${i * 2 - 1}</div>`;
    right.innerHTML = `
      ${c.words?.length ? `<section class="bk-box words"><div class="h">📝 New words on this page</div><dl>${c.words.map(([t, d]) => `<div><dt>${fmt(t)}</dt><dd>${fmt(d)}</dd></div>`).join('')}</dl></section>` : ''}
      ${c.remember ? `<section class="bk-box remember"><div class="h">🧠 Remember</div><p>${fmt(c.remember)}</p></section>` : ''}
      ${c.check ? `<section class="bk-box check"><div class="h">❓ Check yourself</div><p>${fmt(c.check[0])}</p>
        <button class="pbtn sm bk-reveal">Show answer</button><p class="bk-ans" hidden>${fmt(c.check[1])}</p></section>` : ''}
      <div class="bk-pno">${i * 2}</div>`;
    done.add(i); store.set('bookDone:' + L.id, [...done]);
  };
  const paint = () => {
    (at ? chapter(at) : cover());
    left.scrollTop = 0; right.scrollTop = 0; $('.bk-spread').scrollTop = 0;
    $('.bk-prev').disabled = at === 0;
    $('.bk-next').textContent = at === 0 ? 'Chapter 1 →' : at === N ? 'Back to contents ↺' : 'Next page →';
    track.innerHTML = `<button class="dot ${at === 0 ? 'on' : ''}" data-go="0" title="Contents" aria-label="Contents">☰</button>` +
      B.chapters.map((c, k) => `<button class="dot ${lvl(c)[1]} ${at === k + 1 ? 'on' : ''} ${done.has(k + 1) ? 'seen' : ''}" data-go="${k + 1}" title="${esc(c.title)}" aria-label="Chapter ${k + 1}: ${esc(c.title)}"></button>`).join('');
    store.set('book:' + L.id, at);
    requestAnimationFrame(markMore);
  };
  // a page that is longer than the book shows a "scroll for more" hint at its bottom edge
  const markMore = () => { for (const p of [left, right]) p.classList.toggle('more', p.scrollHeight - p.scrollTop - p.clientHeight > 6); };
  left.addEventListener('scroll', markMore, { passive: true }); right.addEventListener('scroll', markMore, { passive: true });
  addEventListener('resize', markMore);

  let busy = false;
  const go = (to) => {
    to = (to + N + 1) % (N + 1);
    if (to === at || busy) return;
    const fwd = to > at;
    if (reduced()) { at = to; paint(); return; }
    busy = true;
    const spread = $('.bk-spread');
    const leaf = document.createElement('div');
    leaf.className = 'bk-leaf ' + (fwd ? 'fwd' : 'back');
    spread.appendChild(leaf);
    spread.classList.add('turning');
    setTimeout(() => { at = to; paint(); }, 230);
    setTimeout(() => { leaf.remove(); spread.classList.remove('turning'); busy = false; }, 480);
  };

  el.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t === el) return close();
    const g = t.closest('[data-go]'); if (g) return go(+g.dataset.go);
    if (t.closest('.bk-x')) return close();
    if (t.closest('.bk-toc')) return go(0);
    if (t.closest('.bk-prev')) return go(at - 1);
    if (t.closest('.bk-next')) return go(at + 1);
    const a = t.closest('.bk-a');
    if (a) { size = Math.max(-2, Math.min(4, size + +a.dataset.d)); $('.book').style.setProperty('--bk-size', size); store.set('bookSize', size); return; }
    const r = t.closest('.bk-reveal');
    if (r) { r.hidden = true; r.nextElementSibling.hidden = false; }
  });
  // swipe between pages on touch screens
  let sx = null;
  el.addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (ev) => { if (sx == null) return; const dx = ev.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 70) go(at + (dx < 0 ? 1 : -1)); });

  // the book owns the keyboard while open (the lesson player underneath must not step)
  const onKey = (ev) => {
    if (ev.key === 'Tab') return trap(ev);
    ev.stopImmediatePropagation();              // nothing underneath (player, search shortcut) reacts while the book is open
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const act = { Escape: close, ArrowRight: () => go(at + 1), PageDown: () => go(at + 1), ArrowLeft: () => go(at - 1), PageUp: () => go(at - 1), Home: () => go(0) }[ev.key];
    if (act) { ev.preventDefault(); act(); }
  };
  const trap = (ev) => {
    ev.stopImmediatePropagation();
    const f = [...el.querySelectorAll('button:not([disabled]):not([hidden]), a[href]')].filter((b) => b.offsetParent);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
  };
  addEventListener('keydown', onKey, true);
  const onHash = () => close();
  addEventListener('hashchange', onHash);
  document.body.classList.add('book-open');

  function close() {
    removeEventListener('keydown', onKey, true);
    removeEventListener('hashchange', onHash);
    removeEventListener('resize', markMore);
    document.body.classList.remove('book-open');
    el.classList.add('closing');
    setTimeout(() => el.remove(), reduced() ? 0 : 180);
    openEl = null;
    prevFocus?.focus?.();
  }
  paint();
  requestAnimationFrame(() => { el.classList.add('in'); $('.bk-next').focus(); });
  return close;
}
