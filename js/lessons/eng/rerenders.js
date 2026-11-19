import { n, e, f, z, merge, tree } from '../../engine/build.js';

// R = rendered (active), S = skipped (ok), X = not involved (dim)
const st = (m) => ({ R: 'active', S: 'ok', X: 'dim', U: 'upd' })[m] || '';
const appTree = (s = {}, sub = {}, badge = {}) => tree({ id: 'App', label: 'App', sub: sub.App ?? 'state: count', state: st(s.App), badge: badge.App, kids: [
  { id: 'Header', label: 'Header', sub: sub.Header, state: st(s.Header), badge: badge.Header },
  { id: 'Dash', label: 'Dashboard', sub: sub.Dash ?? 'value={count}', state: st(s.Dash), badge: badge.Dash, kids: [
    { id: 'Stats', label: 'StatsPanel', sub: sub.Stats, state: st(s.Stats), badge: badge.Stats, kids: [{ id: 'Metric', label: 'Metric', sub: sub.Metric, state: st(s.Metric), badge: badge.Metric }] },
    { id: 'Act', label: 'ActivityList', sub: sub.Act, state: st(s.Act), badge: badge.Act },
  ] },
  { id: 'Chart', label: 'ExpensiveChart', sub: sub.Chart ?? 'data={chartData}', state: st(s.Chart), badge: badge.Chart },
] }, { x: 500, y: 80, dx: 175, dy: 110, w: 160, h: 54, kind: 'react', prefix: 'c-' });

const legend = ['rendered|#7c63d0', 'skipped (bail-out)|#2f8a43', 'state changed here|#e8a33a', 'not involved|#c6bbac'];

export default {
  id: 'rerenders',
  title: 'Who re-renders? memo, context & state placement',
  level: 'Intermediate',
  minutes: 24,
  tags: ['React', 'Performance'],
  summary: 'Predict exactly which components run when state changes — parent, child, grandchild — and choose the smallest fix: move state, split components, pass children, memoize, split context, or let the React Compiler do it.',
  learn: ['A parent render calls its children by default', 'When `React.memo` skips — and why new objects defeat it', 'Context consumers bypass memo', 'State colocation and the children trick', 'Measure first: Profiler + Performance panel'],
  steps: [
    {
      short: 'Default behaviour', title: 'When a component renders, everything it returns renders too', tag: 'concept', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'R', Stats: 'R', Metric: 'R', Act: 'R', Chart: 'R' }, {}, { App: 'setCount' })),
      body: [
        '`App` owns `count`. When it changes, React calls `App()` again. `App` returns elements for `Header`, `Dashboard` and `ExpensiveChart`, so React calls those too — and so on down the tree. By default, <b>a render cascades to every descendant</b>, whether or not their props changed.',
        'This is by design: React does not deep-compare props, because for most components rendering is cheap and comparison would cost more. The DOM only changes where output actually differs.',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: `
function Metric({ value }) { console.log('Metric'); return <strong>{value}</strong>; }
function StatsPanel({ value }) { console.log('StatsPanel'); return <section><Metric value={value} /></section>; }
function Dashboard({ value }) { console.log('Dashboard'); return <><StatsPanel value={value} /><ActivityList /></>; }

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <>
      <Header />
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Dashboard value={count} />
      <ExpensiveChart data={chartData} />
    </>
  );
}
// click → App, Header, Dashboard, StatsPanel, Metric, ActivityList, ExpensiveChart all log`, hl: [6, 10, 11, 12] },
    },
    {
      short: 'Unchanged props', title: 'Same props don’t stop a re-render', tag: 'concept', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'R', Stats: 'R', Metric: 'R', Act: 'R', Chart: 'R' }, { Header: 'no props', Chart: 'same data — still runs' }, { Chart: '120 ms' })),
      body: [
        '`Header` takes no props and `ExpensiveChart` gets the exact same `chartData` array — yet both run again. Without a memo boundary, React does not check props before calling a child.',
        'Usually harmless. It becomes a problem when one of those children is genuinely expensive (here the chart takes 120 ms) and the parent updates often, such as on every keystroke.',
      ],
      callout: { kind: 'insight', text: 'Re-render ≠ DOM update. Header re-ran, produced identical output, and caused zero DOM writes. The cost is only the JavaScript time to run it and diff the result.' },
    },
    {
      short: 'React.memo', title: 'React.memo lets a child skip when its props are equal', tag: 'code', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'R', Stats: 'R', Metric: 'R', Act: 'R', Chart: 'S' }, { Chart: 'memo · props equal → skip' }, { Chart: '0 ms' })),
      body: [
        'Wrapping a component in [[memo|`memo`]] adds a check before React calls it: compare each prop with the previous render using `Object.is` (a shallow comparison). If all are equal, React reuses the previous result and skips the <b>whole subtree</b> under it.',
        'The chart now skips when only `count` changes. It still renders when its own state changes, when a context it reads changes, or when `chartData` is a different array.',
      ],
      code: { file: 'ExpensiveChart.jsx', lang: 'jsx', src: `
import { memo } from 'react';

const ExpensiveChart = memo(function ExpensiveChart({ data }) {
  // heavy work: 10,000 points → SVG paths
  return <svg>{toPaths(data)}</svg>;
});

// Optional custom comparison (rarely needed — easy to get wrong):
// memo(Component, (prev, next) => prev.data.version === next.data.version)`, hl: [3] },
    },
    {
      short: 'Memo defeated', title: 'New objects and functions defeat memo', tag: 'scenario', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'R', Stats: 'R', Metric: 'R', Act: 'R', Chart: 'R' }, { Chart: 'memo, but options={{…}} is new' }, { Chart: 'memo missed' })),
      body: [
        '`{ sort: "asc" }` written inline creates a <b>new object every render</b>. `() => save(id)` creates a new function every render. `Object.is` sees a different reference, so memo decides the props changed and renders anyway — you paid for the comparison and got nothing.',
        'Same trap with `data={items.filter(...)}`, `style={{...}}` and `{...spread}` of fresh objects.',
      ],
      code: { file: 'Page.jsx', lang: 'jsx', src: `
function Page({ chartData }) {
  const [count, setCount] = useState(0);
  return (
    <ExpensiveChart
      data={chartData}
      options={{ sort: 'asc' }}            // ❌ new object each render
      onPointClick={(p) => select(p.id)}   // ❌ new function each render
    />
  );
}`, hl: [6, 7] },
    },
    {
      short: 'Stable references', title: 'Stabilize references with useMemo / useCallback — when it matters', tag: 'code', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'R', Stats: 'R', Metric: 'R', Act: 'R', Chart: 'S' }, { Chart: 'memo + stable props → skip' })),
      body: [
        'Move constants out of the component, and wrap computed objects in `useMemo` and callbacks in `useCallback` so they keep the same reference until their dependencies change. Now memo can actually skip.',
        'These hooks are tools to <b>enable</b> a skip (or to keep an effect from re-running), not a general speed-up. Wrapping everything adds memory, comparisons and noise. With the React Compiler enabled, most of this is done for you automatically.',
      ],
      code: { file: 'Page.jsx', lang: 'jsx', src: `
const OPTIONS = { sort: 'asc' };               // ✅ constant: created once

function Page({ chartData }) {
  const [count, setCount] = useState(0);
  const onPointClick = useCallback((p) => select(p.id), []);       // ✅ same fn
  const visible = useMemo(() => chartData.filter(isVisible), [chartData]); // ✅ same array

  return <ExpensiveChart data={visible} options={OPTIONS} onPointClick={onPointClick} />;
}`, hl: [1, 5, 6] },
    },
    {
      short: 'Own state', title: 'A child’s own state change doesn’t re-render its parent', tag: 'concept', legend,
      scene: merge(appTree({ App: 'X', Header: 'X', Dash: 'X', Stats: 'U', Metric: 'R', Act: 'X', Chart: 'X' }, { Stats: 'setTab("week")' }, { Stats: 'own state' })),
      body: [
        'When `StatsPanel` updates its own state, React starts the render at StatsPanel. Its parent `Dashboard`, its sibling `ActivityList` and the rest of the app are untouched; only StatsPanel and its descendants run.',
        'This is the key to the cheapest optimization of all: <b>keep state as low in the tree as possible</b>, close to the components that use it.',
      ],
    },
    {
      short: 'Context fan-out', title: 'Context: every consumer re-renders, memo or not', tag: 'internals', legend,
      scene: merge(appTree({ App: 'U', Header: 'R', Dash: 'S', Stats: 'S', Metric: 'R', Act: 'S', Chart: 'R' }, { App: '<AppContext value={{…}}>', Header: 'useContext(App) · theme', Metric: 'useContext(App) · user', Chart: 'memo · useContext(App)' }, { Header: 'consumer', Metric: 'consumer', Chart: 'consumer' }), { nodes: [n('note', 500, 470, 'a new notification → value object changes → all three consumers render', { kind: 'note', icon: false })] }),
      body: [
        'A component that reads a [[context]] subscribes to its value. When the provider’s value changes (by `Object.is`), React finds every consumer below it and re-renders them — even inside memoized components, and even if the consumer only uses an unrelated field of the value.',
        'A common trap: one big `AppContext` holding user, theme and notifications. Every new notification re-renders everything that reads the theme.',
      ],
      code: { file: 'AppProvider.jsx', lang: 'jsx', src: `
const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  // ❌ new object every render; any change notifies ALL consumers
  const value = { user, theme, notifications, setTheme, setNotifications };
  return <AppContext value={value}>{children}</AppContext>;   // React 19 syntax
}`, hl: [8, 9] },
    },
    {
      short: 'Split & colocate', title: 'Split contexts and move state down', tag: 'code', legend,
      scene: merge(appTree({ App: 'X', Header: 'X', Dash: 'X', Stats: 'X', Metric: 'R', Act: 'X', Chart: 'X' }, { Header: 'ThemeContext', Metric: 'NotificationContext', Chart: 'ThemeContext' }, { Metric: 'only consumer' })),
      body: [
        'Split context by <b>responsibility and update frequency</b>: theme changes rarely, notifications constantly. Now a new notification only re-renders components that read `NotificationContext`. Memoize the provider value when it is an object (`useMemo`), and consider separate contexts for state and setters.',
        'For high-frequency global state (cursor positions, live prices) use a store with selector subscriptions — Zustand, Redux, Jotai, or `useSyncExternalStore` — so components re-render only when the slice they select changes.',
      ],
      code: { file: 'providers.jsx', lang: 'jsx', src: `
const ThemeContext = createContext('light');
const NotificationContext = createContext([]);

function Providers({ children }) {
  const [theme, setTheme] = useState('light');
  const [items, setItems] = useState([]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  return (
    <ThemeContext value={themeValue}>
      <NotificationContext value={items}>{children}</NotificationContext>
    </ThemeContext>
  );
}

// store with selector: re-render only when THIS slice changes
const unread = useStore(s => s.notifications.filter(n => !n.read).length);`, hl: [1, 2, 7, 16] },
    },
    {
      short: 'children trick', title: 'Composition: pass expensive parts as children', tag: 'code',
      scene: { nodes: [
        n('pg', 220, 120, 'Page', { kind: 'react', sub: 'creates <ExpensiveReport/> element', state: 'dim' }),
        n('sh', 560, 120, 'ToggleShell', { kind: 'react', sub: 'state: open', state: 'upd', badge: 'setOpen' }),
        n('as', 450, 270, '<aside>', { kind: 'dom', icon: false, mono: true, state: 'active' }),
        n('rep', 700, 270, '{children} = ExpensiveReport', { kind: 'react', mono: true, state: 'ok', badge: 'same element → skipped' }),
      ], edges: [e('pg', 'sh', 'children'), e('sh', 'as'), e('sh', 'rep')] },
      body: [
        'Here `ToggleShell` owns the `open` state but receives the expensive report as `children`. The `<ExpensiveReport />` element was created by `Page`, which did not re-render. When ToggleShell re-renders, `children` is the <b>very same element object</b> as last time, so React can skip it — no memo needed.',
        'Pattern: when a parent needs a bit of state, pull that state into a small wrapper component and pass the heavy parts through as `children` (or other element props).',
      ],
      code: { file: 'ToggleShell.jsx', lang: 'jsx', src: `
function ToggleShell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setOpen(o => !o)}>Filters</button>
      {open && <aside>…filters…</aside>}
      {children}                {/* created by Page → unchanged → skipped */}
    </section>
  );
}

function Page() {
  return (
    <ToggleShell>
      <ExpensiveReport id="annual" />
    </ToggleShell>
  );
}`, hl: [7, 15] },
    },
    {
      short: 'React Compiler', title: 'React Compiler: automatic memoization at build time', tag: 'concept',
      scene: { nodes: [
        n('src', 180, 200, 'your components', { kind: 'code', sub: 'plain code, no useMemo' }),
        n('rc', 500, 200, 'React Compiler', { kind: 'build', sub: 'Babel/SWC plugin', state: 'active' }),
        n('out', 820, 200, 'memoized output', { kind: 'react', sub: 'caches JSX, values, callbacks' }),
        n('rule', 500, 360, 'only if your code follows the Rules of React', { kind: 'note', icon: false }),
      ], edges: [e('src', 'rc'), e('rc', 'out'), e('rc', 'rule', '', { style: 'dashed', dir: 'none' })], flows: [f('src>rc', 'JSX', { kind: 'code', every: 2.4 }), f('rc>out', 'memo', { kind: 'react', every: 2.4, delay: 1 })] },
      body: [
        'React Compiler (1.0 in 2025) analyzes components at build time and inserts fine-grained caching automatically — roughly what careful `memo` + `useMemo` + `useCallback` would do, without you writing them. It works with Vite, Next.js and others through a Babel/SWC plugin.',
        'It does not change what <i>must</i> update: state changes still render, context consumers still update, a 20,000-row table still has 20,000 rows of DOM. It also requires pure components and immutable updates — impure code is skipped or behaves unexpectedly, which is another reason for the rules in lesson 3.',
      ],
    },
    {
      short: 'Method', title: 'The method: predict, measure, apply the smallest fix', tag: 'concept',
      scene: { h: 420, nodes: [
        n('s1', 120, 110, 'Slow interaction', { kind: 'user', icon: false }), n('s2', 330, 110, 'Profile it', { kind: 'search', icon: false, sub: 'React Profiler + Performance' }), n('s3', 570, 110, 'Find the cause', { kind: 'cpu', icon: false, sub: 'render · calc · DOM · layout' }), n('s4', 820, 110, 'Smallest fix', { kind: 'build', icon: false }),
        n('f1', 820, 210, '1 colocate state', { kind: 'note', icon: false }), n('f2', 820, 270, '2 split / children', { kind: 'note', icon: false }), n('f3', 820, 330, '3 memo + stable props', { kind: 'note', icon: false }), n('f4', 820, 390, '4 virtualize · worker', { kind: 'note', icon: false }),
        n('m', 450, 300, 'measure again', { kind: 'search', icon: false, state: 'ok' }),
      ], edges: [e('s1', 's2'), e('s2', 's3'), e('s3', 's4'), e('s4', 'f1', '', { dir: 'none' }), e('f4', 'm', '', { bend: 30 })] },
      body: [
        'For any component ask: (1) Is it still the same type, key and position? (2) Did its parent render? (3) Is there a memo boundary that can bail out? (4) Did its own state change? (5) Did a context or store it reads change? (6) Does it receive a new object or function prop?',
        'Then measure. The React DevTools Profiler shows which components rendered, why, and how long they took. The browser Performance panel shows whether time actually went to JavaScript, style/layout or paint. A component that renders 20 times in 0.1 ms is fine; one that renders once for 300 ms is not.',
      ],
      code: { file: 'debug.jsx', lang: 'jsx', src: `
// quick, temporary tracing (remove after diagnosing)
function ProductRow({ product }) {
  console.count('ProductRow ' + product.id);
  return <div>{product.name}</div>;
}

// or measure a subtree programmatically
<Profiler id="results" onRender={(id, phase, actualMs, baseMs) => {
  console.log(id, phase, actualMs.toFixed(1) + 'ms (base ' + baseMs.toFixed(1) + ')');
}}>
  <Results />
</Profiler>`, hl: [3, 8, 9, 10] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'When a parent re-renders, do its children re-render?', a: ['By default yes: React calls every component the parent returns, recursively, regardless of whether props changed. Exceptions: a child wrapped in `memo` with equal props, and elements passed in from above (like `children`) that are the same object as last time.'], follow: ['Does that mean the DOM changes?'] },
    { lvl: 'M', q: 'Why does `React.memo` sometimes not work?', a: ['Its default comparison is shallow (`Object.is` per prop). Inline objects, arrays and functions are new references every render, so props never look equal. Fix with constants, `useMemo`/`useCallback`, passing primitives, or the React Compiler. Memo also does not block re-renders from the component’s own state or the contexts it reads.'] },
    { lvl: 'M', q: 'How does context affect re-renders, and how do you limit it?', a: ['Every consumer of a context re-renders when the provider’s value changes, bypassing memo. Limit by splitting contexts by concern and update frequency, memoizing object values, separating state from setters, moving providers lower, or using a store with selector subscriptions for fast-changing data.'] },
    { lvl: 'M', q: 'What is state colocation and why is it the first optimization to try?', a: ['Keeping state in the lowest component that needs it. Updates then start lower in the tree, so fewer components render. It needs no memoization, adds no complexity and often fixes the problem completely.'] },
    { lvl: 'S', q: 'Would you wrap every component in memo? What does React Compiler change?', a: ['No. Memo costs memory and comparisons and fails silently with unstable props; apply it where profiling shows expensive renders with stable props. React Compiler automates fine-grained memoization at build time, so most manual `useMemo`/`useCallback`/`memo` becomes unnecessary — but architecture issues (state too high, giant contexts, huge DOM) remain yours.'] },
    { lvl: 'S', q: 'A page re-renders 50 components per keystroke. Walk me through your approach.', a: ['Reproduce and record with React Profiler to see what renders and why; check the Performance panel to confirm the time is React work. Then: colocate the input state, extract the expensive parts or pass them as children, split context if a provider is the trigger, memoize expensive leaf components with stable props, use `useDeferredValue`/transition for results, virtualize long lists, and re-measure.'] },
  ],
  scenarios: [
    { title: 'Typing in a search box re-renders the whole dashboard', sit: '`query` state lives in `App`; the header, sidebar, charts and grid all sit under App.', steps: [['x', 'Each keystroke renders every component in the app.'], ['g', 'Moving `query` into a `SearchExperience` component (input + results) leaves the rest untouched.']], fix: 'Colocate state; then memo the results list if still needed.' },
    { title: 'memo on a row component does nothing', sit: '`<Row user={{...u}} onSelect={() => pick(u.id)} />` inside a map.', steps: [['x', 'Fresh spread object and arrow function on every render → props never equal.']], fix: 'Pass `user={u}` (stable item), and a stable `onSelect` via `useCallback` that takes the id.' },
  ],
  history: {
    timeline: [
      { yr: '2015', title: 'PureComponent & shouldComponentUpdate', text: 'Class components could skip renders with a manual or shallow comparison.' },
      { yr: '2018', title: 'React.memo (16.6) and the new Context API (16.3)', text: 'memo brought shallow-compare to function components; createContext replaced the legacy context.' },
      { yr: '2019', title: 'useMemo / useCallback', text: 'Hooks for stable values and functions; widely over-used.' },
      { yr: '2021', title: 'useSyncExternalStore', text: 'An official way for stores (Redux, Zustand) to support selector subscriptions safely in concurrent React.' },
      { yr: '2025', title: 'React Compiler 1.0', text: 'Automatic memoization at build time; manual memoization becomes the exception.', c: 'g' },
    ],
    alts: { cols: ['Tool', 'Best for'], rows: [['State colocation', 'First fix, zero cost'], ['children / element props', 'Isolating a stateful wrapper from heavy content'], ['memo + stable props', 'Expensive components under frequently-updating parents'], ['Split context', 'Global values with different update rates'], ['Zustand / Redux / Jotai selectors', 'High-frequency shared state'], ['Virtualization (TanStack Virtual)', 'Thousands of rows'], ['React Compiler', 'Automatic memoization across the app']] },
  },
  quiz: [
    { q: 'A memoized child reads a context whose value changed. It…', o: ['skips', 're-renders', 'unmounts', 'throws'], a: 1, why: 'Context subscriptions bypass memo’s prop check.' },
    { q: '`<Chart options={{ a: 1 }} />` with memo will…', o: ['skip when the parent renders', 'render every time the parent renders', 'never render', 'only render on mount'], a: 1, why: 'A new object every render fails `Object.is`.' },
    { q: 'A child updates its own state. Its parent…', o: ['re-renders', 'does not re-render', 'unmounts', 're-mounts'], a: 1, why: 'Updates start at the component that owns the state.' },
    { q: 'The cheapest first optimization is usually…', o: ['memo everything', 'move state down', 'useCallback everywhere', 'class components'], a: 1, why: 'Colocation reduces the update scope with no extra machinery.' },
  ],
  cheat: `<h3>Why did it render?</h3><ol><li>its own state changed</li><li>its parent rendered (and no memo bail-out)</li><li>a context it reads changed</li><li>an external store it subscribes to changed</li></ol>
  <h3>Fix ladder</h3><ol><li>Colocate state</li><li>Split components / pass <code>children</code></li><li><code>memo</code> + stable props (<code>useMemo</code>, <code>useCallback</code>) — or React Compiler</li><li>Split context / selector store</li><li>Transitions, virtualization, workers</li></ol>
  <p><b>Always:</b> measure with React Profiler + Performance panel before and after.</p>`,
};
