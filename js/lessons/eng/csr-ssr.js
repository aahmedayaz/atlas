import { n, e, f, z, merge, tree } from '../../engine/build.js';

// actors laid out left → right
const A = {
  br: (o = {}) => n('br', 130, 250, 'Browser', { kind: 'browser', sub: 'your tab', ...o }),
  cdn: (o = {}) => n('cdn', 420, 250, 'Vercel Edge', { kind: 'cdn', sub: 'nearest city · files', ...o }),
  fn: (o = {}) => n('fn', 670, 250, 'Function', { kind: 'func', sub: 'Node.js · region iad1', ...o }),
  db: (o = {}) => n('db', 895, 250, 'Database / API', { kind: 'db', sub: 'Postgres · REST', ...o }),
  api: (o = {}) => n('api', 760, 250, 'Your API', { kind: 'server', sub: 'any backend · JSON', ...o }),
};
const screen = (label, state) => n('scr', 130, 420, label, { kind: 'eye', icon: false, mono: true, state, w: 220 });

export default {
  id: 'csr-ssr',
  title: 'CSR vs SSR on Vercel — and hydration',
  level: 'Intermediate',
  minutes: 26,
  tags: ['React', 'Next.js', 'Vercel'],
  summary: 'Follow a real request for a client-rendered React app and for a server-rendered Next.js page: what is stored on Vercel, what crosses the network in which form, when the screen shows content, and how hydration makes server HTML interactive.',
  learn: ['What Vercel stores for CSR vs SSR', 'The CSR waterfall: HTML → JS → data', 'SSR: Function renders HTML per request', 'Hydration step by step, and the “hydration gap”', 'Hydration mismatches and how to avoid them'],
  steps: [
    {
      short: 'CSR on Vercel', title: 'CSR: Vercel is only a file cabinet', tag: 'concept',
      scene: { zones: [z('v', 290, 60, 680, 400, 'Vercel', 'cdn')], nodes: [
        A.br(), n('cdn', 470, 150, 'Edge Network (CDN)', { kind: 'cdn', sub: 'static files in many cities', state: 'active' }),
        n('f1', 420, 270, 'index.html', { kind: 'html', mono: true, sub: 'empty <div id="root">' }), n('f2', 420, 350, 'index-3f9a.js', { kind: 'js', mono: true, sub: 'all components + React' }), n('f3', 420, 430, 'index-77ab.css · images', { kind: 'css', mono: true }),
        n('nf', 790, 300, 'No Functions', { kind: 'func', state: 'dim', sub: 'no server code runs' }),
      ], edges: [e('cdn', 'f1', '', { dir: 'none' })] },
      body: [
        'With [[csr]] (a Vite or Create React App build), Vercel stores only the static output of `npm run build`: an almost empty `index.html`, the bundled JavaScript, CSS and media. No code of yours runs on Vercel — it is a global file host and [[cdn]].',
        'All the rendering work happens later, in the visitor’s browser.',
      ],
    },
    {
      short: 'Empty shell', title: 'CSR request 1: the HTML arrives — and the screen is blank', tag: 'internals',
      scene: { nodes: [A.br({ state: 'active' }), A.cdn(), A.api({ state: 'dim' }), screen('(blank white page)', 'bad')],
        edges: [e('br', 'cdn', 'GET /dashboard'), e('br', 'scr', '', { style: 'dashed', dir: 'none' })], flows: [f('br>cdn', 'GET', { kind: 'browser', every: 2.6, back: 'index.html' })] },
      body: [
        'The browser resolves DNS, reaches the nearest Vercel edge city, opens TLS and asks for `/dashboard`. There is no such file, but a rewrite rule serves `/index.html` instead — a [[cache]] hit, delivered in milliseconds.',
        'Its body is just `<div id="root"></div>` plus a `<script>` and a `<link>`. There is nothing to paint yet: the user sees a white page.',
      ],
      code: { file: 'dist/index.html', lang: 'html', src: `
<!doctype html>
<html>
  <head>
    <script type="module" src="/assets/index-3f9a.js"></script>
    <link rel="stylesheet" href="/assets/index-77ab.css">
  </head>
  <body>
    <div id="root"></div>   <!-- empty: nothing to show -->
  </body>
</html>

// vercel.json — so deep links like /dashboard don't 404 on refresh
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`, hl: [8, 13] },
    },
    {
      short: 'Download JS', title: 'CSR request 2: download the JavaScript and CSS', tag: 'internals',
      scene: { nodes: [A.br({ state: 'active' }), A.cdn(), A.api({ state: 'dim' }), screen('(still blank)', 'bad')],
        edges: [e('br', 'cdn', 'GET /assets/*')], flows: [f('br>cdn', 'GET js', { kind: 'browser', every: 1.6, back: '150 KB' }), f('br>cdn', 'GET css', { kind: 'css', every: 1.6, delay: 0.5, back: 'css' })] },
      facts: [['HTML', '0.5 KB'], ['JS (gzip)', '~150 KB'], ['screen', 'blank']],
      body: [
        'The parser sees the `<script>` and `<link>` tags and requests both files in parallel over the same HTTP/2 connection. Because their names are hashed, they come with `Cache-Control: max-age=31536000, immutable` — next visit, they load from disk instantly.',
        'On a fast laptop this is quick. On a mid-range phone on 4G, 150 KB of compressed JavaScript can take a second to download and much longer to parse and run.',
      ],
    },
    {
      short: 'React mounts', title: 'CSR step 3: V8 runs the bundle, React builds the DOM', tag: 'internals',
      scene: merge({ nodes: [A.br({ state: 'active', sub: 'V8 → React → DOM' }), A.cdn({ state: 'dim' }), A.api({ state: 'dim' }), screen('Loading…', 'upd')] },
        tree({ id: 'root', label: 'div#root', kids: [{ id: 'app', label: 'App', kids: [{ id: 'sp', label: 'p "Loading…"' }] }] }, { x: 470, y: 120, dy: 85, w: 170, prefix: 't-', kind: 'react' })),
      facts: [['HTML', '0.5 KB'], ['JS (gzip)', '~150 KB'], ['screen', 'Loading…']],
      body: [
        '[[v8]] parses, compiles and runs the bundle on the [[main-thread]]. `createRoot(root).render(<App />)` performs React’s first render: call components, build fibers, create DOM nodes, commit them into `#root`.',
        'App has no data yet, so the first paint is a spinner or “Loading…”. Then React runs its effects — and that is where the data request finally starts.',
      ],
      code: { file: 'App.jsx', lang: 'jsx', src: `
function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {                         // runs AFTER the first paint
    fetch('/api/user').then(r => r.json()).then(setUser);
  }, []);
  if (!user) return <p>Loading…</p>;        // first paint
  return <h1>Hi {user.name}</h1>;            // after data arrives
}`, hl: [4, 5, 7] },
    },
    {
      short: 'Fetch data', title: 'CSR step 4: fetch data, re-render — the waterfall', tag: 'internals',
      scene: { nodes: [A.br({ state: 'active' }), A.cdn({ state: 'dim' }), A.api({ state: 'active' }), screen('Hi Sara ✓', 'ok'),
        n('w1', 330, 470, 'HTML', { kind: 'html', icon: false, w: 90, h: 34 }), n('w2', 470, 470, 'JS', { kind: 'js', icon: false, w: 110, h: 34 }), n('w3', 620, 470, 'run', { kind: 'cpu', icon: false, w: 90, h: 34 }), n('w4', 770, 470, 'data', { kind: 'server', icon: false, w: 110, h: 34 })],
        edges: [e('br', 'api', 'fetch /api/user', { bend: -40 }), e('w1', 'w2'), e('w2', 'w3'), e('w3', 'w4')], flows: [f('br>api', 'GET', { kind: 'browser', every: 2.4, back: '{json}', backKind: 'server' })] },
      facts: [['round trips', '3 in a row'], ['first content', 'after JS + data'], ['SEO', 'empty div first']],
      body: [
        'The `useEffect` sends `GET /api/user`; JSON comes back; `setUser` triggers a re-render, a diff, a commit — and finally the real content is painted.',
        'Each stage could only start after the previous one finished: HTML → JS → execute → data. That chain is a [[waterfall]]. CSR is still a great fit for dashboards behind a login and internal tools, where SEO does not matter and users return often (cached JS).',
      ],
      interview: 'Ways to shorten the CSR waterfall: code-split routes, `<link rel="preload">` critical data or start fetching in the router before rendering, cache API responses — or render on the server.',
    },
    {
      short: 'SSR on Vercel', title: 'SSR: Vercel becomes a compute engine', tag: 'concept',
      scene: { zones: [z('v', 290, 60, 680, 400, 'Vercel', 'cdn')], nodes: [
        A.br(), n('cdn', 470, 150, 'Edge Network (CDN)', { kind: 'cdn', sub: 'client JS chunks · CSS · images' }),
        n('fn', 470, 330, 'Vercel Functions', { kind: 'func', sub: 'your page components + data code', state: 'active' }),
        n('db', 830, 330, 'Database', { kind: 'db', sub: 'same region' }),
      ], edges: [e('cdn', 'fn', 'dynamic routes', { style: 'dashed' }), e('fn', 'db')] },
      body: [
        'With [[ssr]] in Next.js, the build produces two layers. Client JavaScript chunks, CSS and images still go to the CDN. But the page components and their data-fetching code are also compiled into [[serverless|Functions]] that wait, idle, for requests.',
        'Instead of an empty shell, the server will send <b>finished HTML made for this request</b>.',
      ],
    },
    {
      short: 'Function renders', title: 'SSR step 1: the request runs your React code on the server', tag: 'internals',
      scene: { nodes: [A.br(), A.cdn(), A.fn({ state: 'active' }), A.db(), screen('(waiting for HTML)', '')],
        edges: [e('br', 'cdn', 'GET /account + cookie'), e('cdn', 'fn', 'dynamic route'), e('fn', 'db', 'SELECT user')],
        flows: [f('br>cdn', 'GET', { kind: 'browser', every: 3, once: false }), f('cdn>fn', 'req', { kind: 'cdn', every: 3, delay: 0.8 }), f('fn>db', 'query', { kind: 'func', every: 3, delay: 1.6, back: 'row', backKind: 'db' })] },
      body: [
        'The edge router sees `/account` is dynamic (it reads cookies), so there is no cached HTML. It forwards the request to the Function. If no instance is warm, a [[cold-start]] boots Node.js and loads your server bundle first.',
        'Next.js runs the page component on Vercel’s machine. It can talk to the database directly — usually in the same region, so the query is fast — and wait for the result.',
      ],
      code: { file: 'app/account/page.jsx', lang: 'jsx', src: `
import { cookies } from 'next/headers';

export default async function Account() {
  // reading cookies makes this route dynamic → rendered per request
  const session = (await cookies()).get('session')?.value;
  const user = await db.user.findBySession(session);   // runs on the server
  return <h1>Welcome back, {user.name}</h1>;
}

// Pages Router equivalent:
// export async function getServerSideProps({ req }) { … return { props: { user } } }`, hl: [5, 6, 7] },
    },
    {
      short: 'HTML arrives', title: 'SSR step 2: full HTML arrives and paints immediately', tag: 'internals',
      scene: { nodes: [A.br({ state: 'active' }), A.cdn(), A.fn(), A.db({ state: 'dim' }), screen('Welcome back, Sara', 'ok')],
        edges: [e('fn', 'cdn', ''), e('cdn', 'br', 'full HTML')], flows: [f('fn>cdn', 'html', { kind: 'func', every: 2.6 }), f('cdn>br', '<h1>…', { kind: 'html', every: 2.6, delay: 0.8 })] },
      facts: [['first content', 'with the HTML'], ['interactive?', 'not yet'], ['SEO', 'full text']],
      body: [
        'React renders the tree to an HTML string on the server (`renderToReadableStream`), embeds the data the client will need, and the response streams back through the edge — usually `Cache-Control: private, no-store`, because it belongs to this user.',
        'The browser can paint real content as soon as the HTML and CSS arrive, before any JavaScript. Crawlers get the full text. But the button on the page does nothing yet.',
      ],
      code: { file: 'response (simplified)', lang: 'html', src: `
<html><body>
  <div id="__next"><h1>Welcome back, Sara</h1><button>Edit</button></div>

  <!-- App Router: RSC payload for React to pick up -->
  <script>self.__next_f.push([1, "0:[\\"$\\",\\"h1\\",null,…]"])</script>
  <!-- Pages Router: JSON props -->
  <script id="__NEXT_DATA__">{"props":{"pageProps":{"user":{"name":"Sara"}}}}</script>

  <script src="/_next/static/chunks/app/account/page-9c1f.js" async></script>
</body></html>`, hl: [2, 5, 9] },
    },
    {
      short: 'Hydrate', title: 'SSR step 3: download JS from the CDN, then hydrate', tag: 'internals',
      scene: merge({ nodes: [A.br({ state: 'active' }), A.cdn({ state: 'active' }), A.fn({ state: 'dim' }), A.db({ state: 'dim' }), screen('Welcome back, Sara  [Edit ✓]', 'ok')],
        edges: [e('br', 'cdn', 'GET chunks')], flows: [f('br>cdn', 'GET js', { kind: 'browser', every: 2.2, back: 'chunks', backKind: 'js' })] }),
      body: [
        'The JavaScript still comes from the <b>CDN</b>, not from the Function — only the HTML was rendered per request. When it arrives, React calls `hydrateRoot` instead of `createRoot`: “the DOM already exists, adopt it”.',
        'The time between “content visible” and “content interactive” is the <b>hydration gap</b>. Clicks during it are queued or lost, which is why shipping less client JavaScript matters even with SSR.',
      ],
      code: { file: 'what Next.js does for you', lang: 'jsx', src: `
// CSR: build the DOM from nothing
createRoot(container).render(<App />);

// SSR: reuse the server's DOM, attach behaviour
hydrateRoot(container, <App />);`, hl: [5] },
    },
    {
      short: 'Inside hydration', title: 'Inside hydration: match fibers to existing DOM nodes', tag: 'internals',
      scene: merge(
        tree({ id: 'r', label: 'HostRoot', kids: [{ id: 'a', label: 'Account', kids: [{ id: 'h', label: 'h1', state: 'ok' }, { id: 'b', label: 'button', state: 'active' }] }] }, { x: 260, y: 110, dy: 95, w: 130, prefix: 'f-', kind: 'fiber' }),
        tree({ id: 'r', label: 'div#__next', kids: [{ id: 'h', label: '<h1> (server)', state: 'ok' }, { id: 'b', label: '<button> (server)', state: 'active' }] }, { x: 760, y: 205, dy: 95, w: 170, prefix: 'd-', kind: 'dom' }),
        { zones: [z('zf', 40, 60, 430, 400, 'fibers being built', 'fiber'), z('zd', 540, 60, 430, 400, 'existing server DOM', 'dom')],
          edges: [e('f-h', 'd-h', 'reuse', { style: 'dashed', kind: 'cdn' }), e('f-b', 'd-b', 'reuse + listen', { style: 'dashed', kind: 'cdn' })],
          nodes: [n('del', 500, 470, 'one listener per event type on the root → onClick works', { kind: 'note', icon: false })] },
      ),
      body: [
        'React renders the components in memory exactly as on the server, and walks the existing DOM side by side. For each host fiber it checks that the next DOM node has the same tag; if so it <b>reuses</b> it (`fiber.stateNode = existingNode`). No `createElement`, no layout change.',
        'Event listeners are attached once at the root ([[event-delegation]]), and the `onClick` handlers live on the fibers. From now on, updates work exactly like the client pipeline in lesson 3.',
      ],
    },
    {
      short: 'Mismatch', title: 'Hydration mismatch: when server and browser disagree', tag: 'scenario',
      scene: { nodes: [
        n('s', 230, 160, 'server render · 10:00:01', { kind: 'func', mono: true }), n('c', 770, 160, 'browser render · 10:00:03', { kind: 'browser', mono: true }),
        n('sh', 230, 290, '<p>10:00:01</p>', { kind: 'html', mono: true, icon: false }), n('ch', 770, 290, '<p>10:00:03</p>', { kind: 'react', mono: true, icon: false, state: 'bad' }),
        n('x', 500, 410, '⚠ mismatch → re-render on the client (flicker, wasted work)', { kind: 'note', icon: false, state: 'bad' }),
      ], edges: [e('s', 'sh'), e('c', 'ch'), e('sh', 'ch', '≠', { dir: 'none', style: 'dashed' })] },
      body: [
        'Hydration assumes the browser’s first render produces the same markup as the server. Values that differ by environment break that: `new Date()`, `Math.random()`, `window`/`localStorage` checks in render, locale-dependent formatting, invalid HTML nesting (a `<div>` inside a `<p>`), or browser extensions editing the page.',
        'React then logs a [[hydration-mismatch]] and re-renders that part on the client, discarding the server’s work. Render the same thing on both sides first, then change it after hydration.',
      ],
      code: { file: 'Clock.jsx', lang: 'jsx', src: `
// ❌ different on server and client
function Clock() { return <p>{new Date().toLocaleTimeString()}</p>; }

// ✅ same first render, then update in the browser
function Clock() {
  const [time, setTime] = useState(null);
  useEffect(() => setTime(new Date().toLocaleTimeString()), []);
  return <p>{time ?? '—'}</p>;
}
// for truly unavoidable differences: <p suppressHydrationWarning>…</p>`, hl: [2, 6, 7, 8] },
    },
    {
      short: 'Compare', title: 'CSR vs SSR side by side', tag: 'concept',
      scene: { nodes: [
        n('c0', 260, 70, 'CSR (React + Vite)', { kind: 'browser', icon: false, w: 330 }), n('s0', 740, 70, 'SSR (Next.js)', { kind: 'func', icon: false, w: 330 }),
        n('c1', 260, 150, 'Vercel: static file host', { kind: 'note', icon: false, w: 330 }), n('s1', 740, 150, 'Vercel: CDN + Functions', { kind: 'note', icon: false, w: 330 }),
        n('c2', 260, 230, '1st payload: empty <div id="root">', { kind: 'note', icon: false, w: 330 }), n('s2', 740, 230, '1st payload: full HTML', { kind: 'note', icon: false, w: 330, state: 'ok' }),
        n('c3', 260, 310, 'data: fetched in the browser', { kind: 'note', icon: false, w: 330 }), n('s3', 740, 310, 'data: fetched on the server', { kind: 'note', icon: false, w: 330 }),
        n('c4', 260, 390, 'browser builds the DOM', { kind: 'note', icon: false, w: 330 }), n('s4', 740, 390, 'browser hydrates the DOM', { kind: 'note', icon: false, w: 330 }),
      ] },
      body: [
        '<table class="t"><tr><th></th><th>CSR</th><th>SSR</th></tr><tr><td>First content</td><td>after JS + data</td><td>with the HTML</td></tr><tr><td>Server cost</td><td>none (static)</td><td>a Function per request</td></tr><tr><td>SEO / link previews</td><td>weak</td><td>strong</td></tr><tr><td>TTFB</td><td>very fast (CDN)</td><td>slower (render + data)</td></tr><tr><td>Best for</td><td>apps behind login</td><td>personal, fresh, public pages</td></tr></table>',
        'SSR is not free: every request costs compute, and the user still downloads JavaScript to hydrate. The next lesson shows strategies that keep SSR’s benefits with less cost: SSG, ISR, streaming, Server Components and Partial Prerendering.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'What does the browser receive first in a CSR app vs an SSR app?', a: ['CSR: a nearly empty `index.html` with a root div plus script and stylesheet links; content appears only after the JS runs and fetches data. SSR: a complete HTML document with the content already in it, plus scripts to hydrate.'] },
    { lvl: 'J', q: 'What is hydration?', a: ['React attaching to server-rendered HTML: it renders the same tree in memory, reuses the existing DOM nodes instead of creating new ones, and attaches event handling so the page becomes interactive.'], follow: ['What causes a hydration mismatch?'] },
    { lvl: 'M', q: 'Why does refreshing `/settings` in a Vite SPA on a static host return 404, and how do you fix it on Vercel?', a: ['The route exists only in the client router. A refresh asks the server for `/settings`, which has no such file. Add a rewrite of `/(.*)` to `/index.html`; Vercel serves real files first, so assets still work.'] },
    { lvl: 'M', q: 'Does SSR mean no JavaScript is sent to the browser?', a: ['No. SSR produces HTML, but interactive components still need their JavaScript to hydrate and handle events. Server Components (next lesson) are what allow server-only parts to ship zero JS.'] },
    { lvl: 'M', q: 'When would you choose CSR over SSR?', a: ['Authenticated, highly interactive apps (dashboards, editors, internal tools) where SEO is irrelevant, users return often (cached bundles), and you want simple static hosting with no server cost. Public content, marketing and SEO-sensitive pages favour SSR/SSG.'] },
    { lvl: 'S', q: 'An SSR page has a 2 s TTFB. How do you investigate and fix it?', a: ['Check where the time goes: cold starts (function logs, region), slow or sequential data fetching (waterfalls in server code), the function being far from the database (move the region), or rendering cost. Fixes: parallelize fetches, cache data, colocate region with the DB, prerender the static parts (ISR/PPR), and stream the slow parts with Suspense.'] },
  ],
  scenarios: [
    { title: 'SEO preview shows an empty page', sit: 'Sharing a CSR product page on social media shows no title or image.', steps: [['x', 'Link-preview bots often do not run JavaScript; they see an empty root and no meta tags.']], fix: 'Render meta tags and content on the server (SSR/SSG), or prerender public routes.' },
    { title: 'Buttons ignore the first click on a slow phone', sit: 'An SSR page paints fast, but early clicks do nothing.', steps: [['', 'The HTML painted at 0.8 s.'], ['w', 'Hydration finished at 3.2 s after a large bundle loaded.'], ['x', 'Clicks in the hydration gap were not handled.']], fix: 'Ship less client JS (Server Components), split chunks, and let React prioritize hydrating what the user interacts with (selective hydration).' },
    { title: 'Logged-in user sees another user’s name', sit: 'A dynamic page was accidentally cached on a shared CDN.', steps: [['x', 'User A’s personalized HTML was stored and served to user B.']], fix: 'Never cache personalized responses publicly: `Cache-Control: private, no-store`, and keep shared parts static instead (PPR).' },
  ],
  history: {
    timeline: [
      { yr: '1995–2010', title: 'Server rendering by default', text: 'PHP, JSP, Rails and Django rendered every page on the server; JavaScript added small enhancements.' },
      { yr: '2010–2015', title: 'The SPA era', text: 'Backbone, AngularJS and then React moved rendering to the browser. Fast navigation, but blank first loads and SEO problems.' },
      { yr: '2015–2016', title: 'Universal / isomorphic React', text: '`renderToString` + hydration ran the same components on server and client. Next.js (Vercel, 2016) made it easy.', c: 'g' },
      { yr: '2022', title: 'React 18 streaming SSR', text: '`renderToPipeableStream` and selective hydration with Suspense.' },
      { yr: '2023', title: 'Next.js App Router', text: 'Server Components by default, rendering strategy chosen per route and per component.' },
    ],
    alts: { cols: ['Option', 'Rendering', 'When'], rows: [['Vite + React (SPA)', 'CSR', 'Dashboards, internal tools'], ['Next.js', 'SSR, SSG, ISR, RSC, PPR', 'Full-stack React, SEO'], ['React Router v7 (Remix)', 'SSR with loaders/actions', 'Web-standards data loading'], ['Astro', 'Static HTML + islands', 'Content sites with little JS'], ['TanStack Start', 'SSR + typed router', 'Type-safe full-stack apps']] },
  },
  quiz: [
    { q: 'In a CSR app, where are the JS chunks served from?', o: ['A Function', 'The CDN', 'The database', 'The browser cache only'], a: 1, why: 'Static assets live on the CDN for both CSR and SSR.' },
    { q: 'During hydration React…', o: ['creates all DOM nodes again', 'reuses existing DOM nodes and attaches handlers', 'downloads HTML', 'paints pixels'], a: 1, why: 'Hydration adopts the server DOM.' },
    { q: 'Which value commonly causes a hydration mismatch?', o: ['a prop from the server', '`new Date()` in render', 'a CSS class', 'a key'], a: 1, why: 'Server and client times differ.' },
    { q: 'The CSR “waterfall” is…', o: ['HTML → JS → run → data, each waiting for the previous', 'parallel downloads', 'a CDN feature', 'a database index'], a: 0, why: 'Each stage starts only after the one before.' },
  ],
  cheat: `<h3>CSR</h3><p>Vercel = static files. Browser: <code>index.html</code> (empty) → JS/CSS → <code>createRoot().render()</code> → effect fetches data → re-render → content.</p>
  <h3>SSR</h3><p>Vercel = CDN + Functions. Edge → Function runs components + DB → full HTML → paint → JS from CDN → <code>hydrateRoot</code> → interactive.</p>
  <h3>Hydration rules</h3><ul><li>First client render must match server HTML.</li><li>Move <code>Date</code>, <code>random</code>, <code>window</code> reads into effects.</li><li>Valid HTML nesting only.</li><li>Personalized SSR responses: <code>private, no-store</code>.</li></ul>`,
};
