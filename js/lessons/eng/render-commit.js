import { n, e, f, z, merge, tree } from '../../engine/build.js';

const STAGES = ['Trigger', 'Render', 'Reconcile', 'Commit', 'Paint'];
const KIND = { Trigger: 'user', Render: 'react', Reconcile: 'fiber', Commit: 'dom', Paint: 'gpu' };
const pipe = (on, done = []) => ({
  nodes: STAGES.map((s, k) => n('ph-' + s, 120 + k * 190, 48, s, { kind: KIND[s], icon: false, w: 150, h: 38, state: s === on ? 'active' : done.includes(s) ? '' : 'dim' })),
  edges: STAGES.slice(1).map((s, k) => e('ph-' + STAGES[k], 'ph-' + s, '', { state: done.includes(STAGES[k]) || STAGES[k] === on ? '' : 'dim' })),
});

const fiberTree = (prefix, x, opts = {}) => tree({ id: 'root', label: 'HostRoot', sub: '#root', kids: [{ id: 'app', label: 'App', sub: opts.app || 'count = 0', state: opts.appState, kids: [{ id: 'div', label: 'div', state: opts.divState, kids: [
  { id: 'h1', label: 'h1', sub: opts.h1 || '"Count: 0"', state: opts.h1State },
  { id: 'btn', label: 'button', sub: opts.btn || 'onClick ƒ₁', state: opts.btnState },
] }] }] }, { x, y: 150, dx: 160, dy: 82, w: 150, h: 50, prefix, kind: 'fiber' });

const domTree = (x, opts = {}) => tree({ id: 'root', label: 'div#root', kids: [{ id: 'div', label: 'div', state: opts.s, kids: [{ id: 'h1', label: 'h1', sub: opts.h1 || 'Count: 0', state: opts.h1s || opts.s }, { id: 'btn', label: 'button', sub: '+1', state: opts.s }] }] }, { x, y: 150, dx: 150, dy: 95, w: 130, h: 50, prefix: 'dom-', kind: 'dom' });

const APP = `
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}`;

export default {
  id: 'render-commit',
  title: 'Trigger → Render → Commit → Paint',
  level: 'Intermediate',
  minutes: 26,
  tags: ['React', 'Rendering'],
  summary: 'Follow one counter component from its first render to a button click: what “render” really means, how React compares, when the DOM is touched, and when pixels appear.',
  learn: ['Render = calling components; commit = touching the DOM; paint = the browser', 'How `setState` queues an update instead of changing anything', 'State snapshots and updater functions', 'Why render must be pure and Strict Mode renders twice', 'Where `useLayoutEffect` and `useEffect` fit'],
  steps: [
    {
      short: 'The four phases', title: 'Four phases, three owners', tag: 'concept',
      scene: merge(pipe('Render', ['Trigger', 'Render', 'Reconcile', 'Commit', 'Paint']), {
        nodes: [
          n('o1', 215, 200, 'You', { kind: 'user', sub: 'state change, first mount' }),
          n('o2', 500, 200, 'React (JavaScript, in memory)', { kind: 'react', sub: 'calls components · compares trees', w: 300 }),
          n('o3', 690, 330, 'react-dom', { kind: 'dom', sub: 'writes the real DOM' }),
          n('o4', 880, 200, 'Browser', { kind: 'gpu', sub: 'style · layout · paint' }),
          n('nb', 500, 430, 'Nothing reaches the screen until Commit + Paint', { kind: 'note', icon: false, w: 420 }),
        ],
        edges: [e('o1', 'ph-Trigger', '', { style: 'dashed', dir: 'none' }), e('o2', 'ph-Render', '', { style: 'dashed', dir: 'none' }), e('o2', 'ph-Reconcile', '', { style: 'dashed', dir: 'none' }), e('o3', 'ph-Commit', '', { style: 'dashed', dir: 'none' }), e('o4', 'ph-Paint', '', { style: 'dashed', dir: 'none' })],
        flows: [f('ph-Trigger>ph-Render', 'update', { kind: 'user', every: 3 }), f('ph-Render>ph-Reconcile', 'elements', { kind: 'react', every: 3, delay: 0.6 }), f('ph-Reconcile>ph-Commit', 'flags', { kind: 'fiber', every: 3, delay: 1.2 }), f('ph-Commit>ph-Paint', 'DOM', { kind: 'dom', every: 3, delay: 1.8 })],
      }),
      body: [
        'Every React update follows the same path. A <b>trigger</b> starts it. In the <b>[[render]] phase</b> React calls your components and, while building a draft tree, <b>reconciles</b> it with the current one. In the <b>[[commit]] phase</b> React applies the changes to the real DOM. Finally the <b>browser</b> paints.',
        'Think of render and reconcile as <i>planning in memory</i>, and commit as <i>doing</i>. The browser’s paint is not React’s job at all.',
      ],
      callout: { kind: 'insight', text: 'In React, “render” does not mean “draw”. A component can render many times without a single pixel changing — when the comparison finds nothing different, nothing is committed.' },
      code: { file: 'App.jsx', lang: 'jsx', src: APP },
    },
    {
      short: 'First trigger', title: 'Trigger #1: the first render', tag: 'internals',
      scene: merge(pipe('Trigger'), { nodes: [
        n('call', 230, 220, 'root.render(<App />)', { kind: 'js', mono: true }),
        n('fr', 540, 220, 'FiberRoot', { kind: 'fiber', sub: 'container: div#root', state: 'new' }),
        n('hr', 540, 340, 'HostRoot fiber', { kind: 'fiber', sub: 'top of the fiber tree', state: 'new' }),
        n('sch', 840, 220, 'Scheduler', { kind: 'clock', sub: 'queue the work' }),
      ], edges: [e('call', 'fr', 'creates'), e('fr', 'hr', 'current'), e('fr', 'sch', 'schedule')], flows: [f('call>fr', '<App/>', { kind: 'js', every: 2.6 })] }),
      body: [
        'There are only a few kinds of trigger: the initial `root.render()`, a state update (`setState`, `useReducer` dispatch), a [[context]] value change for a component that reads it, or a parent re-rendering.',
        'For the first one, `createRoot` makes a <b>FiberRoot</b> attached to `div#root` and a <b>HostRoot</b> fiber at the top of the tree. `render(<App />)` records the element as pending work and asks React’s [[scheduler]] to run it.',
      ],
      code: { file: 'main.jsx', lang: 'jsx', src: `
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root')); // FiberRoot + HostRoot
root.render(<App />);                                      // trigger #1`, hl: [4, 5] },
    },
    {
      short: 'Call components', title: 'Render: React calls your component', tag: 'internals',
      scene: merge(pipe('Render', ['Trigger']), { nodes: [
        n('app', 200, 230, 'App()', { kind: 'react', mono: true, sub: 'React calls it', state: 'active' }),
        n('st', 200, 360, 'useState(0)', { kind: 'js', mono: true, sub: 'first call → creates hook, 0' }),
        n('el', 650, 280, "{ type: 'div', props: { children: [\n  { type: 'h1', props: { children: ['Count: ', 0] } },\n  { type: 'button', props: { onClick: ƒ₁, children: '+1' } }\n] } }", { kind: 'react', mono: true, icon: false, w: 520, h: 100 }),
      ], edges: [e('app', 'el', 'returns'), e('app', 'st', '', { dir: 'none', style: 'dashed' })], flows: [f('app>el', 'elements', { kind: 'react', every: 2.4 })] }),
      body: [
        '“Render” means React <b>calls your function</b>. `App()` runs top to bottom: `useState(0)` sees this is the first call for this spot in the tree, so it creates a [[hook]] holding `0`, and returns `[0, setCount]`.',
        'The function returns [[element|React elements]] — plain objects. The click handler is a brand-new arrow function (call it ƒ₁) created during this call. Nothing has touched the DOM.',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: APP, hl: [4, 5, 6, 7, 8, 9, 10] },
      vars: { count: '0', 'hook list on App fiber': '[ { memoizedState: 0, queue: [] } ]', 'DOM nodes created': '0' },
    },
    {
      short: 'Build fibers', title: 'Render: build the work-in-progress fiber tree', tag: 'internals',
      scene: merge(pipe('Render', ['Trigger']), fiberTree('w-', 330, { appState: 'new', divState: 'new', h1State: 'new', btnState: 'new' }), {
        zones: [z('zw', 30, 100, 600, 420, 'work-in-progress fibers (draft)', 'fiber')],
        nodes: [n('det', 820, 300, 'detached DOM nodes', { kind: 'dom', sub: 'created in completeWork\nnot on the page yet', h: 70, state: 'new' })],
        edges: [e('w-div', 'det', 'stateNode', { style: 'dashed', bend: -20 })],
      }),
      body: [
        'For each element React creates a [[fiber]] — its long-lived work record — and links them: `child`, `sibling` and `return` (parent). This draft is the [[wip]].',
        'React walks it depth-first: <b>beginWork</b> going down (call the component, create child fibers), <b>completeWork</b> coming back up. On the first mount, completeWork also creates the real DOM nodes, but keeps them <b>detached</b> — built off-screen and stored in `fiber.stateNode`.',
      ],
      interview: 'Why build DOM nodes off-screen? Inserting one finished subtree at the end costs a single layout, instead of one layout per node inserted.',
    },
    {
      short: 'First commit', title: 'Commit: attach everything in one go', tag: 'internals',
      scene: merge(pipe('Commit', ['Trigger', 'Render', 'Reconcile']), fiberTree('w-', 260), domTree(770, { s: 'new' }), {
        zones: [z('zc', 20, 100, 490, 420, 'fibers (now “current”)', 'fiber'), z('zd', 560, 100, 420, 420, 'real DOM in Blink', 'dom')],
        edges: [e('w-div', 'dom-div', 'appendChild once', { style: 'march', kind: 'dom' })],
      }),
      body: [
        'The [[commit]] phase runs <b>synchronously</b> and cannot be interrupted, so the user never sees half an update. React appends the whole detached subtree to `div#root` in one operation, then flips one pointer — `root.current = finishedWork` — so the draft becomes the current tree.',
        'Still inside commit, React attaches refs and runs [[layout-effect|`useLayoutEffect`]] callbacks. These see the new DOM but run <i>before</i> the browser paints.',
      ],
      vars: { 'root.current': 'the tree just built', 'DOM writes': '1 appendChild (subtree of 3)', 'on screen yet?': 'no — paint is next' },
    },
    {
      short: 'Paint', title: 'The browser paints, then useEffect runs', tag: 'concept',
      scene: merge(pipe('Paint', ['Trigger', 'Render', 'Reconcile', 'Commit']), { nodes: [
        n('s1', 140, 220, 'JS task ends', { kind: 'js', icon: false }), n('s2', 330, 220, 'Style', { kind: 'css', icon: false }), n('s3', 470, 220, 'Layout', { kind: 'paint', icon: false }), n('s4', 610, 220, 'Paint', { kind: 'paint', icon: false }), n('s5', 770, 220, 'Composite → vsync', { kind: 'gpu', icon: false }),
        n('scr', 460, 360, 'Count: 0   [ +1 ]', { kind: 'browser', mono: true, state: 'ok', w: 280 }),
        n('ue', 830, 360, 'useEffect callbacks', { kind: 'react', sub: 'after paint (usually)' }),
      ], edges: [e('s1', 's2'), e('s2', 's3'), e('s3', 's4'), e('s4', 's5'), e('s5', 'scr', '', { bend: 40 }), e('scr', 'ue')] }),
      body: [
        'When React’s JavaScript task finishes, the main thread is free and the browser runs style, layout and paint (lesson 1). At the next vsync the user sees <b>Count: 0</b>.',
        'Then React runs passive effects — [[effect|`useEffect`]] — typically after that paint, so they never delay the first pixels. Lesson 6 goes deep on effect timing.',
      ],
    },
    {
      short: 'Click → setState', title: 'Trigger #2: the click queues an update', tag: 'internals',
      scene: merge(pipe('Trigger', []), { nodes: [
        n('btn', 140, 220, 'click on <button>', { kind: 'user', mono: true }),
        n('root', 400, 220, 'listener on #root', { kind: 'dom', sub: 'event delegation' }),
        n('h', 660, 220, 'onClick ƒ₁', { kind: 'js', mono: true, sub: 'found via the fiber’s props' }),
        n('q', 660, 360, 'hook.queue.push({ action: 1 })', { kind: 'fiber', mono: true, state: 'upd' }),
        n('l', 330, 360, 'lane = SyncLane', { kind: 'clock', mono: true, sub: 'a click is urgent' }),
        n('sc', 900, 360, 'schedule render', { kind: 'clock' }),
      ], edges: [e('btn', 'root', 'bubbles'), e('root', 'h'), e('h', 'q', 'setCount(0 + 1)'), e('q', 'l', '', { style: 'dashed' }), e('q', 'sc')],
      flows: [f('btn>root', 'click', { kind: 'user', every: 2.6 }), f('root>h', 'event', { kind: 'dom', every: 2.6, delay: 0.7 })] }),
      body: [
        'React uses [[event-delegation]]: one listener per event type on the root container. The click bubbles up to it; React finds the fiber for the clicked `<button>` and calls its `onClick` prop.',
        '`setCount(count + 1)` does <b>not</b> change `count` and does not touch the DOM. It pushes an update onto the hook’s queue, marks the App fiber and its parents with a priority [[lane]] (SyncLane for a click), and schedules a render. All `setState` calls in the same event are [[batching|batched]] into one render.',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: APP, hl: [9], focus: true },
      vars: { count: '0  (unchanged!)', 'hook.queue': '[ { action: 1 } ]', 'pending lane': 'SyncLane' },
    },
    {
      short: 'Snapshots', title: 'State is a snapshot inside each render', tag: 'code',
      scene: { nodes: [
        n('snap', 180, 120, 'this render’s snapshot', { kind: 'fiber', sub: 'count = 0' }),
        n('a1', 500, 70, 'setCount(count + 1)', { kind: 'js', mono: true, sub: 'queue: replace with 1' }), n('a2', 500, 150, 'setCount(count + 1)', { kind: 'js', mono: true, sub: 'queue: replace with 1' }), n('a3', 500, 230, 'setCount(count + 1)', { kind: 'js', mono: true, sub: 'queue: replace with 1' }),
        n('r1', 840, 150, 'next count = 1', { kind: 'note', icon: false, state: 'bad' }),
        n('b1', 500, 330, 'setCount(c => c + 1)', { kind: 'js', mono: true, sub: '0 → 1' }), n('b2', 500, 410, 'setCount(c => c + 1)', { kind: 'js', mono: true, sub: '1 → 2' }), n('b3', 500, 490, 'setCount(c => c + 1)', { kind: 'js', mono: true, sub: '2 → 3' }),
        n('r2', 840, 410, 'next count = 3', { kind: 'note', icon: false, state: 'ok' }),
      ], edges: [e('snap', 'a1', '', { style: 'dashed' }), e('snap', 'a2', '', { style: 'dashed' }), e('snap', 'a3', '', { style: 'dashed' }), e('a2', 'r1'), e('b1', 'b2'), e('b2', 'b3'), e('b3', 'r2')], h: 540 },
      body: [
        'Inside one render, `count` is a constant — a snapshot. Calling the setter three times with `count + 1` queues “replace with 1” three times, so the next value is 1, not 3.',
        'Pass an <b>updater function</b> when the next value depends on the previous one. React runs the queued updaters in order during the next render, each receiving the result of the previous one. Updaters must be pure: no API calls or logging side effects inside them.',
      ],
      code: { file: 'Counter.jsx', lang: 'jsx', src: `
function Counter() {
  const [count, setCount] = useState(0);

  function plusThreeWrong() {
    setCount(count + 1);   // count is 0 in this snapshot → 1
    setCount(count + 1);   // still 0 → 1
    setCount(count + 1);   // still 0 → 1
    console.log(count);    // 0 — the variable never changes mid-handler
  }

  function plusThreeRight() {
    setCount(c => c + 1);  // 0 → 1
    setCount(c => c + 1);  // 1 → 2
    setCount(c => c + 1);  // 2 → 3
  }
  return <button onClick={plusThreeRight}>{count}</button>;
}`, hl: [5, 6, 7, 8, 12, 13, 14] },
      interview: 'Classic question: “I call setState and then console.log the state — why is it old?” → the setter schedules a re-render; the current render’s variable is a snapshot and never changes.',
    },
    {
      short: 'Re-render', title: 'Render again: App() runs, a new draft tree is built', tag: 'internals',
      scene: merge(pipe('Render', ['Trigger']), fiberTree('c-', 240), fiberTree('w-', 740, { app: 'count = 1 ✱', appState: 'upd', h1: '"Count: 1"', h1State: 'active', btn: 'onClick ƒ₂', btnState: 'active' }), {
        zones: [z('zc', 20, 100, 470, 420, 'current (on screen)', 'fiber'), z('zw', 510, 100, 470, 420, 'work-in-progress (draft)', 'react')],
        edges: [e('c-app', 'w-app', 'alternate', { style: 'dashed', bend: -30, dir: '<->' })],
      }),
      body: [
        'React starts at the root. Fibers with no pending work are <b>bailed out</b> — reused without calling anything. App has a pending update, so React processes its hook queue (count becomes 1) and calls `App()` again, which returns new elements with “Count: 1” and a new arrow function ƒ₂.',
        'Each draft fiber is the [[alternate]] of its current twin, so React reuses objects instead of allocating new ones every time. The real DOM is still untouched, and this phase can be paused or thrown away if something more urgent arrives.',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: APP, hl: [5, 8, 9], focus: true },
      vars: { count: '1', 'App called': 'yes (it has an update)', 'children of App': 'rendered too — they are part of its output' },
    },
    {
      short: 'Reconcile', title: 'Reconcile: compare and flag what changed', tag: 'internals',
      scene: merge(pipe('Reconcile', ['Trigger', 'Render']), fiberTree('w-', 360, { app: 'count = 1', h1: '"Count: 0" → "Count: 1"', h1State: 'upd', btn: 'ƒ₁ → ƒ₂ (no DOM change)', btnState: 'ok', divState: 'ok' }), {
        nodes: [n('rule', 830, 260, 'same type + same key\n→ reuse, compare props\ndifferent type\n→ delete + place new', { kind: 'note', icon: false, mono: true, w: 260, h: 110 }), n('fl', 830, 420, 'flags: Update (h1 text only)', { kind: 'fiber', mono: true, state: 'upd' })],
      }),
      body: [
        '[[reconciliation|Reconciliation]] happens <i>during</i> the render phase, child by child, as the draft tree is built. For each child React asks: same `type` and same `key` as before? If yes it reuses the fiber and compares props; if no it marks the old one for deletion and the new one for placement.',
        'Here `div`, `h1` and `button` keep their types. Only the h1’s text differs, so that fiber gets an `Update` [[flags|flag]]. The button’s handler changed (ƒ₁ → ƒ₂), but that needs no DOM write — React stores handlers on the fiber, not on the DOM node.',
      ],
      interview: '“Diffing vs reconciliation?” → diffing is the comparison step; reconciliation is the whole process of deciding what to keep, update, insert or delete, including setting the flags the commit phase will apply.',
    },
    {
      short: 'Pure render', title: 'Render must be pure — and why Strict Mode renders twice', tag: 'code',
      scene: { nodes: [
        n('in', 150, 200, 'props · state · context', { kind: 'js', sub: 'inputs' }),
        n('fn', 470, 200, 'Component()', { kind: 'react', mono: true, sub: 'pure calculation', state: 'active' }),
        n('out', 790, 200, 'JSX (elements)', { kind: 'react', sub: 'same inputs → same output' }),
        n('x1', 300, 380, 'fetch() in render', { kind: 'net', icon: false, state: 'bad' }), n('x2', 500, 380, 'mutate outer variable', { kind: 'js', icon: false, state: 'bad' }), n('x3', 720, 380, 'touch the DOM', { kind: 'dom', icon: false, state: 'bad' }),
      ], edges: [e('in', 'fn'), e('fn', 'out')], flows: [f('in>fn', 'inputs', { kind: 'js', every: 2.2 }), f('fn>out', 'JSX', { kind: 'react', every: 2.2, delay: 0.9 })] },
      body: [
        'React may call a component several times, pause halfway, restart or throw work away (concurrent rendering, lesson 5). So the render phase must be a <b>pure calculation</b>: same props, state and context in → same JSX out. No fetching, no timers, no DOM writes, no changing objects that existed before the render started.',
        'Mutating a <i>new</i> object you created during this render is fine — no one else can see it. Side effects belong in event handlers or effects. In development, [[strict-mode]] calls your component twice on purpose so impure code shows up as visibly wrong output.',
      ],
      code: { file: 'purity.jsx', lang: 'jsx', src: `
// ✅ pure: output depends only on inputs; local mutation is fine
function Visible({ items, query }) {
  const out = [];                               // created during this render
  for (const i of items) if (i.name.includes(query)) out.push(i);
  return <List items={out} />;
}

// ❌ impure: changes something that existed before the render
let renders = 0;
function Bad({ list }) {
  renders++;                 // outer variable — Strict Mode makes this jump by 2
  list.push('extra');        // mutates a prop!
  fetch('/api/track');       // side effect during render
  return <p>{renders}</p>;
}`, hl: [4, 5, 12, 13, 14] },
      callout: { kind: 'warn', text: 'Don’t remove `<StrictMode>` to hide double logs or double requests. Make render pure and give effects proper cleanup — the double call is a development-only test.' },
    },
    {
      short: 'Commit update', title: 'Commit: one DOM write, then swap the trees', tag: 'internals',
      scene: merge(pipe('Commit', ['Trigger', 'Render', 'Reconcile']), domTree(300, { h1: 'Count: 1', h1s: 'upd' }), {
        nodes: [n('op', 760, 190, 'textNode.nodeValue = "Count: 1"', { kind: 'dom', mono: true, state: 'upd', badge: 'the only write' }), n('sw', 760, 300, 'root.current = finishedWork', { kind: 'fiber', mono: true }), n('le', 760, 400, 'useLayoutEffect → refs', { kind: 'react', mono: true })],
        edges: [e('op', 'dom-h1', '', { kind: 'warn', style: 'march' }), e('op', 'sw'), e('sw', 'le')],
      }),
      body: [
        'React walks only the flagged fibers — `subtreeFlags` bubbled up during render let it skip whole branches with nothing to do — and applies the mutations. For this click that is a single text change. The `div` and the `button` are untouched.',
        'Then the draft tree becomes current (double buffering), layout effects run, and the browser restyles and repaints just the h1. This is React’s whole trick: <b>do the expensive thinking in cheap JavaScript memory, and touch the DOM as little as possible.</b>',
      ],
      vars: { 'DOM writes': '1', 'nodes created': '0', 'nodes removed': '0', 'components called': 'App (and its JSX children)' },
      interview: 'If the click produced the same count (e.g. `setCount(0)` when it is already 0), React bails out early using `Object.is` and may skip rendering children and committing altogether.',
    },
  ],
  interview: [
    { lvl: 'J', q: 'What does “render” mean in React?', a: ['React calling your component functions to calculate what the UI should look like. It produces elements and a draft fiber tree. It does not touch the DOM or paint anything; commit and the browser do that.'], why: 'The single most common misunderstanding; getting it precise signals depth.', follow: ['Can a component render without the DOM changing?'] },
    { lvl: 'J', q: 'Why doesn’t `console.log(count)` show the new value right after `setCount`?', a: ['State is a snapshot for each render. The setter queues an update and schedules a new render; the `count` variable in the running handler belongs to the old render and never changes.'], follow: ['How do you increment three times correctly?'] },
    { lvl: 'M', q: 'What are the render and commit phases, and which can be interrupted?', a: ['Render: call components, build the work-in-progress fiber tree, reconcile and set flags — pure, can be paused, restarted or discarded under concurrent rendering. Commit: apply DOM mutations, swap `root.current`, run layout effects and refs — synchronous and never interrupted, so users never see half-updated UI.'] },
    { lvl: 'M', q: 'What is batching? Did it change in React 18?', a: ['Batching groups multiple state updates into one render and commit. Before React 18 it only happened inside React event handlers; updates inside `setTimeout`, promises or native listeners rendered separately. React 18’s automatic batching (with `createRoot`) batches everywhere. `flushSync` opts out when you really need a synchronous DOM update.'] },
    { lvl: 'M', q: 'Why must components be pure, and what does Strict Mode do about it?', a: ['React can call a component more than once, pause or discard the work, so side effects in render can run unexpectedly or leave inconsistent state. In development Strict Mode double-invokes component bodies, initializers and updaters, and runs effect setup + cleanup an extra time, to surface impurity and missing cleanup. It has no effect in production.'] },
    { lvl: 'S', q: 'Walk me through exactly what happens when a user clicks a button that calls setState.', a: ['Native click → bubbles to React’s root listener → React finds the target fiber and calls `onClick` → the setter enqueues an update on the hook and marks lanes on the fiber path → the scheduler runs a render: unchanged fibers bail out, the updated component re-runs and reconciliation flags the changed host nodes → commit applies mutations, swaps `current`, runs layout effects → the JS task ends, the browser styles, lays out and paints → passive effects run.'], why: 'Senior candidates are expected to connect React internals with the browser pipeline.' },
    { lvl: 'S', q: 'What is double buffering in React?', a: ['React keeps two fiber trees: `current` (on screen) and `workInProgress` (draft). Fibers point to their twins via `alternate`, so React reuses objects between renders. Commit finishes by pointing `root.current` at the finished draft — an atomic swap, like swapping front and back buffers in graphics.'] },
  ],
  scenarios: [
    { title: 'Three increments only add one', sit: 'A “+3” button calls `setCount(count + 1)` three times.', steps: [['', 'All three calls read the same snapshot (say 5) and queue “replace with 6”.'], ['x', 'The next render shows 6, not 8.']], fix: 'Use updater functions: `setCount(c => c + 1)`.' },
    { title: 'Analytics fires twice in development', sit: 'A component calls `track("view")` in its body. Logs show two events locally but one in production.', steps: [['w', 'Strict Mode double-invokes the component body in development.'], ['x', 'The bug is the side effect in render — it would also misfire with concurrent rendering.']], fix: 'Move the side effect into `useEffect` (with cleanup) or into the event that caused it.' },
    { title: 'A component re-renders but the DOM never changes', sit: 'React DevTools shows `Price` rendering on every keystroke elsewhere in the form.', steps: [['', 'The parent re-renders, so its child functions are called again.'], ['g', 'Reconciliation finds the same output → no flags → no DOM writes.'], ['w', 'It only matters if Price’s render is expensive — measure before optimizing (lesson 7).']] },
  ],
  history: {
    intro: 'How React’s rendering model evolved.',
    timeline: [
      { yr: '2013', title: 'React 0.3: re-render everything', text: 'React introduced “re-render the whole tree on every change, then diff” with a recursive stack reconciler. Simple, but a large update blocked the main thread until done.' },
      { yr: '2017', title: 'React 16: Fiber', text: 'The reconciler was rewritten so work is split into units (fibers) that can be paused, enabling the render/commit split.', c: 'g' },
      { yr: '2019', title: 'Hooks (React 16.8)', text: '`useState`, `useEffect` and friends replaced most class components; state became a linked list on each fiber.' },
      { yr: '2022', title: 'React 18: concurrent rendering', text: '`createRoot`, automatic batching everywhere, transitions and Suspense on the server.' },
      { yr: '2024', title: 'React 19', text: 'Actions, `use()`, `useOptimistic`, ref as a prop, and stable Server Components support.' },
      { yr: '2025', title: 'React Compiler 1.0', text: 'Build-time automatic memoization reduces the need for `useMemo`, `useCallback` and `memo`.' },
    ],
    alts: { cols: ['Model', 'Re-run on change', 'Example'], rows: [
      ['Re-render + reconcile', 'The component function and its subtree', 'React, Preact'],
      ['Reactive templates + VDOM', 'Only components whose tracked data changed', 'Vue 3'],
      ['Fine-grained signals', 'Only the expressions that read the signal; components run once', 'SolidJS, Angular signals'],
      ['Compiled updates', 'Generated code that updates exact nodes', 'Svelte 5'],
    ] },
  },
  quiz: [
    { q: 'Which phase writes to the real DOM?', o: ['Trigger', 'Render', 'Commit', 'Paint'], a: 2, why: 'Only commit mutates the DOM; render only calculates.' },
    { q: 'Which phase can React pause or discard?', o: ['Commit', 'Render', 'Both', 'Neither'], a: 1, why: 'Render is pure, so it can be interrupted; commit is synchronous.' },
    { q: 'After `setCount(count + 1)` three times with count = 4, the next count is…', o: ['5', '7', '4', '12'], a: 0, why: 'All three replace with 4 + 1 from the same snapshot.' },
    { q: 'A changed `onClick` function between renders causes…', o: ['A DOM attribute write', 'No DOM write — handlers live on the fiber', 'The button to be recreated', 'A full re-mount'], a: 1, why: 'React’s event system reads handlers from fiber props via delegation.' },
    { q: 'Strict Mode’s double render happens…', o: ['In production', 'Only in development', 'Only on the server', 'Only for class components'], a: 1, why: 'It is a development-only check for purity.' },
  ],
  cheat: `<h3>The pipeline</h3><p><b>Trigger</b> (root.render, setState, context, parent render) → <b>Render</b> (call components, build WIP fibers) → <b>Reconcile</b> (same type+key → reuse; else delete+place; set flags) → <b>Commit</b> (DOM mutations, <code>root.current = wip</code>, layout effects, refs) → <b>Browser paint</b> → <b>useEffect</b>.</p>
  <h3>Rules</h3><ul><li>Render is pure; commit is synchronous.</li><li>State is a snapshot; use updater functions for sequential updates.</li><li>Batching: many setStates → one render (everywhere since React 18).</li><li>Rendering ≠ painting; no diff → no DOM writes.</li></ul>
  <h3>Words</h3><table class="t"><tr><td>Fiber</td><td>work record per element: type, props, state, stateNode, child/sibling/return, flags, lanes</td></tr><tr><td>alternate</td><td>pointer between current and WIP twins</td></tr><tr><td>Flags</td><td>Placement · Update · Deletion</td></tr><tr><td>Lane</td><td>priority of an update</td></tr></table>`,
};
