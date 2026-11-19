import { n, e, f, z, merge, tree } from '../../engine/build.js';

const two = (left, right, lt = 'before (current)', rt = 'after (new render)') => merge(
  tree(left, { x: 255, y: 120, dx: 150, dy: 95, w: 150, h: 52, prefix: 'b-', kind: 'react' }),
  tree(right, { x: 745, y: 120, dx: 150, dy: 95, w: 150, h: 52, prefix: 'a-', kind: 'react' }),
  { zones: [z('zl', 30, 60, 450, 380, lt, 'fiber'), z('zr', 520, 60, 450, 380, rt, 'react')] },
);

const list = (prefix, x, items) => ({ nodes: items.map((it, k) => n(prefix + (it.id || k), x, 140 + k * 72, it.label, { kind: 'react', mono: true, icon: false, w: 230, sub: it.sub, state: it.state, badge: it.badge })) });

export default {
  id: 'diffing-keys',
  title: 'Diffing rules, keys & component identity',
  level: 'Intermediate',
  minutes: 22,
  tags: ['React', 'Reconciliation'],
  summary: 'The two assumptions that make React’s diff O(n), why state belongs to a position in the tree, how keys match list items — and the bugs you get when identity changes by accident.',
  learn: ['Different type → destroy and rebuild (state lost)', 'Same type → update in place (state kept)', 'Keys give list items an identity', 'Why `key={index}` corrupts state', 'Resetting state on purpose with a key'],
  steps: [
    {
      short: 'Why heuristics', title: 'A perfect tree diff is too slow, so React makes two assumptions', tag: 'concept',
      scene: { nodes: [
        n('gen', 250, 160, 'Generic tree diff', { kind: 'cpu', sub: 'minimum edits between any two trees' }),
        n('gc', 250, 280, 'O(n³)', { kind: 'note', icon: false, sub: '1,000 nodes → 1,000,000,000 steps', state: 'bad', w: 290 }),
        n('re', 750, 160, 'React’s heuristic diff', { kind: 'react', sub: 'one pass, child by child', state: 'active' }),
        n('rc', 750, 280, 'O(n)', { kind: 'note', icon: false, sub: '1,000 nodes → ~1,000 steps', state: 'ok', w: 290 }),
        n('a1', 500, 400, '① different type → different tree', { kind: 'note', icon: false, w: 420 }),
        n('a2', 500, 460, '② key tells siblings apart', { kind: 'note', icon: false, w: 420 }),
      ], edges: [e('gen', 'gc', '', { dir: 'none' }), e('re', 'rc', '', { dir: 'none' }), e('re', 'a1', '', { style: 'dashed' }), e('re', 'a2', '', { style: 'dashed' })] },
      body: [
        'Finding the minimum set of edits between two arbitrary trees is a known hard problem — the best general algorithms are around O(n³). React would be unusably slow on real apps.',
        'So React assumes two things that are almost always true in UI code: (1) elements of <b>different types</b> produce different trees, so it never tries to match a `<div>` subtree against a `<section>` subtree; (2) the developer can mark which children are stable across renders with a [[key]]. With those, [[diffing]] is one linear pass.',
      ],
      interview: 'Mentioning the O(n³) → O(n) trade-off and the two assumptions is the crisp answer to “how does React’s diffing work?”.',
    },
    {
      short: 'Different type', title: 'Rule 1: a different type destroys the whole subtree', tag: 'concept',
      scene: two({ id: 'r', label: 'div', kids: [{ id: 'c', label: 'Counter', sub: 'state: 5' }, { id: 'p', label: 'p' }] }, { id: 'r', label: 'section', state: 'new', kids: [{ id: 'c', label: 'Counter', sub: 'state: 0 (!)', state: 'new' }, { id: 'p', label: 'p', state: 'new' }] }),
      body: [
        'When an element at the same position changes type — `div` → `section`, or `<Article>` → `<Comment>` — React does not compare their children. It <b>unmounts</b> the old subtree (DOM nodes removed, effects cleaned up, state destroyed) and <b>mounts</b> a brand-new one.',
        'So the `Counter` inside loses its state even though it is “the same” component — its parent’s type changed, so its whole position in the tree is new.',
      ],
      code: { file: 'Wrapper.jsx', lang: 'jsx', src: `
function Panel({ fancy }) {
  // switching fancy unmounts the old wrapper AND everything inside it
  return fancy
    ? <section className="fancy"><Counter /></section>
    : <div><Counter /></div>;
}`, hl: [4, 5, 6] },
    },
    {
      short: 'Same type', title: 'Rule 1b: same type → keep the node, patch what changed', tag: 'concept',
      scene: two({ id: 'r', label: 'h1', sub: 'className="a"\nstyle color: red', h: 64 }, { id: 'r', label: 'h1', sub: 'className="b"\nstyle color: red', state: 'upd', h: 64 }),
      body: [
        'Same DOM element type: React keeps the existing DOM node and only changes the attributes that differ — here a single `el.className = "b"`. Unchanged styles are left alone.',
        'Same component type: React keeps the component’s fiber — and therefore its <b>state and effects</b> — and simply calls it again with the new props. Then it recurses into the children with the same rules.',
      ],
      code: { file: 'what-react-does.js', lang: 'js', src: `
// before: <h1 className="a" style={{ color: 'red' }} />
// after:  <h1 className="b" style={{ color: 'red' }} />

// React's commit for this fiber:
h1.className = 'b';       // only the prop that changed
// style.color untouched, node reused, no layout of siblings needed` , hl: [5] },
    },
    {
      short: 'Position = identity', title: 'State belongs to a position in the tree, not to the JSX', tag: 'concept',
      scene: two({ id: 'r', label: 'div', kids: [{ id: 'c', label: 'Counter', sub: 'isFancy · count 3' }] }, { id: 'r', label: 'div', kids: [{ id: 'c', label: 'Counter', sub: 'count 3 (kept)', state: 'ok' }] }, 'isFancy = true', 'isFancy = false'),
      body: [
        'React identifies a component by <b>its type and its position</b> among its parent’s children. The two branches below are different JSX, but both put a `Counter` at the same position in the same parent — so React sees the same component and keeps its state.',
        'This surprises people both ways: state is <i>kept</i> when you expected a reset (same type, same place), and <i>lost</i> when you expected it to survive (wrapper type changed, or position shifted).',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: `
function App() {
  const [isFancy, setIsFancy] = useState(false);
  return (
    <div>
      {isFancy ? <Counter isFancy={true} /> : <Counter isFancy={false} />}
      {/* same type, same position → same state, even though the JSX differs */}
      <label>
        <input type="checkbox" checked={isFancy} onChange={e => setIsFancy(e.target.checked)} />
        Fancy
      </label>
    </div>
  );
}`, hl: [6, 7] },
    },
    {
      short: 'Lists without keys', title: 'Lists without keys are matched by index', tag: 'internals',
      scene: merge(list('b-', 250, [{ id: 0, label: 'li  Alice', sub: 'index 0' }, { id: 1, label: 'li  Bob', sub: 'index 1' }]), list('a-', 750, [{ id: 0, label: 'li  Zara', sub: 'index 0 · was Alice → update', state: 'upd' }, { id: 1, label: 'li  Alice', sub: 'index 1 · was Bob → update', state: 'upd' }, { id: 2, label: 'li  Bob', sub: 'index 2 → insert', state: 'new' }]), {
        zones: [z('zl', 80, 80, 340, 330, 'before', 'fiber'), z('zr', 580, 80, 340, 330, 'after inserting Zara at the top', 'react')],
        edges: [e('b-0', 'a-0', 'index 0', { style: 'dashed' }), e('b-1', 'a-1', 'index 1', { style: 'dashed' })],
        nodes: [n('cost', 500, 470, '3 DOM operations — and any per-row state is now on the wrong person', { kind: 'note', icon: false, state: 'bad' })],
      }),
      body: [
        'Without keys, React matches children by their order: old child 0 with new child 0, and so on. Insert one item at the top and every position shifts — React thinks every row changed, rewrites every text and adds a new row at the end.',
        'That is wasted DOM work, but the bigger problem is <b>state</b>: if each row has an input or local state, that state stays attached to the <i>position</i>, so it now shows next to the wrong person.',
      ],
    },
    {
      short: 'Keys', title: 'Keys give each item an identity', tag: 'internals',
      scene: merge(list('b-', 250, [{ id: 'a', label: 'li key="u1"  Alice' }, { id: 'b', label: 'li key="u2"  Bob' }]), list('a-', 750, [{ id: 'z', label: 'li key="u9"  Zara', state: 'new', badge: 'insert' }, { id: 'a', label: 'li key="u1"  Alice', state: 'ok' }, { id: 'b', label: 'li key="u2"  Bob', state: 'ok' }]), {
        zones: [z('zl', 80, 80, 340, 330, 'before', 'fiber'), z('zr', 580, 80, 340, 330, 'after', 'react')],
        edges: [e('b-a', 'a-a', 'u1 = u1', { kind: 'cdn' }), e('b-b', 'a-b', 'u2 = u2', { kind: 'cdn' })],
        nodes: [n('cost', 500, 470, '1 DOM insert. Alice and Bob keep their nodes and their state.', { kind: 'note', icon: false, state: 'ok' })],
      }),
      body: [
        'With a `key`, React builds a map from key to old fiber and matches by identity, not position. Zara is new → one insertion. Alice and Bob are found by key → reused, untouched, state intact. Reordering also becomes a cheap move instead of rewriting every row.',
        'Keys only need to be unique among siblings, and stable across renders: database ids, slugs, a UUID created when the item was created — never `Math.random()` in render (a new key every render means a new component every render).',
      ],
      code: { file: 'Users.jsx', lang: 'jsx', src: `
function Users({ users }) {
  return (
    <ul>
      {users.map(u => (
        <UserRow key={u.id} user={u} />   // ✅ stable id from the data
      ))}
    </ul>
  );
}
// key is NOT passed as a prop: UserRow cannot read props.key.
// Pass the id separately if the child needs it: <UserRow key={u.id} id={u.id} />`, hl: [5, 6] },
    },
    {
      short: 'Index-key bug', title: 'The `key={index}` bug, step by step', tag: 'scenario',
      scene: merge(list('b-', 250, [{ id: 0, label: 'key=0  Buy milk', sub: 'input: "2 litres"' }, { id: 1, label: 'key=1  Call mum', sub: 'input: ""' }]), list('a-', 750, [{ id: 0, label: 'key=0  Pay rent', sub: 'input: "2 litres" ✗', state: 'bad' }, { id: 1, label: 'key=1  Buy milk', sub: 'input: "" ✗', state: 'bad' }, { id: 2, label: 'key=2  Call mum', sub: 'input: ""', state: 'new' }]), {
        zones: [z('zl', 80, 80, 340, 330, 'before', 'fiber'), z('zr', 580, 80, 340, 330, 'after adding “Pay rent” on top', 'react')],
        edges: [e('b-0', 'a-0', 'key 0 = key 0', { kind: 'cache' })],
      }),
      body: [
        'Each todo row keeps a note in local state (an uncontrolled input). You type “2 litres” next to “Buy milk”, then add “Pay rent” at the top.',
        'With `key={index}`, the new first row gets key 0 — the old key of “Buy milk”. React reuses that fiber, so the typed note “2 litres” now appears next to “Pay rent”. Index keys are only safe when the list never reorders, filters or inserts anywhere but the end, and rows have no state.',
      ],
      code: { file: 'Todos.jsx', lang: 'jsx', src: `
// ❌ identity follows the POSITION
{todos.map((t, i) => <TodoRow key={i} todo={t} />)}

// ✅ identity follows the ITEM
{todos.map(t => <TodoRow key={t.id} todo={t} />)}

function TodoRow({ todo }) {
  const [note, setNote] = useState('');   // state lives on the fiber
  return <li>{todo.text} <input value={note} onChange={e => setNote(e.target.value)} /></li>;
}`, hl: [3, 6, 9] },
      interview: '“When is index as key OK?” → static lists that never reorder, filter or insert in the middle, and whose rows hold no state. Otherwise use a stable id.',
    },
    {
      short: 'Reset with key', title: 'Use a key on purpose to reset a component', tag: 'code',
      scene: two({ id: 'r', label: 'ProfileEditor', sub: 'key="user-7" · draft: "Hi Sam…"' }, { id: 'r', label: 'ProfileEditor', sub: 'key="user-9" · draft: ""', state: 'new' }, 'viewing user 7', 'switched to user 9'),
      body: [
        'Because a different key means a different component, you can force a clean reset by changing the key. Switching from user 7 to user 9 unmounts the old editor (and its half-typed draft) and mounts a fresh one.',
        'This is usually better than an effect that tries to clear several state variables when a prop changes — that approach renders once with stale state and is easy to get wrong.',
      ],
      code: { file: 'UserPage.jsx', lang: 'jsx', src: `
function UserPage({ userId }) {
  // new userId → new key → fresh ProfileEditor with fresh state
  return <ProfileEditor key={userId} userId={userId} />;
}

// ❌ the fragile alternative
function ProfileEditorBad({ userId }) {
  const [draft, setDraft] = useState('');
  useEffect(() => { setDraft(''); }, [userId]);  // renders stale draft first, then clears
}`, hl: [4] },
    },
    {
      short: 'Nested component trap', title: 'Never define a component inside another component', tag: 'scenario',
      scene: two({ id: 'r', label: 'Page', kids: [{ id: 'c', label: 'Editor (ƒ#1)', sub: 'text: "hello"' }] }, { id: 'r', label: 'Page', kids: [{ id: 'c', label: 'Editor (ƒ#2)', sub: 'text: "" — reset!', state: 'new' }] }, 'Page render #1', 'Page render #2'),
      body: [
        'If `Editor` is declared <i>inside</i> `Page`, every render of Page creates a brand-new `Editor` function. To React, a different function is a different <b>type</b> — Rule 1 — so it unmounts the old Editor and mounts a new one on every Page render. Typed text vanishes and focus is lost after each keystroke.',
        'Declare components at module scope. If the inner component needs Page’s data, pass it as props.',
      ],
      code: { file: 'Page.jsx', lang: 'jsx', src: `
// ❌ new Editor type on every Page render
function Page() {
  const [theme, setTheme] = useState('light');
  function Editor() {
    const [text, setText] = useState('');
    return <input value={text} onChange={e => setText(e.target.value)} />;
  }
  return <Editor />;
}

// ✅ stable type
function Editor() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}
function Page() { return <Editor />; }`, hl: [5, 6, 7, 8, 13] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'Why does React need keys in lists?', a: ['Keys give siblings a stable identity, so React can match old and new items by key instead of by position. That makes inserts, deletes and reorders cheap and keeps each item’s state and DOM node attached to the right item.'], follow: ['What happens with `key={index}` when you insert at the top?', 'Can two lists on the page use the same keys?'] },
    { lvl: 'J', q: 'What happens when an element changes from `<div>` to `<section>`?', a: ['React treats it as a different tree: it unmounts the old subtree (removing DOM nodes, running effect cleanups, discarding state) and mounts a new one, including fresh instances of any child components.'] },
    { lvl: 'M', q: 'Explain the assumptions behind React’s O(n) diff.', a: ['General tree edit distance is around O(n³). React assumes elements of different types produce different trees and that keys identify stable children. With those it compares level by level in one pass: same type → update in place and recurse, different type → replace, keyed children → match through a key map.'] },
    { lvl: 'M', q: 'Why does my input lose focus after every keystroke?', a: ['Usually because a component is defined inside another component, so its type is a new function on every parent render and React remounts it. Another cause is a key that changes every render (e.g. `Math.random()`), or a wrapper whose type flips.'] },
    { lvl: 'M', q: 'How do you reset a component’s state when a prop changes?', a: ['Give it a key derived from that prop (`<Editor key={userId} />`). A new key means a new component instance with fresh state. Avoid syncing with an effect that resets state after render — it renders stale data first and adds complexity.'] },
    { lvl: 'S', q: 'How does React reconcile a keyed list where items move?', a: ['It walks old and new children together; on the first mismatch it puts the remaining old fibers in a map keyed by key (or index). For each new child it looks up the old fiber, reusing it if type matches. Reused fibers whose old index is behind the last placed index get a Placement flag (a move); leftovers in the map are deleted. This favours moving items toward the end, which is why moving one item to the front can move every other node.'], why: 'Shows you understand the actual algorithm, including its one weakness.' },
  ],
  scenarios: [
    { title: 'Checkbox ticks jump to the wrong row after sorting', sit: 'A table sorts by price; each row has a local `selected` checkbox state, rendered with `key={i}`.', steps: [['', 'Sorting changes the order of items but not of indexes.'], ['x', 'React reuses fibers by index, so the selected state stays at row 2 while a different product moves there.']], fix: 'Use `key={product.id}`, or lift selection state up into a `Set` of ids.' },
    { title: 'Form resets when toggling “compact mode”', sit: 'Compact mode wraps the form in `<div>` instead of `<section>`.', steps: [['x', 'The wrapper type changes, so React destroys the subtree and the half-filled form state.']], fix: 'Keep the wrapper type the same and change a className instead.' },
  ],
  history: {
    timeline: [
      { yr: '2013', title: 'React publishes its diff heuristics', text: 'The original reconciliation docs explained the O(n) approach and the two assumptions; warnings for missing keys appeared early.' },
      { yr: '2017', title: 'Fiber keeps the same rules', text: 'React 16 rewrote the engine but kept the diffing contract, so existing apps behaved the same.' },
      { yr: '2019', title: '“Preserving and resetting state” becomes core teaching', text: 'With hooks, the docs emphasized that state is tied to position, and that keys reset state on purpose.' },
    ],
    alts: { cols: ['Library', 'List identity'], rows: [['React / Preact', '`key` prop'], ['Vue', '`:key` with `v-for`'], ['Svelte', '`{#each items as item (item.id)}`'], ['SolidJS', '`<For>` keyed by reference; `<Index>` by position'], ['Angular', '`track item.id` in `@for`']] },
  },
  quiz: [
    { q: 'An element switches from `<Article>` to `<Comment>` in the same spot. Its children’s state…', o: ['is kept', 'is destroyed and recreated', 'moves to the new component', 'is merged'], a: 1, why: 'Different type → unmount the old subtree.' },
    { q: 'Which is the best key?', o: ['Math.random()', 'array index', 'item.id from the database', 'item.name if names repeat'], a: 2, why: 'Stable and unique among siblings.' },
    { q: 'Can a child read `props.key`?', o: ['Yes', 'No — key is consumed by React', 'Only in class components', 'Only in development'], a: 1, why: 'Pass the id as a separate prop if needed.' },
    { q: 'Defining a component inside another causes…', o: ['Faster renders', 'A remount on every parent render', 'A compile error', 'Nothing'], a: 1, why: 'A new function is a new type each render.' },
  ],
  cheat: `<h3>Diff rules</h3><table class="t"><tr><th>Case</th><th>React does</th><th>State</th></tr><tr><td>different type</td><td>unmount old subtree, mount new</td><td>lost</td></tr><tr><td>same DOM type</td><td>keep node, patch changed attributes</td><td>—</td></tr><tr><td>same component type</td><td>keep fiber, call with new props</td><td>kept</td></tr><tr><td>keyed children</td><td>match by key, move/insert/delete</td><td>follows the item</td></tr><tr><td>unkeyed children</td><td>match by index</td><td>follows the position</td></tr></table>
  <h3>Identity = type + position + key</h3><ul><li>Use stable ids as keys; index only for static, stateless lists.</li><li>Change the key to reset a component on purpose.</li><li>Declare components at module scope.</li><li>Don’t flip wrapper types to change styling.</li></ul>`,
};
