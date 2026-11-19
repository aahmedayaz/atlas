import { n, e, f, z, merge, tree, patch, dimExcept } from '../../engine/build.js';

// ---- reusable scene pieces ----
const procs = (hot) => ({
  zones: [z('bp', 30, 60, 250, 360, 'Browser process', 'browser'), z('rp', 310, 60, 400, 360, 'Renderer process · per site', 'react'), z('gp', 740, 60, 230, 360, 'GPU process', 'gpu')],
  nodes: [
    n('ui', 155, 130, 'Tabs & address bar', { kind: 'browser', sub: 'UI thread' }),
    n('net', 155, 230, 'Network stack', { kind: 'net', sub: 'DNS · TLS · HTTP', state: hot === 'net' ? 'active' : '' }),
    n('disk', 155, 330, 'HTTP disk cache', { kind: 'cache', sub: 'saved files' }),
    n('main', 510, 150, 'Main thread', { kind: 'cpu', sub: 'Blink (DOM, CSS, layout) + V8 (JS)', w: 300, state: hot === 'main' ? 'active' : '' }),
    n('comp', 510, 270, 'Compositor thread', { kind: 'layers', sub: 'layers · scrolling · frames', w: 300, state: hot === 'comp' ? 'active' : '' }),
    n('rast', 510, 360, 'Raster workers', { kind: 'paint', sub: 'paint commands → pixels', w: 300 }),
    n('gpu', 855, 200, 'GPU process', { kind: 'gpu', sub: 'draws frames', state: hot === 'gpu' ? 'active' : '' }),
    n('screen', 855, 320, 'Screen', { kind: 'eye', sub: 'refresh every 16.7 ms' }),
  ],
  edges: [e('net', 'main', 'HTML bytes (IPC)'), e('main', 'comp', 'commit layer tree'), e('comp', 'gpu', 'compositor frame'), e('gpu', 'screen', 'vsync')],
});

const domTree = (states = {}) => tree({ id: 'html', label: 'html', kids: [
  { id: 'head', label: 'head', kids: [{ id: 'link', label: 'link css' }] },
  { id: 'body', label: 'body', kids: [{ id: 'h1', label: 'h1', sub: '"Cart"' }, { id: 'p', label: 'p.note', sub: 'display:none' }, { id: 'btn', label: 'button', sub: '"Pay"' }] },
] }, { x: 690, y: 110, dx: 118, dy: 88, w: 104, h: 46, prefix: 'd-' });

const withStates = (t, m) => ({ ...t, nodes: patch(t.nodes, m) });

const lane = (id, y, label, stages, cost) => {
  const all = ['JS', 'Style', 'Layout', 'Paint', 'Composite'];
  const nodes = [n(id, 120, y, label, { kind: 'code', mono: true, icon: false, w: 190 })];
  all.forEach((s, k) => nodes.push(n(`${id}-${s}`, 300 + k * 135, y, s, { kind: s === 'Composite' ? 'gpu' : s === 'JS' ? 'js' : 'paint', icon: false, w: 112, state: stages.includes(s) ? 'active' : 'dim' })));
  nodes.push(n(`${id}-cost`, 930, y, cost, { kind: 'note', icon: false, w: 90 }));
  return nodes;
};

export default {
  id: 'browser-pipeline',
  title: 'From HTML bytes to pixels',
  level: 'Beginner',
  minutes: 22,
  tags: ['Browser', 'Performance'],
  summary: 'What really happens inside Chrome after the HTML arrives: processes and threads, DOM, CSSOM, style, layout, paint, layers and compositing — and what each kind of change costs.',
  learn: ['Which process and thread does each job', 'Why CSS and some scripts block the first paint', 'DOM + CSSOM → render tree → layout → paint → composite', 'Why `transform` is cheap and `width` is not', 'How to spot and fix layout thrashing'],
  steps: [
    {
      short: 'Processes', title: 'A browser is several programs, not one', tag: 'concept',
      scene: merge(procs(), { flows: [f('net>main', 'HTML', { kind: 'browser', every: 2.6 }), f('main>comp', 'layers', { kind: 'react', every: 2.6, delay: 0.9 }), f('comp>gpu', 'frame', { kind: 'gpu', every: 2.6, delay: 1.6 })] }),
      body: [
        'Chrome splits itself into separate operating-system processes. The [[browser-process]] owns the tabs, the address bar and the network. Each site gets its own sandboxed [[renderer-process]], and a [[gpu-process]] draws to the screen.',
        'Inside the renderer, the [[main-thread]] does almost everything you care about as a web developer: it runs [[blink]] (HTML, CSS, layout, paint) and [[v8]] (your JavaScript). The [[compositor-thread]] turns finished layers into frames, which is why a page can still scroll while JavaScript is busy.',
      ],
      callout: { kind: 'insight', text: 'One thread runs both your JavaScript and the page’s layout and paint. Every long JS task is time the browser cannot spend drawing — this one fact explains most front-end performance advice.' },
      interview: '“Why doesn’t one crashed tab take down the whole browser?” → each site runs in its own renderer process (site isolation). A crash or exploit stays inside that sandbox.',
    },
    {
      short: 'Parse → DOM', title: 'The browser — not JavaScript — builds the DOM', tag: 'concept',
      scene: merge(
        { nodes: [n('bytes', 110, 130, 'Network bytes', { kind: 'net', sub: '3C 21 64 6F 63…', mono: true }), n('tok', 110, 250, 'Tokenizer', { kind: 'code', sub: 'StartTag:h1 · Text · EndTag' }), n('tb', 110, 370, 'Tree builder', { kind: 'dom', sub: 'creates nodes', state: 'active' })],
          edges: [e('bytes', 'tok', 'decode UTF-8'), e('tok', 'tb', 'tokens'), e('tb', 'd-html', 'append', { bend: -40 })],
          flows: [f('bytes>tok', '<h1>', { kind: 'browser', every: 1.4 }), f('tok>tb', 'StartTag', { kind: 'code', every: 1.4, delay: 0.7 })] },
        domTree(),
      ),
      body: [
        'HTML arrives as raw bytes. Blink decodes them, a tokenizer cuts them into tokens (start tag, text, end tag), and a tree builder turns tokens into DOM nodes. The result is the [[dom]]: a tree of C++ objects inside the rendering engine.',
        'Parsing is <b>incremental</b>: the browser starts building the DOM as soon as the first bytes arrive, without waiting for the whole file. A page with zero JavaScript still gets a DOM — JavaScript only reads and changes it later through the `document` API.',
      ],
      code: { file: 'cart.html', lang: 'html', src: `
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/app.css">
  </head>
  <body>
    <h1>Cart</h1>
    <p class="note">Free shipping over $50</p>
    <button>Pay</button>
  </body>
</html>`, hl: [6, 7, 8, 9] },
      callout: { kind: 'tip', text: 'A <b>preload scanner</b> runs ahead of the parser looking for `<link>`, `<script>` and `<img>` URLs, so downloads start early even while the main parser is paused.' },
      interview: 'Common trap: “JavaScript creates the DOM.” Correct answer: the browser’s rendering engine creates it from HTML; JS gets wrapper objects that point at the C++ nodes.',
    },
    {
      short: 'Blocking scripts', title: 'A classic <script> stops the parser', tag: 'concept',
      scene: {
        h: 470,
        nodes: [
          n('l1', 120, 90, 'classic', { kind: 'code', icon: false, mono: true, sub: '<script src>' }),
          n('l1a', 330, 90, 'parse HTML', { kind: 'dom', icon: false, w: 150 }), n('l1b', 520, 90, 'download JS', { kind: 'net', icon: false, w: 150, state: 'bad' }), n('l1c', 700, 90, 'run JS', { kind: 'js', icon: false, w: 130, state: 'bad' }), n('l1d', 880, 90, 'parse rest', { kind: 'dom', icon: false, w: 150 }),
          n('l2', 120, 210, 'async', { kind: 'code', icon: false, mono: true, sub: '<script async>' }),
          n('l2a', 420, 210, 'parse HTML ………………', { kind: 'dom', icon: false, w: 330, state: 'ok' }), n('l2b', 420, 265, 'download JS (parallel)', { kind: 'net', icon: false, w: 230 }), n('l2c', 700, 210, 'run JS (pauses parser)', { kind: 'js', icon: false, w: 200, state: 'upd' }), n('l2d', 890, 210, 'parse', { kind: 'dom', icon: false, w: 110 }),
          n('l3', 120, 350, 'defer / module', { kind: 'code', icon: false, mono: true, sub: '<script defer>' }),
          n('l3a', 470, 350, 'parse the whole HTML ………………', { kind: 'dom', icon: false, w: 430, state: 'ok' }), n('l3b', 420, 405, 'download JS (parallel)', { kind: 'net', icon: false, w: 230 }), n('l3c', 830, 350, 'run JS, in order', { kind: 'js', icon: false, w: 200, state: 'ok' }),
        ],
        edges: [e('l1a', 'l1b'), e('l1b', 'l1c'), e('l1c', 'l1d'), e('l2a', 'l2c'), e('l2c', 'l2d'), e('l3a', 'l3c')],
        caption: 'time →',
      },
      body: [
        'When the parser meets a plain `<script src>`, it must stop: the script might call `document.write` or read the DOM so far. The browser downloads and runs the script, then resumes parsing. On a slow network that is a long blank pause.',
        '`async` downloads in parallel and runs <i>as soon as it arrives</i> (order not guaranteed). `defer` downloads in parallel and runs <i>after parsing finishes</i>, in document order. `type="module"` scripts are deferred by default.',
      ],
      code: { file: 'head.html', lang: 'html', src: `
<!-- ❌ blocks parsing until downloaded AND executed -->
<script src="/analytics.js"></script>

<!-- ✅ independent script (ads, analytics): order doesn't matter -->
<script async src="/analytics.js"></script>

<!-- ✅ app code that needs the full DOM, runs in order -->
<script defer src="/vendor.js"></script>
<script defer src="/app.js"></script>

<!-- ✅ ES modules are deferred automatically (what Vite emits) -->
<script type="module" src="/assets/index-3f9a.js"></script>`, hl: [2, 5, 8, 9, 12] },
      interview: '“async vs defer?” → both download without blocking; <b>async</b> executes on arrival in any order (good for independent scripts), <b>defer</b> executes after the parser finishes, in order (good for app code).',
    },
    {
      short: 'CSS → CSSOM', title: 'CSS becomes the CSSOM, and it blocks rendering', tag: 'concept',
      scene: merge(
        { nodes: [n('css', 150, 110, 'app.css', { kind: 'file', sub: 'downloaded bytes' }), n('cp', 150, 240, 'CSS parser', { kind: 'css' }), n('wait', 150, 380, 'First paint waits', { kind: 'clock', sub: 'until all <head> CSS is in', state: 'upd' })],
          edges: [e('css', 'cp'), e('cp', 'c-root', 'rules', { bend: -30 })],
          flows: [f('css>cp', '.note{…}', { kind: 'file', every: 1.8 })] },
        tree({ id: 'root', label: 'stylesheet', kids: [{ id: 'b', label: 'body', sub: 'font: 16px Inter' }, { id: 'h', label: 'h1', sub: 'font-size: 28px' }, { id: 'nt', label: '.note', sub: 'display: none' }, { id: 'bt', label: 'button', sub: 'bg: #3b5bfd' }] }, { x: 640, y: 130, dx: 150, dy: 120, w: 138, h: 50, prefix: 'c-', kind: 'css' }),
      ),
      body: [
        'Stylesheets are parsed into the [[cssom]] — a tree of rules. Unlike HTML, CSS is not applied incrementally: a later rule can override an earlier one, so the browser needs the <i>whole</i> stylesheet before it knows any element’s final style.',
        'That is why CSS in `<head>` is [[render-blocking]]: the browser will not paint until it has arrived. Painting earlier would flash unstyled content (FOUC) and then jump. CSS also blocks the execution of classic scripts that come after it, because those scripts might ask for computed styles.',
      ],
      callout: { kind: 'tip', text: 'Keep critical CSS small, inline the above-the-fold part if needed, and load non-critical CSS with `media` attributes (e.g. `media="print"`) so it does not block the first paint.' },
    },
    {
      short: 'Style', title: 'Style: DOM + CSSOM → render tree', tag: 'internals',
      scene: merge(
        withStates(tree({ id: 'html', label: 'html', kids: [{ id: 'head', label: 'head', state: 'dim' }, { id: 'body', label: 'body', kids: [{ id: 'h1', label: 'h1' }, { id: 'p', label: 'p.note', state: 'del' }, { id: 'btn', label: 'button' }] }] }, { x: 230, y: 110, dx: 105, dy: 90, w: 96, h: 42, prefix: 'd-' }), {}),
        tree({ id: 'v', label: 'LayoutView', kids: [{ id: 'b', label: 'body', sub: '16px Inter', kids: [{ id: 'h1', label: 'h1', sub: '28px · bold' }, { id: 'btn', label: 'button', sub: 'bg #3b5bfd' }] }] }, { x: 760, y: 110, dx: 150, dy: 100, w: 140, h: 52, prefix: 'r-', kind: 'layers' }),
        { nodes: [n('m', 500, 260, 'match selectors\n+ cascade', { kind: 'css', w: 150, h: 62, state: 'active' })], edges: [e('d-body', 'm', '', { style: 'dashed' }), e('m', 'r-b', 'computed styles')], zones: [z('zd', 40, 50, 380, 330, 'DOM', 'dom'), z('zr', 580, 50, 390, 330, 'Render (layout) tree', 'gpu')] },
      ),
      body: [
        '“Recalculate style” walks the DOM, matches every element against the CSS selectors, resolves the cascade and inheritance, and produces a <b>computed style</b> for each element (every property gets a final value).',
        'Elements that will never be drawn are dropped: `<head>` and anything with `display: none` get no box in the [[render-tree]]. (`visibility: hidden` <i>does</i> keep its box — it takes up space but paints nothing.)',
      ],
      interview: '“`display:none` vs `visibility:hidden` vs `opacity:0`?” → none: no box, no layout. hidden: box and space kept, not painted, not clickable. opacity 0: box, space and clicks kept; can be animated on the compositor.',
    },
    {
      short: 'Layout', title: 'Layout: every box gets a position and a size', tag: 'internals',
      scene: {
        nodes: [
          n('vp', 330, 250, '', { kind: 'browser', icon: false, w: 500, h: 360 }),
          n('lh', 330, 120, 'h1  x:24 y:24  w:452 h:36', { kind: 'dom', icon: false, mono: true, w: 452, h: 44, state: 'active' }),
          n('lt', 330, 200, 'text runs  x:24 y:76  w:452 h:48', { kind: 'dom', icon: false, mono: true, w: 452, h: 54 }),
          n('lb', 165, 290, 'button  x:24 y:146\nw:120 h:40', { kind: 'dom', icon: false, mono: true, w: 160, h: 56 }),
          n('in', 820, 140, 'Inputs', { kind: 'code', sub: 'viewport width · fonts\nbox model · line wrapping' , h: 70 }),
          n('out', 820, 330, 'Output', { kind: 'layers', sub: 'a fragment tree with\nexact coordinates', h: 70 }),
        ],
        edges: [e('in', 'vp', 'compute', { bend: 20 }), e('vp', 'out', '', { bend: 20 })],
        caption: 'viewport 500 px wide',
      },
      body: [
        '[[layout]] (also called reflow) calculates where every box goes and how big it is: widths from the viewport, heights from content, line breaks for text, positions from the box model, flexbox and grid rules.',
        'Layout is global-ish: changing one element’s width can move its siblings, wrap text differently and change its parent’s height. That is why layout-affecting changes (`width`, `top`, `font-size`, adding nodes, changing text) are the expensive ones.',
      ],
      callout: { kind: 'warn', text: 'Resizing the window, loading a web font and inserting content above the fold all trigger layout. Content that shifts after load is what the [[cls]] metric punishes — reserve space for images and ads with `width`/`height` or `aspect-ratio`.' },
    },
    {
      short: 'Paint', title: 'Paint records drawing commands — it makes no pixels yet', tag: 'internals',
      scene: {
        nodes: [
          n('lay', 150, 260, 'Layout tree', { kind: 'layers', sub: 'boxes + coordinates' }),
          n('c1', 520, 110, 'drawRect(0,0,500,64, #fff)', { kind: 'paint', icon: false, mono: true, w: 330 }),
          n('c2', 520, 185, 'drawText("Cart", 24,48, 28px)', { kind: 'paint', icon: false, mono: true, w: 330 }),
          n('c3', 520, 260, 'drawText("Free shipping…", 24,96)', { kind: 'paint', icon: false, mono: true, w: 330 }),
          n('c4', 520, 335, 'drawRRect(24,146,120,40, #3b5bfd)', { kind: 'paint', icon: false, mono: true, w: 330, state: 'active' }),
          n('c5', 520, 410, 'drawText("Pay", 60,172, white)', { kind: 'paint', icon: false, mono: true, w: 330 }),
          n('dl', 870, 260, 'Display list', { kind: 'file', sub: 'ordered by z-index\nand stacking contexts', h: 70 }),
        ],
        edges: [e('lay', 'c1', '', { style: 'dashed' }), e('lay', 'c3', '', { style: 'dashed' }), e('lay', 'c5', '', { style: 'dashed' }), e('c3', 'dl', '')],
      },
      body: [
        '[[paint]] walks the layout tree in stacking order and records a list of drawing operations: rectangles, borders, text runs, images, shadows. This list is called a <b>display list</b>.',
        'Nothing is on screen yet. Turning those commands into pixels is a separate step ([[raster]]) that can happen off the main thread. Expensive paints are large blurs, big `box-shadow`s and huge gradients repainted every frame.',
      ],
      interview: 'If asked “what’s the difference between layout and paint?”: layout answers <i>where and how big</i>; paint answers <i>what it looks like</i> (colour, text, borders) as a list of draw calls.',
    },
    {
      short: 'Composite', title: 'Layers, raster and compositing put the frame on screen', tag: 'internals',
      scene: merge(procs('comp'), {
        nodes: [n('t1', 380, 470, 'tile', { kind: 'paint', icon: false, w: 64, h: 34 }), n('t2', 460, 470, 'tile', { kind: 'paint', icon: false, w: 64, h: 34 }), n('t3', 540, 470, 'tile', { kind: 'paint', icon: false, w: 64, h: 34 }), n('t4', 620, 470, 'tile', { kind: 'paint', icon: false, w: 64, h: 34 })],
        edges: [e('rast', 't2', '', { dir: 'none', style: 'dashed' })],
        flows: [f('main>comp', 'paint ops', { kind: 'paint', every: 2.4 }), f('comp>gpu', 'frame', { kind: 'gpu', every: 2.4, delay: 1 }), f('gpu>screen', 'pixels', { kind: 'gpu', every: 2.4, delay: 1.8 })],
        h: 520,
      }),
      body: [
        'The page is split into <b>layers</b> (a `position: fixed` header, a video, an element with `will-change: transform`…). Each layer is cut into tiles; raster workers or the GPU turn each tile’s paint commands into a bitmap, visible tiles first.',
        'The [[compositor-thread]] then stacks the layers, applying `transform` and `opacity`, into one compositor frame. The GPU process shows it on the next [[vsync]]. Because this happens off the main thread, a `transform` animation can stay smooth even while JavaScript is busy.',
      ],
      callout: { kind: 'warn', text: 'More layers are not free: each costs GPU memory. Use `will-change: transform` on elements you are about to animate, not on everything.' },
    },
    {
      short: 'Cost of a change', title: 'What each kind of change costs', tag: 'concept',
      scene: { h: 400, nodes: [...lane('w', 90, 'el.style.width', ['JS', 'Style', 'Layout', 'Paint', 'Composite'], '💰💰💰'), ...lane('c', 200, 'el.style.color', ['JS', 'Style', 'Paint', 'Composite'], '💰💰'), ...lane('t', 310, 'el.style.transform', ['JS', 'Style', 'Composite'], '💰')], caption: 'highlighted = work the browser must redo' },
      body: [
        'Change a <b>geometry</b> property (`width`, `height`, `top`, `margin`, `font-size`) and the browser redoes style → layout → paint → composite.',
        'Change a <b>paint-only</b> property (`color`, `background`, `box-shadow`) and layout is skipped. Change `transform` or `opacity` and, if the element has its own layer, only compositing runs — often entirely off the main thread.',
      ],
      code: { file: 'drawer.css', lang: 'css', src: `
/* ❌ animates layout every frame: style → layout → paint → composite */
.drawer { left: -320px; transition: left .3s; }
.drawer.open { left: 0; }

/* ✅ compositor-only: style → composite */
.drawer { transform: translateX(-100%); transition: transform .3s; }
.drawer.open { transform: translateX(0); }`, hl: [6, 7] },
      interview: '“How would you make an animation smooth?” → animate only `transform` and `opacity`, avoid layout-triggering properties, check the Performance panel for long tasks, and use `will-change` sparingly.',
    },
    {
      short: 'Thrashing', title: 'Layout thrashing: forcing layout again and again', tag: 'code',
      scene: { h: 330, nodes: [
        n('w1', 110, 110, 'write', { kind: 'js', icon: false, w: 90 }), n('r1', 220, 110, 'read → layout!', { kind: 'paint', icon: false, w: 130, state: 'bad' }),
        n('w2', 345, 110, 'write', { kind: 'js', icon: false, w: 90 }), n('r2', 455, 110, 'read → layout!', { kind: 'paint', icon: false, w: 130, state: 'bad' }),
        n('w3', 580, 110, 'write', { kind: 'js', icon: false, w: 90 }), n('r3', 690, 110, 'read → layout!', { kind: 'paint', icon: false, w: 130, state: 'bad' }), n('dots', 830, 110, '… × 500', { kind: 'note', icon: false, w: 110 }),
        n('ra', 200, 240, 'read all heights', { kind: 'paint', icon: false, w: 200, state: 'ok' }), n('wa', 470, 240, 'write all heights', { kind: 'js', icon: false, w: 200, state: 'ok' }), n('one', 740, 240, 'one layout', { kind: 'paint', icon: false, w: 160, state: 'ok' }),
      ], edges: [e('w1', 'r1'), e('r1', 'w2'), e('w2', 'r2'), e('r2', 'w3'), e('w3', 'r3'), e('ra', 'wa'), e('wa', 'one')], caption: 'top: interleaved (slow)   ·   bottom: batched (fast)' },
      body: [
        'Browsers batch layout: after you change styles they wait and do one layout before the next frame. But if you <i>read</i> a geometry value (`offsetHeight`, `getBoundingClientRect()`, `scrollTop`) after a write, the browser must run layout immediately to give you a correct number.',
        'Doing write → read in a loop forces a synchronous layout on every iteration. This is [[layout-thrashing]]. The fix: read everything first, then write everything.',
      ],
      code: { file: 'equalize.js', lang: 'js', src: `
// ❌ thrashing: each read forces a fresh layout
for (const card of cards) {
  card.style.height = 'auto';                 // write
  const h = card.offsetHeight;                // read → forced layout
  card.style.height = h + 20 + 'px';          // write
}

// ✅ batched: one layout for the reads, one for the writes
cards.forEach(c => (c.style.height = 'auto'));
const heights = cards.map(c => c.offsetHeight);           // reads
cards.forEach((c, i) => (c.style.height = heights[i] + 20 + 'px')); // writes`, hl: [3, 4, 5, 9, 10, 11] },
    },
    {
      short: 'Frame budget', title: 'One frame, 16.7 milliseconds', tag: 'concept',
      scene: { h: 360, nodes: [
        n('in', 90, 120, 'Input', { kind: 'user', icon: false, w: 100 }), n('js', 230, 120, 'JS / events', { kind: 'js', icon: false, w: 140 }), n('raf', 380, 120, 'rAF', { kind: 'js', icon: false, w: 100 }),
        n('st', 510, 120, 'Style', { kind: 'css', icon: false, w: 100 }), n('lo', 640, 120, 'Layout', { kind: 'paint', icon: false, w: 100 }), n('pa', 770, 120, 'Paint', { kind: 'paint', icon: false, w: 100 }), n('co', 905, 120, 'Composite', { kind: 'gpu', icon: false, w: 120 }),
        n('long', 330, 260, 'Long task: 180 ms of JS', { kind: 'js', icon: false, w: 400, state: 'bad', badge: '11 frames lost' }), n('jank', 760, 260, 'clicks feel ignored', { kind: 'note', icon: false, w: 220 }),
      ], edges: [e('in', 'js'), e('js', 'raf'), e('raf', 'st'), e('st', 'lo'), e('lo', 'pa'), e('pa', 'co'), e('long', 'jank')], flows: [f('in>js', 'click', { kind: 'user', every: 3 })], caption: '60 Hz screen → a new frame every 16.7 ms' },
      body: [
        'On a 60 Hz display the browser has about 16.7 ms per frame for input handling, JavaScript, `requestAnimationFrame` callbacks, style, layout, paint and compositing. Miss it and the user sees a dropped frame (jank).',
        'Any JavaScript task over 50 ms is a <b>long task</b>. While it runs, clicks and key presses wait — which is exactly what [[inp]] measures. Break big work into chunks, move heavy computation to a Web Worker, and let frameworks schedule non-urgent rendering.',
      ],
      callout: { kind: 'insight', text: 'This is the bridge to React: React’s render phase is JavaScript on this same main thread. Lesson 5 shows how React slices its work into ~5 ms pieces so the browser can still paint.' },
      interview: '“How do you debug a janky page?” → Performance panel: find long tasks, check whether time is in Scripting (JS), Rendering (style/layout) or Painting, then fix the biggest one and measure again.',
    },
  ],
  interview: [
    { lvl: 'J', q: 'What happens, step by step, after the browser receives HTML?', a: ['Bytes are decoded and tokenized, and the tree builder creates the DOM incrementally. CSS is parsed into the CSSOM. Style calculation combines them into computed styles and a render (layout) tree, layout computes geometry, paint records draw commands, raster turns them into pixels, and the compositor assembles layers into a frame the GPU shows on the next vsync.'], why: 'It checks that you see rendering as a pipeline with distinct costs, not a black box.', follow: ['Which steps does a `transform` change skip?', 'What blocks the first paint?'] },
    { lvl: 'J', q: 'Who builds the DOM — the browser or JavaScript?', a: ['The browser’s rendering engine (Blink, WebKit, Gecko) builds it from HTML, even when the page has no JavaScript at all. JavaScript reads and edits that existing tree through the DOM API; frameworks like React ultimately call the same API.'], why: 'Separates people who understand the platform from people who only know a framework.' },
    { lvl: 'M', q: 'What is the difference between `async` and `defer`?', a: ['Both download the script in parallel without blocking the parser. `async` executes as soon as the file arrives — possibly before parsing ends and in any order. `defer` executes after the document is parsed, in document order, before `DOMContentLoaded`. Module scripts are deferred by default.'], follow: ['Which would you use for analytics? For your app bundle?'] },
    { lvl: 'M', q: 'Why is CSS render-blocking, and how do you reduce the cost?', a: ['The cascade means any later rule can change an element’s final style, so the browser waits for all head CSS before the first paint to avoid a flash of unstyled content.', 'Reduce it by shipping less CSS on the critical path, inlining critical above-the-fold CSS, splitting non-critical CSS (media queries, lazy routes) and serving it from a CDN with long-lived cache headers.'] },
    { lvl: 'M', q: 'Explain reflow vs repaint vs composite with examples.', a: ['Reflow (layout) recalculates geometry — triggered by `width`, `top`, font changes, adding nodes. Repaint redraws pixels without moving anything — `color`, `background`, `box-shadow`. Composite only re-stacks existing layers — `transform`, `opacity`. Each later stage is cheaper, so prefer the cheapest property that achieves the effect.'] },
    { lvl: 'M', q: 'What is layout thrashing and how do you fix it?', a: ['Reading a layout property (offsetHeight, getBoundingClientRect) right after writing styles forces a synchronous layout. Doing that in a loop forces one per iteration. Fix: batch all reads, then all writes; or schedule writes in `requestAnimationFrame`; libraries like fastdom formalize this.'] },
    { lvl: 'S', q: 'Why can a page scroll smoothly while JavaScript is busy, but a click feels stuck?', a: ['Scrolling and compositor-only animations are handled by the compositor thread, which doesn’t need the main thread (unless there are non-passive scroll listeners). Click handlers, however, are JavaScript and must run on the main thread — they wait behind the long task. That gap is what INP measures.'], follow: ['What does `{ passive: true }` change for touch listeners?'] },
    { lvl: 'S', q: 'How would you diagnose a slow Largest Contentful Paint?', a: ['Break LCP into its parts: TTFB (server/CDN), resource load delay (is the image discovered late? preload it, avoid lazy-loading the hero), resource load time (size, format, CDN), and render delay (render-blocking CSS/JS, client-side rendering). Fix the biggest slice first and verify with field data, not just a lab run.'] },
  ],
  scenarios: [
    { title: 'A hero image appears 2 seconds after the text', sit: 'Lighthouse flags a poor LCP. The hero `<img>` is rendered by a React component after a data fetch.', steps: [['', 'HTML arrives with an empty root, so the preload scanner never sees the image URL.'], ['w', 'JS bundle downloads and runs, the component fetches data, and only then does `<img>` enter the DOM.'], ['x', 'The image download starts at about 1.6 s and finishes at 2.1 s → LCP 2.1 s.']], fix: 'Put the hero image in server HTML (SSR/SSG) or add `<link rel="preload" as="image" fetchpriority="high">`; never `loading="lazy"` the LCP image.' },
    { title: 'A side drawer stutters on cheap phones', sit: 'The drawer animates `left` from -320px to 0 with a CSS transition.', steps: [['', 'Every frame changes `left`, which is a layout property.'], ['w', 'Each frame runs style → layout → paint → composite on the main thread.'], ['x', 'When the app also runs JavaScript, frames are dropped.']], fix: 'Animate `transform: translateX()` instead (compositor-only), and add `will-change: transform` just before opening.' },
    { title: 'An infinite list freezes while equalizing card heights', sit: 'A script loops over 500 cards, setting each height and reading `offsetHeight`.', steps: [['x', '500 forced synchronous layouts in a single task → a 400 ms long task.'], ['g', 'Batching reads then writes produces two layouts in total.']], fix: 'Batch reads before writes, or use CSS (`grid` with `align-items: stretch`) so no JS measurement is needed at all.' },
  ],
  history: {
    intro: 'Who built what, when, and why — the context interviewers love.',
    timeline: [
      { yr: '1993–1995', title: 'Mosaic → Netscape', text: 'Early browsers rendered pages in one process on one thread. A hung page froze the whole browser.' },
      { yr: '1998', title: 'The DOM becomes a W3C standard', text: 'DOM Level 1 gave JavaScript a standard tree API, ending the browser-specific DOMs of the late 90s.' },
      { yr: '2008', title: 'Chrome ships multi-process + V8', text: 'Google launched Chrome with one renderer process per tab and the V8 JIT compiler. Crashes stopped taking down the browser, and fast JS made rich web apps practical.', c: 'g' },
      { yr: '2013', title: 'Blink forks from WebKit', text: 'Google forked WebKit into Blink to evolve its multi-process architecture independently. Apple’s Safari stayed on WebKit.' },
      { yr: '2017', title: 'Firefox Quantum', text: 'Mozilla rewrote style calculation in Rust (Stylo) to run in parallel across CPU cores, and added a GPU compositor (WebRender).' },
      { yr: '2018', title: 'Site isolation', text: 'After the Spectre CPU vulnerability, Chrome moved to one renderer process per site, not just per tab.', c: 'w' },
      { yr: '2020', title: 'Core Web Vitals', text: 'Google defined LCP, FID and CLS as user-centric metrics and later used them as a search ranking signal.' },
      { yr: '2024', title: 'INP replaces FID', text: 'Interaction to Next Paint measures every interaction’s full delay to the next frame, not just the first input’s delay.' },
    ],
    alts: { cols: ['Engine / approach', 'Used by', 'Notes'], rows: [
      ['Blink + V8', 'Chrome, Edge, Opera, Brave', 'Most of the market; RenderingNG architecture.'],
      ['WebKit + JavaScriptCore', 'Safari; every iOS browser', 'On iOS all browsers have historically been required to use WebKit.'],
      ['Gecko + SpiderMonkey', 'Firefox', 'Parallel styling (Stylo), WebRender GPU compositor.'],
      ['CSS transitions / animations', 'Simple state changes', 'Declarative; compositor-friendly with transform/opacity.'],
      ['Web Animations API', 'JS-controlled animations', 'Same engine as CSS animations, controllable from JS.'],
      ['Canvas / WebGL / WebGPU', 'Charts, games, huge datasets', 'You draw pixels yourself; no DOM nodes, no layout cost, but no accessibility for free.'],
    ] },
  },
  quiz: [
    { q: 'Which process holds a page’s DOM?', o: ['Browser process', 'The site’s renderer process', 'GPU process', 'The CDN'], a: 1, why: 'Each site’s renderer process owns its DOM (in Blink’s C++ memory) and its JS heap.' },
    { q: 'Which change usually skips both layout and paint?', o: ['width', 'background-color', 'transform', 'font-size'], a: 2, why: '`transform` (and `opacity`) on a composited layer only needs compositing.' },
    { q: 'An element with `display: none`…', o: ['is laid out but not painted', 'gets no box in the render tree', 'is painted but invisible', 'is removed from the DOM'], a: 1, why: 'It stays in the DOM but is dropped from the render tree, so it takes no space.' },
    { q: 'Why is reading `offsetHeight` after a style write expensive?', o: ['It downloads CSS again', 'It forces a synchronous layout', 'It repaints the whole page', 'It blocks the network'], a: 1, why: 'The browser must run layout immediately to return an up-to-date value.' },
    { q: '`<script defer>` runs…', o: ['immediately when downloaded', 'after parsing, in document order', 'before CSS loads', 'only on user interaction'], a: 1, why: 'Deferred scripts wait for the parser to finish and keep their order.' },
  ],
  cheat: `<h3>The pipeline</h3><p>bytes → tokens → <b>DOM</b> · CSS → <b>CSSOM</b> → <b>Style</b> (computed styles, render tree) → <b>Layout</b> (geometry) → <b>Paint</b> (display list) → <b>Raster</b> (tiles → pixels) → <b>Composite</b> (layers → frame) → GPU → screen at vsync.</p>
  <h3>Who runs it</h3><table class="t"><tr><th>Where</th><th>What</th></tr><tr><td>Browser process</td><td>UI, network, disk cache</td></tr><tr><td>Renderer · main thread</td><td>HTML/CSS parsing, JS (V8), style, layout, paint</td></tr><tr><td>Renderer · compositor thread</td><td>layers, scrolling, transform/opacity animations</td></tr><tr><td>GPU process</td><td>draws frames</td></tr></table>
  <h3>Change cost</h3><table class="t"><tr><th>Property</th><th>Redo</th></tr><tr><td>width, top, margin, font-size, DOM insert</td><td>style → layout → paint → composite</td></tr><tr><td>color, background, box-shadow</td><td>style → paint → composite</td></tr><tr><td>transform, opacity</td><td>style → composite</td></tr></table>
  <h3>Rules of thumb</h3><ul><li>CSS in head blocks first paint; classic scripts block parsing — use <code>defer</code>/<code>type="module"</code>.</li><li>Read layout, then write — never interleave in a loop.</li><li>Keep tasks under 50 ms; frames are 16.7 ms at 60 Hz.</li><li>Animate transform/opacity; reserve space to avoid CLS.</li></ul>`,
};
