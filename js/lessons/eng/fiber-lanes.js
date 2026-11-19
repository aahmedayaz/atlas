import { n, e, f, z, merge } from '../../engine/build.js';

// fiber tree drawn with real child / sibling / return pointers
const FT = { App: [500, 90], Header: [250, 220], Main: [500, 220], Footer: [750, 220], Logo: [250, 350], List: [440, 350], Search: [600, 350] };
const fiberPtrs = (states = {}, badges = {}, showReturn = true) => ({
  nodes: Object.entries(FT).map(([id, [x, y]]) => n('f-' + id, x, y, id, { kind: 'fiber', icon: false, mono: true, w: 120, state: states[id], badge: badges[id] })),
  edges: [
    e('f-App', 'f-Header', 'child', { kind: 'fiber' }), e('f-Header', 'f-Main', 'sibling', { kind: 'react' }), e('f-Main', 'f-Footer', 'sibling', { kind: 'react' }),
    e('f-Header', 'f-Logo', 'child', { kind: 'fiber' }), e('f-Main', 'f-List', 'child', { kind: 'fiber' }), e('f-List', 'f-Search', 'sibling', { kind: 'react' }),
    ...(showReturn ? [e('f-Footer', 'f-App', 'return', { style: 'dashed', bend: -40, kind: 'note' }), e('f-Search', 'f-Main', 'return', { style: 'dashed', bend: 30, kind: 'note' })] : []),
  ],
});

const timeline = (blocks, y, labelX = 90) => blocks.map((b, k) => n(b.id || `tl${y}-${k}`, b.x, y, b.label, { kind: b.kind, icon: false, w: b.w, h: 40, state: b.state, mono: true }));

export default {
  id: 'fiber-lanes',
  title: 'Fiber: the work loop, double buffering & lanes',
  level: 'Advanced',
  minutes: 26,
  tags: ['React', 'Internals', 'Concurrency'],
  summary: 'Why React rewrote its engine, what a fiber node holds, how the work loop walks the tree without recursion, how React yields to the browser every few milliseconds, and how lanes let a click jump ahead of a slow render.',
  learn: ['Stack reconciler vs Fiber', 'Fiber fields: child/sibling/return, props, state, flags, lanes', 'beginWork ↓ / completeWork ↑ and `shouldYield()`', 'current vs work-in-progress and the `alternate` pointer', 'Lanes, transitions and interruption'],
  steps: [
    {
      short: 'The old problem', title: 'Before Fiber: one long, unstoppable render', tag: 'history',
      scene: { h: 400, nodes: [
        n('lbl1', 110, 110, 'React 15', { kind: 'note', icon: false, w: 120 }),
        n('blk', 470, 110, 'recursive render of 3,000 components · 180 ms', { kind: 'react', icon: false, w: 520, state: 'bad', mono: true }),
        n('kp', 470, 200, 'keypress waits…', { kind: 'user', icon: false, w: 180, state: 'dim' }),
        n('lbl2', 110, 310, 'React 16+', { kind: 'note', icon: false, w: 120 }),
        ...timeline([{ x: 255, w: 70, label: '5ms', kind: 'react' }, { x: 335, w: 60, label: 'paint', kind: 'gpu' }, { x: 415, w: 70, label: '5ms', kind: 'react' }, { x: 500, w: 70, label: 'key ⌨', kind: 'user', state: 'ok' }, { x: 585, w: 70, label: '5ms', kind: 'react' }, { x: 665, w: 60, label: 'paint', kind: 'gpu' }, { x: 745, w: 70, label: '5ms', kind: 'react' }, { x: 840, w: 90, label: '…', kind: 'note' }], 310),
      ], edges: [e('blk', 'kp', 'blocked', { dir: 'none', style: 'dashed' })], caption: 'time →' },
      body: [
        'React 15’s “stack reconciler” rendered by plain recursion: `render(child)` inside `render(parent)`. Once it started, it could not stop until the JavaScript call stack unwound — a big update froze the page, and typing or animations stuttered.',
        'Fiber (React 16, 2017) replaced recursion with a loop over a linked list of “fibers”. Because React keeps its own pointer to “where I am”, it can do a little work, give the main thread back to the browser, and continue later.',
      ],
      callout: { kind: 'insight', text: 'The JavaScript call stack cannot be paused and resumed. Fiber is basically React’s own, heap-allocated “virtual stack frame” per component — that is what makes pausing possible.' },
    },
    {
      short: 'A fiber node', title: 'What a fiber node actually holds', tag: 'internals',
      scene: { nodes: [
        n('fb', 300, 250, 'Fiber: <SearchBox>', { kind: 'fiber', mono: true, w: 300, h: 70, state: 'active', sub: 'tag: FunctionComponent' }),
        n('p', 300, 90, 'return (parent)', { kind: 'fiber', icon: false, mono: true }), n('c', 160, 420, 'child', { kind: 'fiber', icon: false, mono: true }), n('s', 470, 420, 'sibling', { kind: 'fiber', icon: false, mono: true }),
        n('alt', 760, 120, 'alternate (twin)', { kind: 'fiber', icon: false, mono: true, state: 'dim' }),
        n('dom', 760, 250, 'stateNode', { kind: 'dom', icon: false, mono: true, sub: 'DOM node (host fibers)' }),
        n('hk', 760, 380, 'memoizedState', { kind: 'js', icon: false, mono: true, sub: 'hook → hook → hook' }),
      ], edges: [e('fb', 'p', 'return'), e('fb', 'c', 'child'), e('fb', 's', 'sibling'), e('fb', 'alt', 'alternate', { style: 'dashed', dir: '<->' }), e('fb', 'dom', ''), e('fb', 'hk', '')] },
      body: [
        'Every component instance and every host element (div, span…) has a [[fiber]] — a plain JavaScript object that lives as long as that spot is mounted. Its fields fall into four groups:',
        '<ul><li><b>Tree pointers</b> — `child`, `sibling`, `return`: a linked list, so React can stop at any node and know exactly where to resume.</li><li><b>Identity</b> — `type`, `key`, `stateNode` (the DOM node or class instance).</li><li><b>Data</b> — `pendingProps`, `memoizedProps`, `memoizedState` (the linked list of hooks), `updateQueue`.</li><li><b>Work</b> — `flags` (Placement, Update, Deletion…), `subtreeFlags`, `lanes` (pending priorities), and `alternate`.</li></ul>',
      ],
      code: { file: 'fiber-shape.js', lang: 'js', src: `
// simplified from react-reconciler
{
  tag: FunctionComponent,          // or HostComponent ('div'), HostText, …
  type: SearchBox,                 // the function, or 'div'
  key: null,
  stateNode: null,                 // DOM node for host fibers

  return: parentFiber, child: firstChild, sibling: nextSibling,

  pendingProps: { query: 're' },   // props for this render
  memoizedProps: { query: 'r' },   // props last committed
  memoizedState: hook1,            // hook1.next → hook2 → …
  updateQueue: null,

  flags: Update,                   // what commit must do here
  subtreeFlags: NoFlags,           // anything below?
  lanes: SyncLane,                 // pending work priority
  alternate: twinFiber,            // current <-> work-in-progress
}`, hl: [8, 10, 11, 12, 15, 16, 17, 18] },
    },
    {
      short: 'Linked tree', title: 'The tree is a linked list: child, sibling, return', tag: 'internals',
      scene: fiberPtrs(),
      body: [
        'A parent points only to its <b>first</b> child. That child points to its next <b>sibling</b>, and every fiber points back to its parent through <b>return</b>. Three pointers are enough to walk the entire tree in order without recursion.',
        'Why “return”? It mirrors a call stack: when React finishes a fiber, it “returns” to the parent, just as a function returns to its caller.',
      ],
    },
    {
      short: 'beginWork ↓', title: 'The work loop: beginWork on the way down', tag: 'internals',
      scene: merge(fiberPtrs({ App: 'ok', Header: 'ok', Logo: 'active' }, { App: '1', Header: '2', Logo: '3' }, false), { nodes: [n('cur', 120, 440, 'workInProgress → Logo', { kind: 'code', icon: false, mono: true })] }),
      body: [
        'React keeps one variable, `workInProgress`, pointing at the next fiber to process, and loops: `while (workInProgress && !shouldYield()) performUnitOfWork(workInProgress)`.',
        '<b>beginWork</b> runs your component (or diffs a host element’s props), reconciles its children and returns the first child. If there is one, the pointer moves down to it. Order so far: App → Header → Logo.',
      ],
      code: { file: 'workLoop.js', lang: 'js', src: `
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber) {
  const next = beginWork(fiber);      // render it, create/diff children
  fiber.memoizedProps = fiber.pendingProps;
  if (next !== null) workInProgress = next;   // go DOWN to the child
  else completeUnitOfWork(fiber);             // leaf: go across / up
}`, hl: [2, 3, 8, 10] },
    },
    {
      short: 'completeWork ↑', title: 'completeWork on the way up, then sibling or return', tag: 'internals',
      scene: merge(fiberPtrs({ App: 'ok', Header: 'ok', Logo: 'ok', Main: 'ok', List: 'ok', Search: 'active' }, { App: '1', Header: '2', Logo: '3 ✓', Main: '4', List: '5 ✓', Search: '6' }), { nodes: [n('cur', 120, 440, 'next: complete Search → Main ✓ → Footer', { kind: 'code', icon: false, mono: true })] }),
      body: [
        'Logo has no child, so React calls <b>completeWork</b> on it: for host elements this prepares DOM nodes (creating them on mount, computing the prop changes on update) and bubbles `subtreeFlags` up to the parent.',
        'Then: if the fiber has a <b>sibling</b>, go there and beginWork again; if not, follow <b>return</b> to the parent and complete it too. The walk continues Logo ✓ → Header ✓ → Main → List ✓ → Search → Main ✓ → Footer → App ✓.',
      ],
      code: { file: 'complete.js', lang: 'js', src: `
function completeUnitOfWork(fiber) {
  let node = fiber;
  do {
    completeWork(node);                  // DOM prep + bubble subtreeFlags
    if (node.sibling !== null) {
      workInProgress = node.sibling;     // go ACROSS
      return;
    }
    node = node.return;                  // go UP
    workInProgress = node;
  } while (node !== null);
}`, hl: [4, 5, 6, 9] },
    },
    {
      short: 'Yield', title: 'shouldYield(): hand the thread back every ~5 ms', tag: 'internals',
      scene: { h: 420, nodes: [
        ...timeline([{ x: 120, w: 110, label: 'fibers 1–40', kind: 'react' }, { x: 240, w: 90, label: 'browser', kind: 'gpu' }, { x: 360, w: 110, label: 'fibers 41–80', kind: 'react' }, { x: 480, w: 90, label: 'input', kind: 'user', state: 'ok' }, { x: 600, w: 110, label: 'fibers 81–120', kind: 'react' }, { x: 720, w: 90, label: 'paint', kind: 'gpu' }, { x: 840, w: 110, label: 'done → commit', kind: 'dom' }], 140),
        n('q', 500, 290, 'shouldYield() → has ~5 ms passed, or is input pending?', { kind: 'clock', mono: true, state: 'active' }),
        n('mc', 500, 380, 'Scheduler resumes later via a MessageChannel task', { kind: 'note', icon: false }),
      ], edges: [e('q', 'mc', '')], caption: 'concurrent render: work in slices, browser gets turns in between' },
      body: [
        'After each unit of work the loop asks the [[scheduler]] `shouldYield()`. If its time slice (about 5 ms) is used up, React stops, leaving `workInProgress` pointing where it was, and schedules a continuation as a new macrotask (via `MessageChannel`). The browser gets a turn: it can handle input, run animations and paint.',
        'Only <b>render</b> work is sliced. Once rendering finishes, the commit runs in one synchronous go. Urgent updates (like a click) use the synchronous loop without yielding, so they complete as fast as possible.',
      ],
      interview: 'Concurrency here is <b>not</b> multithreading. All of this runs on the one main thread; React just pauses between units of work. Heavy CPU work still belongs in a Web Worker.',
    },
    {
      short: 'Double buffering', title: 'Two trees: current and work-in-progress', tag: 'internals',
      scene: { nodes: [
        n('fr', 500, 70, 'FiberRootNode', { kind: 'fiber', mono: true, sub: '.current →' }),
        n('c1', 260, 200, 'App (current)', { kind: 'fiber', mono: true, icon: false }), n('c2', 260, 300, 'h1 (current)', { kind: 'fiber', mono: true, icon: false, sub: '"Count: 0"' }),
        n('w1', 740, 200, 'App (WIP)', { kind: 'react', mono: true, icon: false, state: 'upd' }), n('w2', 740, 300, 'h1 (WIP)', { kind: 'react', mono: true, icon: false, sub: '"Count: 1"', state: 'upd' }),
        n('scr', 260, 430, 'what the user sees', { kind: 'eye', icon: false }), n('drf', 740, 430, 'draft, invisible', { kind: 'note', icon: false }),
      ], edges: [e('fr', 'c1', 'current', { kind: 'fiber' }), e('c1', 'c2', '', { dir: 'none' }), e('w1', 'w2', '', { dir: 'none' }), e('c1', 'w1', 'alternate', { dir: '<->', style: 'dashed' }), e('c2', 'w2', 'alternate', { dir: '<->', style: 'dashed' }), e('c1', 'scr', '', { style: 'dashed', dir: 'none' })] },
      body: [
        'React never mutates the tree that matches the screen. It builds the [[wip|work-in-progress]] tree beside the [[current-tree|current]] one, reusing objects through the `alternate` pointer (each current fiber’s twin), the same way graphics programs draw the next frame into a back buffer.',
        'When rendering is complete and the DOM mutations are applied, React swaps a single pointer: `root.current = finishedWork`. The draft becomes the screen’s tree, and the old one becomes the buffer for the next update. Users never see a half-built tree.',
      ],
    },
    {
      short: 'Lanes', title: 'Lanes: every update carries a priority', tag: 'internals',
      scene: { h: 460, nodes: [
        n('l1', 200, 80, 'SyncLane', { kind: 'cache', mono: true, sub: 'click · keypress · focus' }), n('l1b', 640, 80, 'runs now, no yielding', { kind: 'note', icon: false, w: 330 }),
        n('l2', 200, 160, 'InputContinuousLane', { kind: 'db', mono: true, sub: 'drag · scroll · hover' }), n('l2b', 640, 160, 'high priority, interrupts background work', { kind: 'note', icon: false, w: 330 }),
        n('l3', 200, 240, 'DefaultLane', { kind: 'react', mono: true, sub: 'setState in a fetch callback' }), n('l3b', 640, 240, 'normal, time-sliced', { kind: 'note', icon: false, w: 330 }),
        n('l4', 200, 320, 'TransitionLane', { kind: 'lb', mono: true, sub: 'startTransition · useDeferredValue' }), n('l4b', 640, 320, 'low: can be interrupted or thrown away', { kind: 'note', icon: false, w: 330 }),
        n('l5', 200, 400, 'IdleLane', { kind: 'code', mono: true, sub: 'offscreen / background' }), n('l5b', 640, 400, 'only when nothing else is waiting', { kind: 'note', icon: false, w: 330 }),
      ], edges: [e('l1', 'l1b', '', { dir: 'none' }), e('l2', 'l2b', '', { dir: 'none' }), e('l3', 'l3b', '', { dir: 'none' }), e('l4', 'l4b', '', { dir: 'none' }), e('l5', 'l5b', '', { dir: 'none' })] },
      body: [
        'A [[lane]] is one bit in a 31-bit integer. When you call a setter, React picks a lane from <i>how</i> the update happened: inside a click handler → SyncLane; inside `startTransition` → a TransitionLane. The lane is stored on the fiber (`fiber.lanes`) and bubbled to ancestors (`childLanes`), so React knows which subtrees have work at which priority.',
        'Bitmasks make the bookkeeping cheap: “is there any urgent work?” is a single bitwise AND, and several updates of similar priority can be merged into one render.',
      ],
    },
    {
      short: 'Interruption', title: 'A click interrupts a slow transition', tag: 'internals',
      scene: { h: 420, nodes: [
        ...timeline([{ x: 160, w: 200, label: 'transition render…', kind: 'lb' }, { x: 330, w: 110, label: 'click!', kind: 'user', state: 'active' }, { x: 470, w: 140, label: 'WIP discarded', kind: 'lb', state: 'del' }, { x: 630, w: 150, label: 'SyncLane render', kind: 'cache', state: 'ok' }, { x: 770, w: 100, label: 'commit', kind: 'dom', state: 'ok' }, { x: 900, w: 130, label: 'restart transition', kind: 'lb' }], 150),
        n('why', 500, 300, 'safe because render is pure and the DOM was never touched', { kind: 'note', icon: false, state: 'ok' }),
      ], caption: 'the half-built low-priority tree is simply dropped' },
      body: [
        'Suppose React is halfway through a slow TransitionLane render (filtering 10,000 rows) and the user clicks a button. Between units of work React notices higher-priority work, abandons the half-built tree, renders and commits the urgent update, and then restarts the transition from the latest state.',
        'Throwing work away is only safe because the render phase is pure. If components had side effects in render, they would run for work that never reaches the screen — which is exactly why lesson 3 insisted on purity.',
      ],
    },
    {
      short: 'useTransition', title: 'In your code: useTransition and useDeferredValue', tag: 'code',
      scene: { nodes: [
        n('in', 160, 200, '<input> keystroke', { kind: 'user', mono: true }),
        n('u', 470, 120, 'setText(v)', { kind: 'cache', mono: true, sub: 'SyncLane → input stays snappy', state: 'ok' }),
        n('t', 470, 290, 'startTransition(() => setQuery(v))', { kind: 'lb', mono: true, sub: 'TransitionLane → interruptible' }),
        n('list', 820, 290, '<HugeList query />', { kind: 'react', mono: true, sub: 'shows isPending meanwhile' }),
      ], edges: [e('in', 'u'), e('in', 't'), e('t', 'list')], flows: [f('in>u', 'r', { kind: 'user', every: 1.2 }), f('in>t', 're', { kind: 'lb', every: 1.2, delay: 0.3 })] },
      body: [
        'Split one change into two updates: the urgent part (the input’s text) and the non-urgent part (the expensive result). Typing stays instant; the list catches up when React has time, and stale drafts are dropped as you keep typing.',
        '`useDeferredValue` gives the same effect when you only own the value, not the setter. Neither makes the filtering itself cheaper — for that you still need memoization, virtualization, indexing or a worker.',
      ],
      code: { file: 'Search.jsx', lang: 'jsx', src: `
import { useState, useTransition, useDeferredValue } from 'react';

function Search({ products }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function onChange(e) {
    setText(e.target.value);                         // urgent
    startTransition(() => setQuery(e.target.value)); // can be interrupted
  }
  return (
    <>
      <input value={text} onChange={onChange} />
      {isPending && <small>Updating…</small>}
      <HugeList products={products} query={query} />
    </>
  );
}

// Alternative when you only receive the value:
function Results({ query }) {
  const deferred = useDeferredValue(query);   // lags behind during typing
  return <HugeList query={deferred} />;
}`, hl: [9, 10, 23] },
    },
  ],
  interview: [
    { lvl: 'M', q: 'What problem did React Fiber solve?', a: ['The old stack reconciler rendered recursively and could not pause, so large updates blocked the main thread. Fiber represents work as a linked list of fibers processed in a loop, so React can split rendering into units, yield to the browser, prioritize updates, and abort or restart work.'], follow: ['What still cannot be interrupted?'] },
    { lvl: 'M', q: 'What are the `child`, `sibling` and `return` pointers for?', a: ['They turn the tree into a linked structure React can walk iteratively: go to `child` while there is one (beginWork), complete leaves, then move to `sibling`, or climb via `return`. React can stop after any fiber and resume from the saved pointer.'] },
    { lvl: 'S', q: 'Explain double buffering and the alternate pointer.', a: ['React maintains a current tree (on screen) and a work-in-progress tree (draft). Each fiber’s `alternate` points to its twin, so React reuses objects between renders. After commit, `root.current` points to the finished tree in a single assignment — an atomic swap.'] },
    { lvl: 'S', q: 'What are lanes and how do they enable interruption?', a: ['Lanes are bitmask priorities attached to updates and fibers (SyncLane, InputContinuous, Default, Transition, Idle). The scheduler always works on the highest-priority pending lanes. If an urgent lane arrives during a transition render, React discards the incomplete work-in-progress tree, handles the urgent update, and restarts the transition.'], why: 'Distinguishes people who have read about React internals from people who only use hooks.' },
    { lvl: 'M', q: 'Is concurrent rendering multithreading?', a: ['No. It is cooperative scheduling on the single main thread: React renders in slices (about 5 ms) and yields between them. A single long synchronous computation inside one component still blocks. For CPU-heavy work use Web Workers.'] },
    { lvl: 'M', q: 'When would you use `useTransition` vs `useDeferredValue` vs debouncing?', a: ['`useTransition` when you own the state update and want to mark it low priority (with `isPending`). `useDeferredValue` when you receive a value and want a lagging copy for expensive children. Debouncing reduces how often work happens at all — it is better for network requests, while transitions keep rendering responsive.'] },
  ],
  scenarios: [
    { title: 'Typing in a filter box lags behind', sit: 'Each keystroke filters and renders 10,000 rows synchronously.', steps: [['x', 'Every keystroke is a SyncLane render of the whole list → 150 ms long tasks → the input lags.'], ['g', 'With `startTransition` for the list, the input updates immediately and the list renders in slices, dropping stale work.']], fix: 'Transition for the list + `memo` on rows + virtualization for very long lists.' },
    { title: 'A heavy chart still freezes with transitions', sit: 'One component runs a 400 ms calculation inside its render.', steps: [['w', 'React can only yield between fibers, not in the middle of your function.'], ['x', 'The single 400 ms unit blocks the thread anyway.']], fix: 'Memoize, precompute on the server, or move the calculation to a Web Worker.' },
  ],
  history: {
    timeline: [
      { yr: '2016', title: 'Andrew Clark’s “React Fiber Architecture” notes', text: 'Described the goals: incremental rendering, pausing, prioritizing and reusing work.' },
      { yr: '2017', title: 'React 16 ships Fiber', text: 'Same public API, new engine. Error boundaries and fragments came with it.', c: 'g' },
      { yr: '2018', title: '“Time slicing” and Suspense demos', text: 'Dan Abramov’s JSConf Iceland talk showed what interruptible rendering could do.' },
      { yr: '2020', title: 'Lanes replace expiration times', text: 'The priority model moved to bitmask lanes, allowing batches of updates to be grouped flexibly.' },
      { yr: '2022', title: 'React 18 makes concurrency opt-in by feature', text: '`createRoot` plus `startTransition`, `useDeferredValue` and streaming SSR exposed the engine to apps.' },
    ],
    alts: { cols: ['Approach', 'How responsiveness is achieved'], rows: [['React concurrent rendering', 'Interruptible render slices + priority lanes'], ['Web Workers', 'True parallelism; no DOM access in the worker'], ['`scheduler.yield()` / `requestIdleCallback`', 'Browser APIs for manually chunking your own work'], ['Fine-grained signals (Solid)', 'Updates are so small that slicing is rarely needed']] },
  },
  quiz: [
    { q: 'Which pointer leads from a fiber to its parent?', o: ['child', 'sibling', 'return', 'alternate'], a: 2, why: '`return` mirrors returning to the caller.' },
    { q: 'About how long is React’s default time slice?', o: ['50 ms', '16 ms', '5 ms', '1 s'], a: 2, why: 'The scheduler yields roughly every 5 ms.' },
    { q: 'An update inside `startTransition` gets…', o: ['SyncLane', 'a TransitionLane', 'IdleLane', 'no lane'], a: 1, why: 'Transitions are low priority and interruptible.' },
    { q: 'What makes discarding a half-rendered tree safe?', o: ['Commit is async', 'Render is pure and has not touched the DOM', 'Workers', 'The browser caches it'], a: 1, why: 'Nothing visible happened yet.' },
  ],
  cheat: `<h3>Fiber in one table</h3><table class="t"><tr><td>Tree</td><td><code>child</code> · <code>sibling</code> · <code>return</code></td></tr><tr><td>Identity</td><td><code>tag</code> · <code>type</code> · <code>key</code> · <code>stateNode</code></td></tr><tr><td>Data</td><td><code>pendingProps</code> · <code>memoizedProps</code> · <code>memoizedState</code> (hooks) · <code>updateQueue</code></td></tr><tr><td>Work</td><td><code>flags</code> · <code>subtreeFlags</code> · <code>lanes</code> · <code>childLanes</code> · <code>alternate</code></td></tr></table>
  <h3>Work loop</h3><p><code>while (wip && !shouldYield()) performUnitOfWork(wip)</code> — beginWork ↓ child, completeWork ↑, then sibling or return. Yield ≈ every 5 ms. Commit never yields.</p>
  <h3>Lanes</h3><p>Sync (click) &gt; InputContinuous (drag) &gt; Default &gt; Transition &gt; Idle. Urgent lanes interrupt and discard transition work.</p>`,
};
