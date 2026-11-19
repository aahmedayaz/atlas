import { n, e, f, z, merge } from '../../engine/build.js';

const STEPS = [
  ['r', 'Render', 'react', 'call components'],
  ['bm', 'Before mutation', 'fiber', 'getSnapshotBeforeUpdate'],
  ['mu', 'DOM mutation', 'dom', 'insert · update · delete'],
  ['ly', 'Layout', 'cache', 'useLayoutEffect · refs\ncomponentDidMount/Update'],
  ['pt', 'Browser paint', 'gpu', 'pixels on screen'],
  ['ps', 'Passive', 'react', 'useEffect'],
];
const line = (on = [], dim = []) => ({
  nodes: STEPS.map(([id, label, kind, sub], k) => n(id, 100 + k * 160, 120, label, { kind, icon: false, sub, w: 148, h: sub.includes('\n') ? 70 : 58, state: on.includes(id) ? 'active' : dim.includes(id) ? 'dim' : '' })),
  edges: STEPS.slice(1).map(([id], k) => e(STEPS[k][0], id)),
  zones: [z('zc', 175, 60, 490, 120, 'commit phase · synchronous', 'dom')],
});

// chat list scene: a scroll viewport with messages
const chat = (msgs, scrollNote, state) => ({
  zones: [z('vp', 590, 70, 340, 330, 'scroll viewport', 'browser')],
  nodes: [
    ...msgs.map((m, k) => n('m-' + m.id, 760, 120 + k * 56, m.t, { kind: m.old ? 'note' : 'react', icon: false, w: 280, h: 44, state: m.s })),
    n('sn', 760, 440, scrollNote, { kind: 'note', icon: false, mono: true, state }),
  ],
});

export default {
  id: 'effect-timing',
  title: 'Effects & commit timing: useEffect, useLayoutEffect, snapshots',
  level: 'Intermediate',
  minutes: 24,
  tags: ['React', 'Hooks', 'Lifecycle'],
  summary: 'Exactly when each effect runs relative to the DOM update and the browser paint, why `useLayoutEffect` exists, and how to keep a chat’s scroll position when older messages load — with classes and with hooks.',
  learn: ['The commit sub-phases in order', '`useEffect` for syncing with the outside world, with cleanup', '`useLayoutEffect` for measure-then-correct without flicker', '`getSnapshotBeforeUpdate` and its hook workarounds', 'Edge cases in React 18+'],
  steps: [
    {
      short: 'The order', title: 'The exact order: render → mutate → layout effects → paint → effects', tag: 'concept',
      scene: merge(line(['ly', 'ps']), { nodes: [n('n1', 340, 300, 'blocks paint', { kind: 'note', icon: false, state: 'bad' }), n('n2', 900, 300, 'after paint (usually)', { kind: 'note', icon: false, state: 'ok' })], edges: [e('ly', 'n1', '', { style: 'dashed', dir: 'none' }), e('ps', 'n2', '', { style: 'dashed', dir: 'none' })], flows: [f('r>bm', '', { kind: 'react', every: 3.4 }), f('bm>mu', '', { kind: 'fiber', every: 3.4, delay: 0.5 }), f('mu>ly', '', { kind: 'dom', every: 3.4, delay: 1 }), f('ly>pt', '', { kind: 'cache', every: 3.4, delay: 1.5 }), f('pt>ps', '', { kind: 'gpu', every: 3.4, delay: 2 })] }),
      body: [
        'After the render phase, React’s commit runs three synchronous sub-phases: <b>before mutation</b> (read the DOM as it still is — `getSnapshotBeforeUpdate`), <b>mutation</b> (apply inserts, updates and deletions), and <b>layout</b> (attach refs, run [[layout-effect|`useLayoutEffect`]], `componentDidMount/Update`).',
        'Then React’s JavaScript task ends and the browser can paint. Passive effects — [[effect|`useEffect`]] — are scheduled to run afterwards. So, yes: `useLayoutEffect` always runs before `useEffect`, and before the user sees the frame.',
      ],
      code: { file: 'order.jsx', lang: 'jsx', src: `
function Demo() {
  console.log('1 render');
  useLayoutEffect(() => {
    console.log('3 layout effect — DOM updated, not painted');
    return () => console.log('layout cleanup');
  });
  useEffect(() => {
    console.log('4 effect — usually after paint');
    return () => console.log('effect cleanup');
  });
  return <div ref={() => console.log('2 ref attached')} />;
}
// mount logs: 1 render → 2 ref attached → 3 layout effect → (paint) → 4 effect`, hl: [13] },
    },
    {
      short: 'useEffect', title: 'useEffect: synchronize with something outside React', tag: 'code',
      scene: { nodes: [
        n('cmp', 170, 230, 'ChatRoom', { kind: 'react', sub: "roomId = 'general'" }),
        n('fx', 470, 230, 'useEffect', { kind: 'react', mono: true, sub: 'after commit + paint', state: 'active' }),
        n('srv', 800, 140, 'Chat server', { kind: 'server', sub: 'WebSocket' }),
        n('cl', 800, 330, 'cleanup', { kind: 'js', mono: true, sub: 'disconnect()' }),
      ], edges: [e('cmp', 'fx'), e('fx', 'srv', 'connect()'), e('fx', 'cl', 'returns', { style: 'dashed' })], flows: [f('fx>srv', 'connect', { kind: 'net', every: 2.6, back: 'messages' })] },
      body: [
        'An effect is for keeping React in sync with an <b>external system</b>: network connections, subscriptions, timers, browser APIs, a non-React widget, the document title. React runs it after the commit — typically after paint — so it never delays the first pixels.',
        'Return a cleanup function that undoes the setup. The dependency array lists every reactive value the effect reads; React re-runs it (cleanup first) whenever one of them changes. An empty array means “this effect reads no reactive values”, not “run once no matter what”.',
      ],
      code: { file: 'ChatRoom.jsx', lang: 'jsx', src: `
function ChatRoom({ roomId }) {
  useEffect(() => {
    const conn = createConnection(roomId);   // external system
    conn.connect();
    return () => conn.disconnect();          // undo it
  }, [roomId]);                              // re-sync when roomId changes

  return <h1>Welcome to {roomId}</h1>;
}`, hl: [2, 3, 4, 5, 6] },
      callout: { kind: 'warn', text: 'Not everything needs an effect. Deriving data from props or state? Compute it during render. Responding to a click? Do it in the event handler. Effects are an escape hatch, not a lifecycle method.' },
    },
    {
      short: 'Cleanup cycle', title: 'Dependencies change → clean up, then set up again', tag: 'concept',
      scene: { h: 440, nodes: [
        n('a', 140, 110, "mount · roomId='general'", { kind: 'react', icon: false, mono: true }), n('a1', 420, 110, "connect('general')", { kind: 'net', icon: false, mono: true, state: 'ok' }),
        n('b', 140, 220, "update · roomId='travel'", { kind: 'react', icon: false, mono: true }), n('b1', 420, 220, "disconnect('general')", { kind: 'net', icon: false, mono: true, state: 'del' }), n('b2', 720, 220, "connect('travel')", { kind: 'net', icon: false, mono: true, state: 'ok' }),
        n('c', 140, 330, 'unmount', { kind: 'react', icon: false, mono: true }), n('c1', 420, 330, "disconnect('travel')", { kind: 'net', icon: false, mono: true, state: 'del' }),
        n('sm', 720, 400, 'Strict Mode (dev): setup → cleanup → setup on mount', { kind: 'note', icon: false }),
      ], edges: [e('a', 'a1'), e('b', 'b1'), e('b1', 'b2'), e('c', 'c1')] },
      body: [
        'Think of an effect as “start syncing / stop syncing”, not “on mount / on update”. On every dependency change React runs the <b>previous</b> cleanup (with the previous values) and then the new setup. On unmount it runs the last cleanup.',
        'In development, [[strict-mode]] adds one extra setup → cleanup → setup on mount. If that breaks your app (two connections, duplicated listeners), the cleanup is missing or incomplete — the same bug would appear in production when the dependency changes.',
      ],
      interview: '“Why does my effect run twice?” → Strict Mode in development, on purpose. The fix is a correct cleanup, not removing Strict Mode.',
    },
    {
      short: 'useLayoutEffect', title: 'useLayoutEffect: measure, then fix, before anyone sees', tag: 'code',
      scene: { nodes: [
        n('h1', 200, 90, 'with useEffect', { kind: 'note', icon: false }),
        n('f1', 200, 180, 'frame 1: tooltip below the button', { kind: 'browser', icon: false, state: 'bad', w: 300 }), n('f2', 200, 270, 'measure → too tall → move above', { kind: 'js', icon: false, w: 300 }), n('f3', 200, 360, 'frame 2: tooltip jumps up (flicker)', { kind: 'browser', icon: false, state: 'bad', w: 300 }),
        n('h2', 720, 90, 'with useLayoutEffect', { kind: 'note', icon: false }),
        n('g1', 720, 180, 'DOM updated, not painted yet', { kind: 'dom', icon: false, w: 300 }), n('g2', 720, 270, 'measure → move above → re-render now', { kind: 'cache', icon: false, w: 300 }), n('g3', 720, 360, 'first painted frame is already correct', { kind: 'browser', icon: false, state: 'ok', w: 300 }),
      ], edges: [e('f1', 'f2'), e('f2', 'f3'), e('g1', 'g2'), e('g2', 'g3')] },
      body: [
        'Sometimes you can only know the right layout after the DOM exists: a tooltip that must flip above its anchor if there is no room below, an auto-sizing textarea, a popover clamped to the viewport.',
        'With `useEffect`, the browser may paint the wrong position first, and then your correction causes a visible jump. `useLayoutEffect` runs after the DOM is mutated but <b>before paint</b>; if it sets state, React re-renders and commits synchronously, so the first frame the user sees is already right.',
      ],
      code: { file: 'Tooltip.jsx', lang: 'jsx', src: `
function Tooltip({ anchorRect, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const { height } = ref.current.getBoundingClientRect(); // read layout
    setHeight(height);                                       // re-render before paint
  }, [children]);

  const fitsBelow = anchorRect.bottom + height < window.innerHeight;
  const top = fitsBelow ? anchorRect.bottom + 8 : anchorRect.top - height - 8;
  return <div ref={ref} className="tooltip" style={{ top }}>{children}</div>;
}`, hl: [5, 6, 7, 8] },
      callout: { kind: 'warn', text: 'Layout effects block painting. Keep them tiny, and use them only when you must read layout and correct it before the user sees it. Everything else belongs in `useEffect`.' },
    },
    {
      short: 'Edge cases', title: 'Two edge cases in React 18+', tag: 'internals',
      scene: { h: 420, nodes: [
        n('d1', 150, 110, 'click (discrete event)', { kind: 'user', icon: false }), n('d2', 390, 110, 'commit', { kind: 'dom', icon: false }), n('d3', 590, 110, 'useEffect flushed sync', { kind: 'react', icon: false, state: 'upd' }), n('d4', 820, 110, 'paint', { kind: 'gpu', icon: false }),
        n('s1', 150, 280, 'useLayoutEffect', { kind: 'cache', icon: false }), n('s2', 390, 280, 'setState inside it', { kind: 'js', icon: false, state: 'upd' }), n('s3', 610, 280, 'flush ALL pending effects + re-render', { kind: 'react', icon: false }), n('s4', 860, 280, 'then paint', { kind: 'gpu', icon: false }),
      ], edges: [e('d1', 'd2'), e('d2', 'd3'), e('d3', 'd4'), e('s1', 's2'), e('s2', 's3'), e('s3', 's4')] },
      body: [
        '<b>Discrete input</b> (click, keydown, focus): when an update comes from such an event, React 18+ flushes the resulting `useEffect` callbacks synchronously, <i>before</i> the browser paints, so the effect’s result is consistent with the input. `useLayoutEffect` still runs first.',
        '<b>setState inside `useLayoutEffect`</b>: React must re-render synchronously before painting, and to keep things consistent it first flushes any remaining passive effects. Correct, but it lengthens that frame — another reason to keep layout effects small.',
      ],
      interview: 'Nuanced answer to “does useEffect always run after paint?”: usually, but not for updates caused by discrete user input, and not when a layout effect triggers a synchronous re-render.',
    },
    {
      short: 'The chat problem', title: 'The problem: loading older messages makes the chat jump', tag: 'scenario',
      scene: chat([{ id: 'n1', t: '+ 3 older messages inserted above', s: 'new' }, { id: 'a', t: 'Sara: are we still on for 7?', s: 'dim' }, { id: 'b', t: 'You: yes! see you there', s: 'dim' }, { id: 'c', t: 'Sara: 👍', s: 'dim' }], 'scrollTop unchanged → content shifts down', 'bad'),
      body: [
        'In a chat, scrolling to the top loads older messages and <b>prepends</b> them. The container’s `scrollTop` stays the same number, but there is now more content above it — so what the user was reading is suddenly pushed down out of view.',
        'To fix it you need the scroll geometry from <b>before</b> the DOM changed (old `scrollHeight`) and apply a correction <b>after</b> the change but <b>before</b> paint: `scrollTop = newScrollHeight − (oldScrollHeight − oldScrollTop)`.',
      ],
    },
    {
      short: 'getSnapshotBeforeUpdate', title: 'Classes: getSnapshotBeforeUpdate → componentDidUpdate', tag: 'code',
      scene: merge(line(['bm', 'ly'], ['r', 'pt', 'ps']), { nodes: [n('s1', 260, 310, 'read old scrollHeight − scrollTop', { kind: 'fiber', icon: false, mono: true }), n('s2', 580, 310, 'set scrollTop from snapshot', { kind: 'cache', icon: false, mono: true })], edges: [e('bm', 's1', '', { style: 'dashed' }), e('ly', 's2', '', { style: 'dashed' }), e('s1', 's2', 'snapshot')] }),
      body: [
        '`getSnapshotBeforeUpdate(prevProps, prevState)` runs in the <b>before-mutation</b> sub-phase — after render, before the DOM changes. Whatever it returns (a number, an object or `null`) is passed as the third argument to `componentDidUpdate`, which runs in the <b>layout</b> sub-phase, after the DOM changed and before paint.',
        'It is rarely needed — the React docs list it for exactly this kind of scroll preservation and for measuring before animations.',
      ],
      code: { file: 'ChatList.jsx', lang: 'jsx', src: `
class ChatList extends React.Component {
  listRef = React.createRef();

  getSnapshotBeforeUpdate(prevProps) {
    if (prevProps.messages.length < this.props.messages.length) {
      const list = this.listRef.current;
      return list.scrollHeight - list.scrollTop;   // distance from the bottom
    }
    return null;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (snapshot !== null) {
      const list = this.listRef.current;
      list.scrollTop = list.scrollHeight - snapshot; // keep the same distance
    }
  }

  render() {
    return (
      <div ref={this.listRef} className="chat">
        {this.props.messages.map(m => <div key={m.id}>{m.text}</div>)}
      </div>
    );
  }
}`, hl: [5, 6, 7, 8, 13, 14, 15, 16] },
      callout: { kind: 'tip', text: 'Keys are `m.id`, not the array index. With prepended messages, index keys would make React rewrite every row (lesson 4).' },
    },
    {
      short: 'Hooks version', title: 'Hooks: capture before the update, restore in a layout effect', tag: 'code',
      scene: chat([{ id: 'n1', t: '+ 3 older messages', s: 'new', old: true }, { id: 'a', t: 'Sara: are we still on for 7?', s: 'ok' }, { id: 'b', t: 'You: yes! see you there' }, { id: 'c', t: 'Sara: 👍' }], 'scrollTop corrected before paint', 'ok'),
      body: [
        'There is no hook equivalent of `getSnapshotBeforeUpdate`. `useLayoutEffect` runs <i>after</i> the DOM mutation, so reading `scrollHeight` inside it already gives the new value.',
        'The usual pattern: read the geometry <b>in the event handler, right before</b> you trigger the update, store it in a ref, then apply the correction in `useLayoutEffect` once the new messages are in the DOM.',
      ],
      code: { file: 'ChatThread.jsx', lang: 'jsx', src: `
function ChatThread({ messages, loadOlder }) {
  const listRef = useRef(null);
  const snapshotRef = useRef(null);

  async function handleLoadOlder() {
    const list = listRef.current;
    snapshotRef.current = list.scrollHeight - list.scrollTop; // 1. BEFORE the update
    await loadOlder();                                         // triggers a re-render
  }

  useLayoutEffect(() => {                                       // 2. AFTER DOM mutation,
    const list = listRef.current;                               //    BEFORE paint
    if (list && snapshotRef.current !== null) {
      list.scrollTop = list.scrollHeight - snapshotRef.current;
      snapshotRef.current = null;
    }
  }, [messages]);

  return (
    <div ref={listRef} style={{ height: 300, overflowY: 'auto' }}>
      <button onClick={handleLoadOlder}>Load older</button>
      {messages.map(m => <div key={m.id}>{m.text}</div>)}
    </div>
  );
}`, hl: [7, 11, 14] },
      interview: 'Strong answer: “There’s no hook for it, so I capture the value before triggering the update and restore it in useLayoutEffect — or I avoid JS entirely with CSS scroll anchoring.”',
    },
    {
      short: 'Prop-driven updates', title: 'When the update comes from props: a tiny class helper — or CSS', tag: 'code',
      scene: { nodes: [
        n('p', 160, 220, 'parent pushes new items', { kind: 'react', icon: false }),
        n('h', 470, 130, '<SnapshotHelper>', { kind: 'fiber', mono: true, sub: 'class: getSnapshotBeforeUpdate' }),
        n('l', 470, 320, '<div ref={listRef}>', { kind: 'dom', mono: true, sub: 'the scrolling list' }),
        n('css', 820, 220, 'overflow-anchor: auto', { kind: 'css', mono: true, sub: 'browser scroll anchoring', state: 'ok' }),
      ], edges: [e('p', 'h'), e('p', 'l'), e('h', 'l', 'measures', { style: 'dashed' })] },
      body: [
        'If the new messages arrive as props (a parent, a socket, a cache update), there is no handler of yours to capture the “before” value. One officially supported option is a tiny class component whose only job is `getSnapshotBeforeUpdate` + `componentDidUpdate`, rendered as a sibling of the list. Class components are still fully supported for rare cases like this.',
        'Often the best answer is no JavaScript at all: browsers implement <b>scroll anchoring</b> (`overflow-anchor: auto`, the default in Chromium and Firefox) for many insertions above the viewport, and chats commonly use `flex-direction: column-reverse` so the scroll position is naturally measured from the bottom.',
      ],
      code: { file: 'SnapshotHelper.jsx', lang: 'jsx', src: `
class SnapshotHelper extends React.Component {
  getSnapshotBeforeUpdate(prevProps) { return this.props.onBeforeUpdate(prevProps); }
  componentDidUpdate(prevProps, prevState, snapshot) { this.props.onDidUpdate?.(snapshot); }
  render() { return null; }
}

function ScrollingList({ items }) {
  const listRef = useRef(null);
  const capture = () => { const l = listRef.current; return l ? l.scrollHeight - l.scrollTop : null; };
  const restore = (snap) => { const l = listRef.current; if (l && snap !== null) l.scrollTop = l.scrollHeight - snap; };
  return (
    <>
      <SnapshotHelper items={items} onBeforeUpdate={capture} onDidUpdate={restore} />
      <div ref={listRef}>{items.map(item => <div key={item.id}>{item.text}</div>)}</div>
    </>
  );
}`, hl: [2, 3, 13] },
    },
    {
      short: 'Which hook?', title: 'Choosing the right effect', tag: 'concept',
      scene: { h: 430, nodes: [
        n('q', 160, 210, 'Need an effect?', { kind: 'react', icon: false }),
        n('a0', 500, 70, 'derive from props/state → compute in render', { kind: 'note', icon: false, w: 420 }),
        n('a1', 500, 150, 'reaction to a click → event handler', { kind: 'note', icon: false, w: 420 }),
        n('a2', 500, 240, 'sync with external system → useEffect', { kind: 'react', icon: false, w: 420, state: 'ok' }),
        n('a3', 500, 320, 'measure & correct before paint → useLayoutEffect', { kind: 'cache', icon: false, w: 420 }),
        n('a4', 500, 400, 'inject <style> rules (CSS-in-JS libs) → useInsertionEffect', { kind: 'css', icon: false, w: 420 }),
      ], edges: [e('q', 'a0'), e('q', 'a1'), e('q', 'a2'), e('q', 'a3'), e('q', 'a4')] },
      body: [
        '`useInsertionEffect` runs before layout effects and exists for CSS-in-JS libraries that need to insert style rules before anything reads layout. App code almost never needs it.',
        'On the server there is no DOM and no layout: `useLayoutEffect` does not run during server rendering, and code that depends on it must render valid HTML without it and measure after hydration. If you only need it on the client, render that part only after mount.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'Does useLayoutEffect run before useEffect?', a: ['Yes. `useLayoutEffect` runs synchronously in the commit’s layout phase, after DOM mutations and before the browser paints. `useEffect` runs after the commit, usually after paint.'], follow: ['When would you choose useLayoutEffect?'] },
    { lvl: 'J', q: 'What is the dependency array for, and what does an empty array mean?', a: ['It lists the reactive values (props, state, values derived from them) the effect reads. React re-runs the effect, after cleaning up, when any of them change. An empty array means the effect reads none, so it syncs once on mount and cleans up on unmount.'] },
    { lvl: 'M', q: 'Why does my effect run twice in development?', a: ['React Strict Mode simulates an unmount/remount to verify the effect cleans up properly: setup → cleanup → setup. It only happens in development. The fix is a correct cleanup (unsubscribe, abort fetch, clear timers), or moving the logic to an event handler if it is not really synchronization.'] },
    { lvl: 'M', q: 'How would you fix a tooltip that flickers into place?', a: ['Measure and position it in `useLayoutEffect` (or use a layout library like Floating UI that does the same). Because the correction is committed before paint, the user never sees the wrong position.'] },
    { lvl: 'S', q: 'Is there a hook equivalent to getSnapshotBeforeUpdate? How do you keep scroll position when prepending?', a: ['No direct hook. Capture `scrollHeight − scrollTop` before triggering the update (in the event handler) and restore it in `useLayoutEffect`. For prop-driven updates, use a tiny class component with `getSnapshotBeforeUpdate`, or rely on CSS scroll anchoring / `column-reverse` layouts.'], why: 'Tests whether you know the commit sub-phases, not just hook names.' },
    { lvl: 'S', q: 'Does useEffect always run after paint?', a: ['Usually, but not always. For updates triggered by discrete input (click, keydown) React 18+ flushes effects synchronously before paint, and a setState inside `useLayoutEffect` forces remaining effects to flush before the frame. Write effects that are correct either way.'] },
  ],
  scenarios: [
    { title: 'Two WebSocket connections in development', sit: 'A chat opens a socket in `useEffect` with `[]` dependencies and no cleanup.', steps: [['w', 'Strict Mode runs setup, cleanup (nothing), setup.'], ['x', 'Two live sockets; every message appears twice.']], fix: 'Return `() => socket.close()` from the effect.' },
    { title: 'Fetch race when switching users quickly', sit: 'An effect fetches `/api/user/${id}` and sets state on resolve.', steps: [['', 'id 1 → request A; quickly id 2 → request B.'], ['x', 'A resolves after B and overwrites the screen with user 1.']], fix: 'In cleanup set an `ignore` flag or abort with `AbortController`; better, use a data library or framework loader.' },
  ],
  history: {
    timeline: [
      { yr: '2013–2018', title: 'Class lifecycles', text: '`componentDidMount`, `componentDidUpdate`, `componentWillUnmount` grouped code by time, not by concern.' },
      { yr: '2018', title: 'React 16.3: getSnapshotBeforeUpdate', text: 'Added alongside deprecating unsafe `componentWillUpdate`/`componentWillReceiveProps`, which were unsafe for async rendering.', c: 'w' },
      { yr: '2019', title: 'Hooks: useEffect and useLayoutEffect', text: 'Effects grouped setup and cleanup by concern. No hook for snapshots was added.' },
      { yr: '2022', title: 'React 18: Strict Mode double effects, useInsertionEffect', text: 'The extra setup/cleanup cycle prepared apps for reusable state (Offscreen/Activity).' },
      { yr: '2025', title: '`<Activity>` stable in React 19.2', text: 'Hidden subtrees keep state but unmount effects — exactly why effects must clean up properly.' },
    ],
    alts: { cols: ['Need', 'Old (class)', 'Hooks', 'Often better'], rows: [['Subscribe / connect', 'componentDidMount + WillUnmount', 'useEffect + cleanup', 'useSyncExternalStore for stores'], ['Fetch data', 'componentDidMount', 'useEffect', 'Framework loaders, RSC, TanStack Query'], ['Measure before paint', 'componentDidUpdate', 'useLayoutEffect', 'CSS (anchor positioning, Floating UI)'], ['Snapshot before DOM change', 'getSnapshotBeforeUpdate', '— (handler + ref)', 'CSS scroll anchoring']] },
  },
  quiz: [
    { q: 'Which runs before the browser paints?', o: ['useEffect', 'useLayoutEffect', 'both always', 'neither'], a: 1, why: 'Layout effects run in commit before paint.' },
    { q: '`getSnapshotBeforeUpdate` runs…', o: ['before render', 'after render, before DOM mutation', 'after paint', 'on unmount'], a: 1, why: 'In the before-mutation sub-phase.' },
    { q: 'Reading `scrollHeight` inside useLayoutEffect returns…', o: ['the old height', 'the new height after mutation', 'zero', 'a promise'], a: 1, why: 'The DOM has already been mutated.' },
    { q: 'An effect without cleanup that subscribes will, in Strict Mode dev…', o: ['subscribe once', 'subscribe twice', 'throw', 'never run'], a: 1, why: 'setup → (no) cleanup → setup.' },
  ],
  cheat: `<h3>Commit timeline</h3><p>render → <b>before mutation</b> (getSnapshotBeforeUpdate) → <b>mutation</b> (DOM) → <b>layout</b> (refs, useLayoutEffect, didMount/didUpdate) → <b>paint</b> → <b>passive</b> (useEffect)</p>
  <h3>Pick one</h3><table class="t"><tr><td>compute from props/state</td><td>in render (no effect)</td></tr><tr><td>respond to a user action</td><td>event handler</td></tr><tr><td>sync with external system</td><td>useEffect + cleanup</td></tr><tr><td>measure + fix before paint</td><td>useLayoutEffect (keep tiny)</td></tr><tr><td>CSS-in-JS rule injection</td><td>useInsertionEffect</td></tr></table>
  <h3>Scroll-preserve formula</h3><p><code>snapshot = scrollHeight − scrollTop</code> (before) → <code>scrollTop = scrollHeight − snapshot</code> (after, before paint).</p>`,
};
