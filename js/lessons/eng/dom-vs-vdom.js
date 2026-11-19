import { n, e, f, z, merge, tree, patch } from '../../engine/build.js';

const domT = (o = {}) => tree({ id: 'doc', label: 'document', kids: [{ id: 'html', label: 'html', kids: [
  { id: 'head', label: 'head', kids: [{ id: 'title', label: 'title' }] },
  { id: 'body', label: 'body', kids: [{ id: 'h1', label: 'h1', kids: [{ id: 't1', label: '"Hello"', kind: 'note' }] }, { id: 'p', label: 'p', kids: [{ id: 't2', label: '"Welcome"', kind: 'note' }] }] },
] }] }, { x: 600, y: 70, dx: 120, dy: 82, w: 100, h: 40, prefix: 'd-', ...o });

const elTree = (prefix = 'v-', x = 300, state) => tree({ id: 'div', label: 'div', sub: "className: 'card'", kids: [
  { id: 'h1', label: 'h1', sub: "'Hi, Sara'" }, { id: 'btn', label: 'button', sub: 'onClick: ƒ' },
] }, { x, y: 150, dx: 190, dy: 110, w: 170, h: 54, prefix, kind: 'react' });

export default {
  id: 'dom-vs-vdom',
  title: 'DOM, Virtual DOM, JSX & React elements',
  level: 'Beginner',
  minutes: 20,
  tags: ['Browser', 'React'],
  summary: 'What the real DOM is and who builds it, what JSX compiles into, what a React element and a component really are, and what “Virtual DOM” means — and does not mean.',
  learn: ['The DOM as a tree of nodes that the browser owns', 'JSX → `jsx()` calls → plain objects', 'Element vs component vs fiber vs DOM node', 'Why frameworks keep a description in memory', 'How an SPA swaps views without reloading'],
  steps: [
    {
      short: 'The DOM', title: 'The DOM is a live tree the browser builds from HTML', tag: 'concept',
      scene: merge(domT(), { zones: [z('zb', 40, 40, 920, 470, 'Blink memory (C++) · inside the renderer process', 'dom')] }),
      body: [
        'The [[dom]] (Document Object Model) is an in-memory tree that the browser builds from HTML. Every tag, every piece of text — even comments — becomes an object called a <b>node</b>.',
        '<ul><li><b>Root</b>: the `document` object, with `<html>` as its top element.</li><li><b>Parent / child</b>: `<body>` is the parent of `<h1>` and `<p>`.</li><li><b>Siblings</b>: nodes with the same parent, like `<head>` and `<body>`.</li><li><b>Text nodes</b>: “Hello” is its own node, a child of `<h1>`.</li></ul>',
      ],
      code: { file: 'index.html', lang: 'html', src: `
<html>
  <head><title>Demo</title></head>
  <body>
    <h1>Hello</h1>
    <p>Welcome</p>
  </body>
</html>` },
      interview: 'The DOM is a language-independent W3C/WHATWG standard, not part of JavaScript itself. JS is just the most common language that uses its API.',
    },
    {
      short: 'JS ↔ DOM', title: 'JavaScript edits the DOM through an API', tag: 'internals',
      scene: {
        zones: [z('zv', 30, 50, 380, 400, 'V8 heap · JavaScript objects', 'js'), z('zb', 470, 50, 500, 400, 'Blink memory · C++ DOM nodes', 'dom')],
        nodes: [
          n('js', 220, 130, "const h = document\n  .querySelector('h1')", { kind: 'js', mono: true, h: 62 }),
          n('wr', 220, 260, 'wrapper object', { kind: 'js', sub: 'HTMLHeadingElement', state: 'active' }),
          n('set', 220, 380, "h.textContent = 'Hi!'", { kind: 'js', mono: true }),
          n('cpp', 720, 260, 'HTMLHeadingElement', { kind: 'dom', sub: 'C++ object · style · layout box', state: 'upd' }),
          n('rr', 720, 390, 'browser re-styles,\nre-lays out, repaints', { kind: 'paint', h: 62 }),
        ],
        edges: [e('js', 'wr', 'returns'), e('wr', 'cpp', 'points to', { style: 'dashed' }), e('set', 'cpp', 'DOM API call', { bend: 40 }), e('cpp', 'rr')],
        flows: [f('set>cpp', "'Hi!'", { kind: 'js', every: 2.4 })],
      },
      body: [
        'JavaScript never holds the real node. `document.querySelector` returns a small <b>wrapper</b> object in the [[v8]] heap that points at the C++ node inside [[blink]]. Setting `textContent` calls into the engine, which updates the node and marks it as needing style, layout and paint.',
        'Every framework — React, Vue, Angular, Svelte — ends up calling this same API. The browser is still the engine that owns the nodes and paints them.',
      ],
      code: { file: 'vanilla.js', lang: 'js', src: `
const h = document.querySelector('h1');   // wrapper → C++ node
h.textContent = 'Hi!';                     // DOM write
h.classList.add('big');                    // DOM write

const p = document.createElement('p');    // new node, not on the page yet
p.textContent = 'Added by JS';
document.body.appendChild(p);              // now it is in the tree` , hl: [1, 2, 5, 7] },
    },
    {
      short: 'Imperative pain', title: 'Updating the DOM by hand gets messy fast', tag: 'concept',
      scene: {
        nodes: [
          n('st', 160, 240, 'state changes', { kind: 'js', sub: 'cart: 2 → 3 items' }),
          n('o1', 560, 90, 'badge.textContent = 3', { kind: 'dom', icon: false, mono: true }),
          n('o2', 560, 165, 'total.textContent = $57', { kind: 'dom', icon: false, mono: true }),
          n('o3', 560, 240, 'list.appendChild(li)', { kind: 'dom', icon: false, mono: true }),
          n('o4', 560, 315, 'checkout.disabled = false', { kind: 'dom', icon: false, mono: true }),
          n('o5', 560, 390, 'emptyMsg.hidden = true  ← forgot!', { kind: 'dom', icon: false, mono: true, state: 'bad' }),
          n('bug', 870, 390, 'UI out of sync', { kind: 'note', icon: false, state: 'bad' }),
        ],
        edges: [e('st', 'o1'), e('st', 'o2'), e('st', 'o3'), e('st', 'o4'), e('st', 'o5', '', { style: 'dashed' }), e('o5', 'bug')],
      },
      body: [
        'With plain DOM code you must remember <i>every</i> place on the page that depends on a piece of data and update each one by hand, in the right order. Miss one and the UI shows stale information.',
        'React flips this around: you write <b>what the UI should look like for a given state</b>, and React works out which DOM operations are needed. This is the difference between <b>imperative</b> (“do these steps”) and <b>declarative</b> (“this is the result”) UI.',
      ],
      code: { file: 'declarative.jsx', lang: 'jsx', src: `
// declarative: describe the result for ANY cart
function Cart({ items }) {
  const total = items.reduce((s, i) => s + i.price, 0);
  return (
    <section>
      <span className="badge">{items.length}</span>
      {items.length === 0 && <p>Your cart is empty</p>}
      <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
      <p>Total: \${total}</p>
      <button disabled={items.length === 0}>Checkout</button>
    </section>
  );
}`, hl: [2, 3] },
    },
    {
      short: 'JSX compiles', title: 'JSX is not HTML — it compiles to function calls', tag: 'code',
      scene: {
        nodes: [
          n('src', 170, 160, '<h1 className="title">\n  Hello\n</h1>', { kind: 'code', mono: true, h: 76, sub: 'what you write' }),
          n('cmp', 500, 160, 'Compiler', { kind: 'build', sub: 'Babel · SWC · esbuild', state: 'active' }),
          n('out', 820, 160, "jsx('h1', {\n  className: 'title',\n  children: 'Hello' })", { kind: 'js', mono: true, h: 80, sub: 'what ships' }),
          n('bt', 500, 330, 'at BUILD time', { kind: 'note', icon: false, sub: 'npm run build / dev server' }),
        ],
        edges: [e('src', 'cmp'), e('cmp', 'out'), e('cmp', 'bt', '', { dir: 'none', style: 'dashed' })],
        flows: [f('src>cmp', 'JSX', { kind: 'code', every: 2.2 }), f('cmp>out', 'JS', { kind: 'js', every: 2.2, delay: 1 })],
      },
      body: [
        'Browsers do not understand [[jsx]]. At build time a compiler rewrites every JSX tag into a function call. Since React 17 the “automatic runtime” emits `jsx()` from `react/jsx-runtime`; older code used `React.createElement`, which is why old files needed `import React from "react"` at the top.',
        'Because JSX is just function calls, you can put any JavaScript expression inside `{ }`, store JSX in variables, return it from functions and map arrays to it.',
      ],
      code: { file: 'compiled.js', lang: 'js', src: `
// 1. What you write
const el = <h1 className="title">Hello, {name}!</h1>;

// 2a. Classic runtime (React ≤16, still supported)
const el = React.createElement('h1', { className: 'title' }, 'Hello, ', name, '!');

// 2b. Automatic runtime (React 17+, what Vite/Next emit today)
import { jsx as _jsx } from 'react/jsx-runtime';
const el = _jsx('h1', { className: 'title', children: ['Hello, ', name, '!'] });`, hl: [2, 5, 9] },
      interview: '“Why did React 17 stop requiring `import React`?” → the new JSX transform imports `jsx` from `react/jsx-runtime` automatically, so the compiled code no longer references a global `React`.',
    },
    {
      short: 'Element = object', title: 'A React element is a plain, immutable object', tag: 'internals',
      scene: merge(elTree(), {
        nodes: [n('obj', 790, 260, "{ $$typeof: Symbol(react.element),\n  type: 'h1',\n  key: null,\n  props: { children: 'Hi, Sara' } }", { kind: 'js', mono: true, w: 360, h: 100, icon: false })],
        edges: [e('v-h1', 'obj', 'is really', { style: 'dashed' })],
        zones: [z('zh', 40, 70, 920, 400, 'V8 heap · just JavaScript', 'js')],
      }),
      body: [
        'Calling `jsx()` returns a [[element]]: a small object with a `type` (a tag name like `"h1"` or a component function), `props` (including `children`) and an optional `key`. It is a <b>description</b> of what you want on screen — not a DOM node, and nothing is drawn by creating it.',
        'Elements are <b>immutable</b>. To change the UI you never edit an element; you render again and produce brand-new elements. They are cheap: thousands can be created per render and thrown away.',
      ],
      code: { file: 'console', lang: 'js', src: `
const element = <h1 className="greeting">Hello, world!</h1>;
console.log(element);

// {
//   $$typeof: Symbol(react.transitional.element),  // guards against JSON injection
//   type: 'h1',
//   key: null,
//   props: { className: 'greeting', children: 'Hello, world!' },
//   ...
// }`, hl: [5, 6, 7, 8] },
      callout: { kind: 'tip', text: '`$$typeof` is a Symbol, which JSON cannot contain. That stops an attacker’s JSON from being treated as a React element (an XSS defence).' },
    },
    {
      short: 'Components', title: 'A component is a function that returns elements', tag: 'concept',
      scene: {
        nodes: [
          n('cmp', 160, 220, 'Welcome', { kind: 'react', sub: 'function (the blueprint)' }),
          n('call', 430, 220, "Welcome({ name: 'Sara' })", { kind: 'js', mono: true, sub: 'React calls it' }),
          n('el', 730, 120, "{ type: 'h1', props: … }", { kind: 'react', mono: true, sub: 'element (description)' }),
          n('fb', 730, 230, 'Fiber', { kind: 'fiber', sub: 'long-lived record: state, hooks' }),
          n('dom', 730, 340, '<h1>Hello, Sara</h1>', { kind: 'dom', mono: true, sub: 'real DOM node' }),
        ],
        edges: [e('cmp', 'call'), e('call', 'el', 'returns'), e('el', 'fb', 'React tracks'), e('fb', 'dom', 'stateNode')],
        flows: [f('cmp>call', 'props', { kind: 'react', every: 2.6 }), f('call>el', 'element', { kind: 'react', every: 2.6, delay: 0.9 })],
      },
      body: [
        'A [[component]] is a function you write (PascalCase by convention). It takes [[props]] and returns elements. React — not you — calls it, whenever it needs to know what that part of the UI should look like.',
        'Keep four things apart: the <b>component</b> (your function), the <b>element</b> (what it returns this time), the <b>[[fiber]]</b> (React’s long-lived record for that spot in the tree, which holds state and hooks) and the <b>DOM node</b> (what the browser paints).',
      ],
      code: { file: 'Welcome.jsx', lang: 'jsx', src: `
// Component: a function (the blueprint)
function Welcome({ name }) {
  return <h1>Hello, {name}</h1>;       // returns an element
}

// Using it creates an ELEMENT whose type is the function itself:
const el = <Welcome name="Sara" />;
// → { type: Welcome, props: { name: 'Sara' } }
// React calls Welcome(props) later, during render.`, hl: [2, 3, 7, 8] },
      interview: '“Component vs element?” → a component is a function or class you define and reuse; an element is the plain object a component returns (or that JSX creates) describing one piece of UI.',
    },
    {
      short: 'Virtual DOM', title: 'The “Virtual DOM” is React’s description, not a copy of the DOM', tag: 'concept',
      scene: merge(elTree('v-', 250), tree({ id: 'div', label: 'div.card', kids: [{ id: 'h1', label: 'h1' }, { id: 'btn', label: 'button' }] }, { x: 760, y: 150, dx: 170, dy: 110, w: 130, h: 46, prefix: 'r-' }), {
        zones: [z('zv', 30, 70, 450, 330, 'Virtual DOM · V8 heap · made by React', 'react'), z('zr', 540, 70, 430, 330, 'Real DOM · Blink · made by the browser', 'dom')],
        nodes: [n('rd', 500, 450, 'react-dom applies only the differences', { kind: 'react', state: 'active' })],
        edges: [e('v-div', 'r-div', 'sync', { style: 'march', bend: -40 })],
      }),
      body: [
        '“[[vdom]]” is an informal name for React’s in-memory description of the UI — the element tree from the latest render plus React’s fiber tree. It is plain JavaScript; the browser knows nothing about it and cannot paint it.',
        'When state changes, React builds a new description, compares it with the previous one (see lesson 4), and asks `react-dom` to make only the necessary changes to the real DOM.',
        '<table class="t"><tr><th></th><th>Real DOM</th><th>Virtual DOM</th></tr><tr><td>Created by</td><td>the browser</td><td>React (a JS library)</td></tr><tr><td>Made of</td><td>heavy C++ objects with style and layout</td><td>light JS objects</td></tr><tr><td>Can paint?</td><td>yes</td><td>no</td></tr><tr><td>Change cost</td><td>may trigger style, layout, paint</td><td>just memory</td></tr></table>',
      ],
      callout: { kind: 'bad', text: 'Misconceptions to avoid in interviews: React does <i>not</i> copy the whole real DOM; it does <i>not</i> compare the virtual DOM against the real DOM (it compares new render output with previous render output); and a Virtual DOM is <i>not</i> automatically faster than careful direct DOM code.' },
    },
    {
      short: 'createRoot', title: 'createRoot().render(): from description to real nodes', tag: 'code',
      scene: merge(elTree('v-', 230), {
        zones: [z('zv', 30, 70, 420, 330, 'Elements', 'react'), z('zr', 560, 70, 410, 330, 'div#root in the real DOM', 'dom')],
        nodes: [n('r-div', 765, 150, 'div.card', { kind: 'dom', icon: false, mono: true, state: 'new', from: 'v-div' }), n('r-h1', 670, 260, 'h1', { kind: 'dom', icon: false, mono: true, state: 'new', from: 'v-h1' }), n('r-btn', 860, 260, 'button', { kind: 'dom', icon: false, mono: true, state: 'new', from: 'v-btn' }), n('ops', 765, 370, 'createElement × 3 · appendChild', { kind: 'note', icon: false })],
        edges: [e('r-div', 'r-h1', '', { dir: 'none' }), e('r-div', 'r-btn', '', { dir: 'none' })],
      }),
      body: [
        'An element is only an object until you hand it to `react-dom`. `createRoot` takes a real DOM container (usually the empty `<div id="root">` from `index.html`). `root.render(<App />)` starts React’s first render: it calls your components, then creates and inserts real DOM nodes for the result.',
        'On the first render every node is new, so React creates them all. On later renders it reuses them and only patches what changed.',
      ],
      code: { file: 'main.jsx', lang: 'jsx', src: `
import { createRoot } from 'react-dom/client';
import App from './App';

// the empty <div id="root"></div> from index.html
const root = createRoot(document.getElementById('root'));

// element → React renders → react-dom creates real nodes
root.render(<App />);

// React 17 and older:  ReactDOM.render(<App />, container)`, hl: [5, 8] },
    },
    {
      short: 'Why a description?', title: 'Why keep a description at all?', tag: 'concept',
      scene: {
        nodes: [
          n('s1', 130, 90, 'setCount', { kind: 'js', icon: false, mono: true }), n('s2', 130, 160, 'setTotal', { kind: 'js', icon: false, mono: true }), n('s3', 130, 230, 'setOpen', { kind: 'js', icon: false, mono: true }), n('s4', 130, 300, 'setUser', { kind: 'js', icon: false, mono: true }),
          n('one', 430, 195, 'one render + one diff', { kind: 'react', sub: 'in memory, batched', state: 'active' }),
          n('dom', 740, 195, '2 real DOM writes', { kind: 'dom', state: 'ok' }),
          n('rn', 740, 330, 'Same reconciler, other hosts', { kind: 'phone', sub: 'React Native · react-three-fiber · Ink (CLI)' }),
        ],
        edges: [e('s1', 'one'), e('s2', 'one'), e('s3', 'one'), e('s4', 'one'), e('one', 'dom'), e('one', 'rn', '', { style: 'dashed' })],
        flows: [f('one>dom', 'patch', { kind: 'react', every: 2 })],
      },
      body: [
        '<b>Batching:</b> many state changes in one event are combined into one render, one comparison and a minimal set of DOM writes — instead of touching the DOM after every single change.',
        '<b>Declarative code:</b> you describe results; React figures out the steps. <b>Portability:</b> because the description is plain data, the same reconciler can drive other “hosts” — native mobile views in React Native, 3D scenes, even terminal UIs.',
        'The trade-off is real: building and comparing descriptions costs CPU and memory. That is why newer frameworks explore other routes (see History & alternatives).',
      ],
      interview: '“Is the Virtual DOM fast?” → it is a way to make declarative UI <i>fast enough</i>, not the fastest possible approach. Hand-written DOM updates can beat it; compile-time frameworks (Svelte) and signals (Solid) skip diffing entirely.',
    },
    {
      short: 'SPA', title: 'Single-page apps: one HTML page, JavaScript swaps the views', tag: 'concept',
      scene: {
        zones: [z('win', 60, 50, 560, 400, 'Browser tab · URL changes, page never reloads', 'browser')],
        nodes: [
          n('nav', 340, 110, 'Navbar (stays mounted)', { kind: 'react', icon: false, w: 500 }),
          n('sb', 160, 280, 'Sidebar\n(stays)', { kind: 'react', icon: false, w: 150, h: 200 }),
          n('pg', 440, 280, '<Orders /> → <Settings />', { kind: 'react', icon: false, w: 300, h: 200, state: 'upd', mono: true }),
          n('rt', 830, 140, 'Router', { kind: 'js', sub: 'intercepts <a> clicks' }),
          n('hs', 830, 270, 'history.pushState', { kind: 'browser', mono: true, sub: 'URL → /settings, no request' }),
          n('api', 830, 400, 'fetch JSON', { kind: 'net', sub: 'only data crosses the network' }),
        ],
        edges: [e('rt', 'hs'), e('rt', 'pg', 'swap view', { bend: -30 }), e('pg', 'api', '', { style: 'dashed' })],
        flows: [f('rt>pg', '/settings', { kind: 'js', every: 2.6 }), f('pg>api', 'GET /api', { kind: 'net', every: 2.6, delay: 1, back: '{json}' })],
      },
      body: [
        'React apps usually behave as an [[spa]]. The first visit downloads one `index.html` plus the JavaScript bundle. After that, a client-side router intercepts link clicks, changes the URL with the History API (`pushState`) and swaps only the part of the tree that differs. Shared layout stays mounted, so its state (an open menu, a playing audio track, scroll position) survives.',
        'Only data travels afterwards — usually [[http|JSON]] from APIs — instead of whole HTML pages. The cost: a bigger first download, and the server must answer any deep URL with `index.html` (we will see the Vercel rewrite for this in the CSR lesson).',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: `
import { BrowserRouter, Routes, Route, Link } from 'react-router';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />                         {/* stays mounted */}
      <Link to="/settings">Settings</Link>  {/* no full reload */}
      <Routes>
        <Route path="/orders" element={<Orders />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}`, hl: [7, 8, 9, 10, 11] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What is the DOM?', a: ['A live, in-memory tree of nodes that the browser builds from HTML. Each element, text and comment is a node; the document is the root. It exposes an API (`document.querySelector`, `appendChild`, `textContent`…) that scripts use to read and change the page.'], follow: ['Who creates it — the browser or JS?', 'What is the difference between a node and an element?'] },
    { lvl: 'J', q: 'What does JSX compile to?', a: ['Function calls. With the React 17+ automatic runtime, `<h1 className="t">Hi</h1>` becomes `jsx("h1", { className: "t", children: "Hi" })` imported from `react/jsx-runtime`; with the classic runtime it becomes `React.createElement("h1", { className: "t" }, "Hi")`. Both return a React element object.'] },
    { lvl: 'J', q: 'What is the difference between a React component and a React element?', a: ['A component is a function (or class) you write that accepts props and returns UI. An element is the plain, immutable object describing a piece of UI — what JSX produces and what components return. `<Welcome />` is an element whose `type` is the `Welcome` function.'] },
    { lvl: 'M', q: 'What is the Virtual DOM, and what problem does it solve?', a: ['It is React’s in-memory description of the UI (elements plus fibers). It lets you write declarative code: React re-renders a description, diffs it against the previous one and applies minimal, batched changes to the real DOM.', 'It solves developer complexity and avoids redundant DOM writes; it does not make DOM operations themselves faster.'], why: 'Interviewers want to hear the trade-off, not “because the real DOM is slow”.', follow: ['Is it always faster than direct DOM manipulation?', 'How do Svelte or Solid avoid it?'] },
    { lvl: 'M', q: 'Why are React elements immutable?', a: ['An element is a snapshot of the UI at one moment. Immutability lets React compare old and new snapshots cheaply and safely, supports time-slicing (React may render, discard and render again), and makes rendering predictable. To update, you render again with new state.'] },
    { lvl: 'M', q: 'How does an SPA change pages without reloading, and what breaks on refresh?', a: ['A client-side router intercepts link clicks, calls `history.pushState` to change the URL and renders a different component. On a hard refresh of `/settings`, the browser asks the server for `/settings`; a static host has no such file and returns 404 unless it is configured to fall back to `index.html`.'] },
    { lvl: 'S', q: 'Why does `$$typeof` exist on React elements?', a: ['It is a Symbol, which cannot be expressed in JSON. If a server ever returned user-controlled JSON that ended up rendered as children, React would refuse to treat a plain object as an element — closing a potential XSS hole.'] },
  ],
  scenarios: [
    { title: 'Refreshing /settings gives a 404', sit: 'A Vite React SPA works when you click around, but a refresh on /settings shows a 404 from the host.', steps: [['', 'Clicking a link never asked the server for /settings — the router used pushState.'], ['x', 'A refresh makes a real request for /settings; the static host has no file with that path.']], fix: 'Configure an SPA fallback: on Vercel, a rewrite from `/(.*)` to `/index.html` (real files are still served first).' },
    { title: '“Why does my button not update?”', sit: 'A developer changes `element.props.children = "Saved"` on a stored element.', steps: [['x', 'Elements are frozen in development and are just descriptions; mutating one never reaches the DOM.'], ['g', 'Storing `saved` in state and rendering `{saved ? "Saved" : "Save"}` triggers a re-render.']], fix: 'Never mutate elements or props; change state and let React re-render.' },
  ],
  history: {
    intro: 'Where these ideas came from and what competes with them today.',
    timeline: [
      { yr: '1998', title: 'DOM Level 1', text: 'The W3C standardized the DOM API so scripts could work across browsers.' },
      { yr: '2006', title: 'jQuery', text: 'John Resig’s jQuery smoothed over browser differences with imperative DOM helpers like `$(".x").text("Hi")`.' },
      { yr: '2010–2012', title: 'Backbone, Knockout, AngularJS', text: 'MV* frameworks and two-way data binding tried to keep data and DOM in sync automatically.' },
      { yr: '2013', title: 'React and the Virtual DOM', text: 'Jordan Walke at Facebook open-sourced React: re-render a description on every change and diff it. JSX was introduced at the same time.', c: 'g' },
      { yr: '2015', title: 'React Native', text: 'The same reconciler drove native mobile views — proof that the description is host-independent.' },
      { yr: '2016–2019', title: 'Svelte and the compile-time approach', text: 'Rich Harris’s Svelte compiles components into direct DOM updates, with no Virtual DOM at run time.' },
      { yr: '2020', title: 'New JSX transform (React 17)', text: '`react/jsx-runtime` replaced `React.createElement` in compiled output.' },
      { yr: '2021–now', title: 'Signals', text: 'SolidJS, Preact Signals, Angular signals, Vue’s reactivity and Svelte 5 runes track exactly which DOM node depends on which value, skipping tree diffing.' },
    ],
    alts: { cols: ['Approach', 'Examples', 'How updates reach the DOM', 'Trade-off'], rows: [
      ['Virtual DOM + diffing', 'React, Preact, Vue (with compiler hints)', 'Re-render a subtree, diff, patch', 'Simple mental model; some wasted work on big trees'],
      ['Compile-time', 'Svelte', 'Compiler generates exact DOM updates', 'Tiny runtime; framework-specific syntax'],
      ['Fine-grained signals', 'SolidJS, Angular signals, Qwik', 'Each signal updates its own DOM nodes', 'Very fast; components run once, a different mental model'],
      ['Web Components', 'Lit, native custom elements', 'Templates update parts of shadow DOM', 'Standards-based; less ecosystem for apps'],
      ['Vanilla / htmx', 'DOM APIs, server HTML swaps', 'You (or the server) decide each change', 'No framework cost; harder for complex state'],
    ] },
  },
  quiz: [
    { q: 'Who builds the DOM from HTML?', o: ['React', 'The browser’s rendering engine', 'V8', 'The CDN'], a: 1, why: 'Blink/WebKit/Gecko build it, even with zero JavaScript.' },
    { q: '`<Welcome name="Sara" />` evaluates to…', o: ['A DOM node', 'The string “Hello, Sara”', 'An element object whose type is the Welcome function', 'A fiber'], a: 2, why: 'JSX creates an element; React calls Welcome later during render.' },
    { q: 'What does React compare when it diffs?', o: ['Virtual DOM vs real DOM', 'New render output vs previous render output', 'HTML vs CSS', 'Server vs client'], a: 1, why: 'It compares successive descriptions (via fibers), not the real DOM.' },
    { q: 'Which framework avoids a run-time Virtual DOM by compiling components?', o: ['React', 'Preact', 'Svelte', 'Backbone'], a: 2, why: 'Svelte compiles components into direct DOM operations.' },
  ],
  cheat: `<h3>Four things people mix up</h3><table class="t"><tr><th>Thing</th><th>What it is</th><th>Lives in</th><th>Lifetime</th></tr>
  <tr><td>Component</td><td>Your function/class</td><td>your JS bundle</td><td>whole app</td></tr>
  <tr><td>Element</td><td><code>{ type, props, key }</code></td><td>V8 heap</td><td>one render</td></tr>
  <tr><td>Fiber</td><td>React’s work record (state, hooks, flags)</td><td>V8 heap</td><td>as long as it’s mounted</td></tr>
  <tr><td>DOM node</td><td>Browser object that gets painted</td><td>Blink (C++)</td><td>until removed</td></tr></table>
  <h3>JSX</h3><p><code>&lt;h1 className="t"&gt;Hi&lt;/h1&gt;</code> → <code>jsx('h1', { className: 't', children: 'Hi' })</code> → <code>{ type: 'h1', props: {…} }</code></p>
  <h3>One-liners</h3><ul><li>The browser builds the DOM; JS edits it through wrappers.</li><li>Virtual DOM = React’s description; it never paints.</li><li>React diffs new output vs previous output, then patches the real DOM.</li><li>SPA = one HTML page + client router + JSON from APIs.</li></ul>`,
};
