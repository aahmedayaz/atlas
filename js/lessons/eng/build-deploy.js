import { n, e, f, z, merge } from '../../engine/build.js';

const pipe = (on) => {
  const st = [['src', 'src/*.tsx', 'code'], ['cmp', 'Compile', 'build'], ['bnd', 'Bundle + split', 'layers'], ['min', 'Minify + hash', 'file'], ['out', 'dist/', 'cdn']];
  return { nodes: st.map(([id, l, k], i) => n(id, 110 + i * 195, 80, l, { kind: k, state: on === id ? 'active' : '', mono: true })), edges: st.slice(1).map(([id], i) => e(st[i][0], id)) };
};

export default {
  id: 'build-deploy',
  title: 'npm run build → Vercel: what actually ships',
  level: 'Beginner',
  minutes: 20,
  tags: ['Tooling', 'Vercel', 'Deploy'],
  summary: 'What `npm run build` does to your code (compile, bundle, split, minify, hash), what the output folder contains, and what Vercel does between `git push` and a live URL.',
  learn: ['Dev server vs production build', 'Compile → bundle → tree-shake → split → minify → hash', 'Why hashed file names can be cached forever', 'git push → build machine → CDN + Functions', 'Atomic deploys, previews and instant rollback'],
  steps: [
    {
      short: 'Dev vs build', title: 'Two modes: the dev server and the production build', tag: 'concept',
      scene: { nodes: [
        n('dev', 250, 120, 'npm run dev', { kind: 'build', mono: true, sub: 'Vite dev server' }),
        n('d1', 250, 240, 'serves source modules on demand', { kind: 'note', icon: false }), n('d2', 250, 310, 'hot module replacement (HMR)', { kind: 'note', icon: false }), n('d3', 250, 380, 'source maps · warnings · Strict checks', { kind: 'note', icon: false }),
        n('bld', 750, 120, 'npm run build', { kind: 'build', mono: true, sub: 'Vite / Next.js production build', state: 'active' }),
        n('b1', 750, 240, 'bundled, split, minified files', { kind: 'note', icon: false }), n('b2', 750, 310, 'content-hashed names', { kind: 'note', icon: false }), n('b3', 750, 380, 'optimized for users, not for you', { kind: 'note', icon: false }),
      ], edges: [e('dev', 'd1', '', { dir: 'none' }), e('bld', 'b1', '', { dir: 'none' })] },
      body: [
        'In development, Vite serves your files almost untouched as native ES modules and transforms each one the moment the browser asks for it, so start-up is instant and edits appear without a reload (HMR). Speed of feedback is the goal.',
        'A production build is the opposite trade-off: spend time once, on the build machine, to produce the smallest, fastest, most cacheable files possible for every user.',
      ],
      code: { file: 'package.json', lang: 'json', src: `
{
  "scripts": {
    "dev": "vite",                      // local dev server + HMR
    "build": "tsc -b && vite build",    // type-check, then production build
    "preview": "vite preview"           // serve dist/ locally to test it
  }
}`, hl: [4] },
      interview: '`npm run build` runs the `build` script from package.json — here a TypeScript check followed by `vite build`. (`npm build` is a different, internal npm command.)',
    },
    {
      short: 'Compile', title: 'Compile: JSX and TypeScript become plain JavaScript', tag: 'concept',
      scene: merge(pipe('cmp'), { nodes: [n('in', 250, 260, 'const n: number = 1\n<h1>{n}</h1>', { kind: 'code', mono: true, h: 64, icon: false }), n('o', 700, 260, "const n = 1\njsx('h1', { children: n })", { kind: 'js', mono: true, h: 64, icon: false }), n('t', 470, 400, 'esbuild / SWC: ~10–100× faster than Babel', { kind: 'note', icon: false })], edges: [e('in', 'o', 'strip types · transform JSX')] }),
      body: [
        'Browsers run neither TypeScript nor [[jsx]]. The compiler strips type annotations (no type-checking — that is `tsc`’s job) and turns JSX into function calls. It can also down-level modern syntax for older browsers.',
        'Modern tools use compilers written in Go or Rust — esbuild (Vite), SWC (Next.js) — which is why builds that once took minutes now take seconds.',
      ],
    },
    {
      short: 'Bundle & split', title: 'Bundle, tree-shake and split into chunks', tag: 'internals',
      scene: merge(pipe('bnd'), { nodes: [
        n('m1', 130, 250, 'main.tsx', { kind: 'file', icon: false, mono: true }), n('m2', 130, 310, 'App.tsx', { kind: 'file', icon: false, mono: true }), n('m3', 130, 370, 'Settings.tsx', { kind: 'file', icon: false, mono: true }), n('m4', 130, 430, 'lodash (1 of 300 fns used)', { kind: 'file', icon: false, mono: true }),
        n('c1', 720, 260, 'index-3f9a.js', { kind: 'js', mono: true, sub: 'app shell + used lodash fn' }), n('c2', 720, 350, 'vendor-8d2e.js', { kind: 'js', mono: true, sub: 'react + react-dom' }), n('c3', 720, 440, 'Settings-71c0.js', { kind: 'js', mono: true, sub: 'loaded only on /settings', state: 'upd' }),
      ], edges: [e('m1', 'c1'), e('m2', 'c1'), e('m4', 'c1', 'tree-shaken'), e('m3', 'c3', 'import()')] }),
      body: [
        'Your app is hundreds of modules. A [[bundle|bundler]] (Rollup/Rolldown in Vite, Turbopack or webpack in Next.js) follows the import graph from the entry file and joins modules into a few files, so the browser makes fewer requests.',
        '[[tree-shaking|Tree-shaking]] drops exports nobody imports. <b>Code splitting</b> cuts the result into [[chunk|chunks]]: a dynamic `import()` (e.g. `React.lazy`) becomes a separate file downloaded only when that route or component is needed.',
      ],
      code: { file: 'routes.tsx', lang: 'jsx', src: `
import { lazy, Suspense } from 'react';

// becomes its own chunk: Settings-71c0.js, fetched on first visit to /settings
const Settings = lazy(() => import('./Settings'));

export function Routes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Settings />
    </Suspense>
  );
}`, hl: [4] },
    },
    {
      short: 'Minify & hash', title: 'Minify, then name files by their content', tag: 'concept',
      scene: merge(pipe('min'), { nodes: [
        n('a', 230, 270, 'function calculateSubtotal(items) {…}', { kind: 'code', mono: true, icon: false }),
        n('b', 720, 270, 'function c(t){return t.reduce(…)}', { kind: 'js', mono: true, icon: false }),
        n('h1', 230, 400, 'index-3f9a.js  (v1)', { kind: 'file', mono: true, icon: false }), n('h2', 720, 400, 'index-Q9z1.js  (v2: one line changed)', { kind: 'file', mono: true, icon: false, state: 'upd' }),
      ], edges: [e('a', 'b', '≈ 3× smaller'), e('h1', 'h2', 'new content → new name')] }),
      body: [
        '[[minify|Minification]] removes whitespace and comments and renames local variables, typically shrinking JavaScript by around two-thirds before compression (gzip or Brotli shrinks it again on the wire).',
        'Each output file gets a [[content-hash]] in its name. Same content → same name; any change → a new name. That lets servers say “cache this forever” (`max-age=31536000, immutable`): a new version can never be confused with the old one, because it is literally a different URL.',
      ],
      interview: '“How do you bust the cache after a deploy?” → you don’t need to: hashed asset names change when content changes, and only `index.html` (which references them) is revalidated on each visit.',
    },
    {
      short: 'dist/', title: 'What the build produces', tag: 'code',
      scene: merge(pipe('out'), { nodes: [
        n('ix', 250, 260, 'index.html', { kind: 'html', mono: true, sub: '≈ 0.5 KB · references the hashes' }),
        n('js', 600, 230, 'assets/index-3f9a.js', { kind: 'js', mono: true, sub: '≈ 150 KB gzipped' }), n('cs', 600, 320, 'assets/index-77ab.css', { kind: 'css', mono: true }), n('im', 600, 410, 'assets/logo-12cd.svg', { kind: 'file', mono: true }),
        n('st', 880, 320, 'static files only', { kind: 'note', icon: false, sub: 'any CDN can serve them' }),
      ], edges: [e('ix', 'js', '<script>'), e('ix', 'cs', '<link>'), e('ix', 'im', '', { style: 'dashed' })] }),
      body: [
        'For a client-rendered Vite app, `dist/` is just static files: one `index.html` that points at hashed JS and CSS, plus assets. Any static host or CDN can serve it — there is no server code at all.',
        'A Next.js build produces more: prerendered HTML for static pages, client chunks, <b>and</b> server bundles for routes that must run per request. That is where Vercel’s Functions come in.',
      ],
      code: { file: 'dist/', lang: 'tree', src: `
dist/
├── index.html                 ← tiny shell, revalidated every visit
└── assets/
    ├── index-3f9a1c.js         ← app code (hashed → cache forever)
    ├── vendor-8d2e44.js        ← react, react-dom
    ├── Settings-71c0b2.js      ← lazy route chunk
    ├── index-77ab90.css
    └── logo-12cd3e.svg` },
    },
    {
      short: 'git push → build', title: 'git push → Vercel builds it in the cloud', tag: 'concept',
      scene: { nodes: [
        n('you', 110, 150, 'You', { kind: 'user', sub: 'git push' }), n('gh', 330, 150, 'GitHub', { kind: 'git', sub: 'your repo' }),
        n('bm', 600, 150, 'Build machine', { kind: 'build', sub: 'fresh, temporary', state: 'active' }),
        n('s1', 600, 270, 'npm install', { kind: 'note', icon: false, mono: true, sub: 'cached between builds' }), n('s2', 600, 350, 'npm run build', { kind: 'note', icon: false, mono: true }), n('s3', 600, 430, '.vercel/output', { kind: 'note', icon: false, mono: true }),
        n('log', 880, 150, 'build logs', { kind: 'file' }),
      ], edges: [e('you', 'gh'), e('gh', 'bm', 'webhook'), e('bm', 's1', '', { dir: 'none' }), e('s1', 's2'), e('s2', 's3'), e('bm', 'log', '', { style: 'dashed' })], flows: [f('you>gh', 'push', { kind: 'user', every: 3 }), f('gh>bm', 'commit', { kind: 'git', every: 3, delay: 1 })] },
      body: [
        'Nothing is built on your laptop. GitHub notifies Vercel through a webhook; Vercel starts a clean, temporary build machine, clones the commit, restores the dependency cache, runs `npm install` and your build command, and writes the result in Vercel’s <b>Build Output</b> format.',
        'Every branch and pull request gets its own build and its own <b>preview URL</b>, so reviewers can click the real thing before merging.',
      ],
    },
    {
      short: 'Build Output', title: 'The output is split: files go to the CDN, server code to Functions', tag: 'internals',
      scene: { nodes: [
        n('out', 160, 250, '.vercel/output', { kind: 'build', mono: true }),
        n('st', 480, 140, 'static/', { kind: 'file', mono: true, sub: 'html · js · css · images' }), n('fn', 480, 300, 'functions/', { kind: 'func', mono: true, sub: 'account.func · api/*.func' }), n('cf', 480, 420, 'config.json', { kind: 'code', mono: true, sub: 'routes · rewrites · headers' }),
        n('cdn', 830, 140, 'Edge Network (CDN)', { kind: 'cdn', sub: 'copies in many cities' }), n('fx', 830, 300, 'Vercel Functions', { kind: 'func', sub: 'run on request, in a region' }), n('rt', 830, 420, 'Edge router', { kind: 'lb', sub: 'decides per request' }),
      ], edges: [e('out', 'st'), e('out', 'fn'), e('out', 'cf'), e('st', 'cdn', 'upload'), e('fn', 'fx', 'deploy'), e('cf', 'rt')], flows: [f('st>cdn', 'files', { kind: 'cdn', every: 2.4 }), f('fn>fx', 'code', { kind: 'func', every: 2.4, delay: 1 })] },
      body: [
        '`static/` is uploaded to Vercel’s global [[cdn]] — the Edge Network. `functions/` contains server code (SSR pages, API routes, Server Components) packaged as [[serverless|Vercel Functions]] that run only when a request needs them, in a chosen region. `config.json` tells the edge router which is which.',
        'A plain Vite SPA has only `static/`. A Next.js app usually has both — and each route is placed according to its rendering strategy (the next two lessons).',
      ],
    },
    {
      short: 'Atomic deploy', title: 'Atomic, immutable deploys and instant rollback', tag: 'concept',
      scene: { nodes: [
        n('d1', 200, 120, 'deploy #41', { kind: 'file', mono: true, sub: 'myapp-a1b2.vercel.app', state: 'dim' }), n('d2', 200, 240, 'deploy #42', { kind: 'file', mono: true, sub: 'myapp-c3d4.vercel.app' }), n('d3', 200, 360, 'deploy #43 (new)', { kind: 'file', mono: true, sub: 'myapp-e5f6.vercel.app', state: 'new' }),
        n('dom', 720, 240, 'myapp.com', { kind: 'cdn', mono: true, state: 'active', sub: 'alias' }),
      ], edges: [e('dom', 'd3', 'points to', { kind: 'cdn' }), e('dom', 'd2', 'rollback = point back', { style: 'dashed' })] },
      body: [
        'Every deployment is <b>immutable</b>: it never changes after it is built, and it keeps its own URL forever. Your production domain is just an alias pointing at one of them.',
        'Going live is a single atomic switch of that pointer, so users get either the old version or the new one — never a mix. Rolling back is pointing the alias at an earlier deployment: no rebuild needed.',
      ],
      interview: 'Good follow-up to mention: a user with the old `index.html` open may request an old chunk after the switch. Keeping old deployments’ assets available (Vercel does, and “skew protection” pins clients to their version) prevents “chunk failed to load” errors.',
    },
    {
      short: 'Caching after deploy', title: 'Second visit after a deploy: what gets downloaded?', tag: 'scenario',
      scene: { nodes: [
        n('br', 140, 230, 'Browser', { kind: 'browser', sub: 'has v1 cached' }),
        n('ix', 480, 120, 'index.html', { kind: 'html', mono: true, sub: 'max-age=0, must-revalidate', state: 'upd' }),
        n('v', 480, 250, 'vendor-8d2e.js', { kind: 'js', mono: true, sub: 'unchanged → disk cache', state: 'ok' }),
        n('a', 480, 370, 'index-Q9z1.js', { kind: 'js', mono: true, sub: 'new name → download', state: 'new' }),
        n('cdn', 830, 230, 'Vercel CDN', { kind: 'cdn' }),
      ], edges: [e('br', 'ix'), e('ix', 'cdn', 'revalidate'), e('br', 'v', 'no request'), e('a', 'cdn', 'GET')], flows: [f('ix>cdn', 'GET /', { kind: 'browser', every: 2.6, back: 'new html' }), f('a>cdn', 'GET', { kind: 'js', every: 2.6, delay: 1.2, back: '200' })] },
      body: [
        '`index.html` is served with `max-age=0, must-revalidate`, so the browser checks for a new one on every visit. The new HTML references `index-Q9z1.js` — a name the browser has never seen — so it downloads it.',
        '`vendor-8d2e.js` did not change, kept its name, and loads straight from disk with no network request at all. This combination — short-lived HTML, immutable hashed assets — gives instant updates <i>and</i> maximum caching.',
      ],
      code: { file: 'response headers', lang: 'http', src: `
# index.html
cache-control: public, max-age=0, must-revalidate

# /assets/index-Q9z1.js
cache-control: public, max-age=31536000, immutable

# useful when debugging on Vercel
x-vercel-cache: HIT        // HIT · MISS · STALE · PRERENDER
x-vercel-id: bom1::iad1::… // edge city that answered :: function region`, hl: [2, 5] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What happens when you run `npm run build` in a Vite React app?', a: ['npm runs the `build` script (often `tsc -b && vite build`). Vite compiles TS/JSX with esbuild, bundles from the entry with Rollup/Rolldown, tree-shakes unused exports, splits dynamic imports into chunks, minifies, adds content hashes to file names and writes `dist/` with an `index.html` that references them.'] },
    { lvl: 'J', q: 'Why do built files have hashes like `index-3f9a.js`?', a: ['The hash comes from the file’s content. Changing the content changes the name, so the file can be cached forever (`immutable`) without ever serving stale code; only the small HTML that points to them needs revalidation.'] },
    { lvl: 'M', q: 'What is code splitting and when would you use it?', a: ['Splitting the bundle into chunks loaded on demand, usually with dynamic `import()` / `React.lazy` per route or for heavy, rarely used components (editors, charts). It reduces the JavaScript needed for the first screen, improving load and interactivity.'] },
    { lvl: 'M', q: 'What does Vercel actually do with a Next.js app?', a: ['On push it builds in a fresh machine, writes the Build Output (static files, functions, routing config), uploads static assets to its global CDN, deploys server code as Functions in a region, and points the domain at the new immutable deployment. At request time its edge router serves files or invokes Functions per route.'] },
    { lvl: 'S', q: 'Users report “Failed to fetch dynamically imported module” right after deploys. Why, and how do you fix it?', a: ['Their open tab still runs the old build and requests an old chunk name that the host no longer serves (or a CDN cached a 404). Fixes: keep previous deployments’ assets available (skew protection), catch chunk-load errors and reload the page once, and avoid deleting old assets during deploys.'] },
  ],
  scenarios: [
    { title: 'A fix is deployed but some users still see the bug', sit: 'You deploy at 10:00. A user who opened the app at 09:00 keeps using it.', steps: [['', 'Their tab already has the old JS in memory; no navigation reloads it in an SPA.'], ['w', 'Only a full reload fetches the new index.html and the new chunk names.']], fix: 'Detect new versions (poll a version endpoint or compare build ids) and prompt users to refresh.' },
    { title: 'The bundle suddenly doubled in size', sit: 'A developer imported `import _ from "lodash"` for one function.', steps: [['x', 'The CommonJS lodash build cannot be tree-shaken, so all of it ships.']], fix: 'Import per function (`lodash-es` or `lodash/debounce`), and add a bundle analyzer to CI.' },
  ],
  history: {
    timeline: [
      { yr: '2009–2012', title: 'Concatenation and Grunt', text: 'Scripts were concatenated and minified by task runners; no module system in the browser.' },
      { yr: '2012', title: 'webpack', text: 'Tobias Koppers’ webpack bundled CommonJS modules and later pioneered code splitting.' },
      { yr: '2015', title: 'ES modules standardized', text: '`import`/`export` landed in ES2015; Rollup introduced tree-shaking for them.' },
      { yr: '2020', title: 'esbuild and Vite', text: 'Evan Wallace’s esbuild (Go) made compiling 10–100× faster; Evan You’s Vite served native ESM in dev and bundled with Rollup for production.', c: 'g' },
      { yr: '2023–2025', title: 'Rust tooling', text: 'SWC, Turbopack (Next.js), Rspack and Rolldown (the Rust Rollup used by Vite) pushed build speed further.' },
      { yr: '2016–today', title: 'Git-push deploys', text: 'Platforms like Netlify and Vercel (formerly ZEIT, founded by Guillermo Rauch) made preview URLs and immutable deploys the default.' },
    ],
    alts: { cols: ['Tool', 'Role', 'Notes'], rows: [['Vite', 'Dev server + build for SPAs and libraries', 'Default for new React SPAs'], ['Next.js (Turbopack/webpack)', 'Full-stack React framework build', 'Server + client output'], ['Rspack / webpack', 'Configurable bundlers', 'Large legacy configs'], ['Vercel', 'Hosting, CDN, Functions', 'First-class Next.js support'], ['Netlify / Cloudflare Pages', 'Similar git-push hosting', 'Cloudflare runs code at the edge'], ['AWS (S3 + CloudFront / Amplify)', 'Do-it-yourself or managed', 'More control, more setup']] },
  },
  quiz: [
    { q: 'Which file must be revalidated on every visit?', o: ['vendor-8d2e.js', 'index.html', 'logo-12cd.svg', 'index-77ab.css'], a: 1, why: 'It is the only file whose name never changes and it points to the hashed assets.' },
    { q: 'Tree-shaking removes…', o: ['comments', 'unused exports', 'type errors', 'old deployments'], a: 1, why: 'It drops code that is never imported.' },
    { q: 'In Vercel’s output, SSR routes become…', o: ['static files', 'Functions', 'images', 'DNS records'], a: 1, why: 'Server code is deployed as Vercel Functions.' },
    { q: 'An instant rollback on Vercel…', o: ['rebuilds the old commit', 'points the domain alias back at an older immutable deployment', 'clears the CDN', 'is impossible'], a: 1, why: 'Deployments are immutable, so rollback is just a pointer change.' },
  ],
  cheat: `<h3>Build pipeline</h3><p>compile (TS/JSX → JS) → bundle (follow imports) → tree-shake → split (<code>import()</code>) → minify → content-hash names → <code>dist/</code></p>
  <h3>Caching rule</h3><table class="t"><tr><td><code>index.html</code></td><td><code>max-age=0, must-revalidate</code></td></tr><tr><td><code>assets/*-[hash].*</code></td><td><code>max-age=31536000, immutable</code></td></tr></table>
  <h3>Vercel</h3><ul><li>git push → webhook → fresh build machine → <code>.vercel/output</code></li><li><code>static/</code> → CDN · <code>functions/</code> → Functions · <code>config.json</code> → routing</li><li>Deploys are immutable; domain = alias; rollback = re-point.</li></ul>`,
};
