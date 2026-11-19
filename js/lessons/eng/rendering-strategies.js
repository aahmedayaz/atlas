import { n, e, f, z, merge } from '../../engine/build.js';

const V = { a: [110, 120], b: [110, 330], cdn: [420, 230], fn: [690, 230], cms: [900, 230] };
const isrNodes = (o = {}) => [
  n('va', ...V.a, 'Visitor A', { kind: 'user', ...(o.va || {}) }), n('vb', ...V.b, 'Visitor B', { kind: 'browser', ...(o.vb || {}) }),
  n('cdn', ...V.cdn, 'Edge + ISR cache', { kind: 'cdn', sub: o.cache || 'stored HTML · $20', ...(o.cdn || {}) }),
  n('fn', ...V.fn, 'Function', { kind: 'func', sub: 'regenerates', ...(o.fn || {}) }), n('cms', ...V.cms, 'CMS / API', { kind: 'db', sub: 'prices', ...(o.cms || {}) }),
];

const rscSplit = (hl) => ({
  zones: [z('zs', 30, 60, 450, 400, 'Server Components → stay on Vercel', 'func'), z('zc', 520, 60, 450, 400, '"use client" → shipped to the browser', 'browser')],
  nodes: [
    n('pg', 250, 130, 'PostsPage', { kind: 'func', sub: 'async · reads DB', state: hl === 'server' ? 'active' : '' }),
    n('md', 150, 260, 'marked (40 KB)', { kind: 'file', sub: 'markdown lib' }), n('dbc', 350, 260, 'db client', { kind: 'db', sub: 'secrets in env' }),
    n('ar', 250, 380, 'Article', { kind: 'func', sub: 'server, renders HTML' }),
    n('lb', 745, 200, 'LikeButton', { kind: 'react', sub: "'use client' · useState", state: hl === 'client' ? 'active' : '' }),
    n('ch', 745, 340, 'LikeButton-a1.js', { kind: 'js', mono: true, sub: 'the only JS for this page' }),
  ],
  edges: [e('pg', 'md', '', { dir: 'none' }), e('pg', 'dbc', '', { dir: 'none' }), e('pg', 'ar'), e('ar', 'lb', 'renders <LikeButton id={1}/>', { bend: -30 }), e('lb', 'ch', 'bundled')],
});

export default {
  id: 'rendering-strategies',
  title: 'SSG, ISR, Streaming, Server Components & PPR',
  level: 'Advanced',
  minutes: 30,
  tags: ['Next.js', 'Vercel', 'RSC'],
  summary: 'Every strategy is an answer to one question — when, and where, is the HTML made? Watch prebuilt pages, self-refreshing pages, streamed pages, server-only components and static shells with dynamic holes, request by request.',
  learn: ['SSG: HTML at build time, served from the CDN', 'ISR: stale-while-revalidate and on-demand revalidation', 'Streaming with Suspense: shell first, slow parts later', 'RSC: the `"use client"` boundary and the RSC payload', 'PPR: static shell + dynamic holes in one response'],
  steps: [
    {
      short: 'When is HTML made?', title: 'One question: when is the HTML made?', tag: 'concept',
      scene: { h: 470, nodes: [
        n('bt', 180, 90, 'At build time', { kind: 'build', sub: 'once per deploy' }), n('rt', 500, 90, 'At request time', { kind: 'func', sub: 'every visit (or cached)' }), n('ct', 820, 90, 'In the browser', { kind: 'browser', sub: 'after JS runs' }),
        n('ssg', 180, 220, 'SSG', { kind: 'build', icon: false, sub: 'static files' }), n('isr', 180, 320, 'ISR', { kind: 'build', icon: false, sub: 'static + refresh' }),
        n('ssr', 500, 220, 'SSR', { kind: 'func', icon: false, sub: 'per request' }), n('str', 500, 320, 'Streaming', { kind: 'func', icon: false, sub: 'per request, in chunks' }),
        n('csr', 820, 220, 'CSR', { kind: 'browser', icon: false, sub: 'empty shell' }),
        n('rsc', 500, 420, 'RSC + PPR mix them per component', { kind: 'react', icon: false, state: 'active' }),
      ], edges: [e('bt', 'ssg', '', { dir: 'none' }), e('ssg', 'isr', '', { dir: 'none' }), e('rt', 'ssr', '', { dir: 'none' }), e('ssr', 'str', '', { dir: 'none' }), e('ct', 'csr', '', { dir: 'none' }), e('isr', 'rsc', '', { style: 'dashed' }), e('str', 'rsc', '', { style: 'dashed' })] },
      body: [
        'CSR and SSR (previous lesson) are two ends of a spectrum. Every other strategy is a different answer to “<b>when</b> is the HTML produced, and <b>where</b> is it stored?” — at [[build-time]], at [[request-time]], or in the browser.',
        'In the Next.js App Router you rarely pick one for the whole app: each route, and with Server Components and PPR even each part of a page, gets the cheapest strategy that is still correct.',
      ],
    },
    {
      short: 'SSG', title: 'SSG: render once at build time, serve the file forever', tag: 'concept',
      scene: { nodes: [
        n('bm', 140, 130, 'next build', { kind: 'build', mono: true, sub: 'runs Post() for every slug' }), n('f1', 140, 260, 'blog/hello.html', { kind: 'html', mono: true }), n('f2', 140, 340, 'blog/react-19.html', { kind: 'html', mono: true }),
        n('cdn', 520, 260, 'Vercel CDN', { kind: 'cdn', sub: 'x-vercel-cache: HIT', state: 'active' }), n('br', 850, 260, 'Browser', { kind: 'browser', sub: 'full article at once' }),
      ], edges: [e('bm', 'f1'), e('f1', 'cdn', 'upload'), e('f2', 'cdn', ''), e('br', 'cdn', 'GET /blog/hello')], flows: [f('br>cdn', 'GET', { kind: 'browser', every: 2, back: 'HTML', backKind: 'cdn' })] },
      facts: [['HTML made', 'build time'], ['function runs', 'never'], ['TTFB', '~20–50 ms']],
      body: [
        'With [[ssg]], Next.js runs your page component <b>during `next build`</b> and writes the finished HTML as a file. Every visitor anywhere gets the same file from the nearest CDN city. No function runs, so it is the fastest and cheapest option, with perfect SEO.',
        'The catch: content only changes when you redeploy. In the App Router, a route with no dynamic data (no cookies, headers or uncached fetches) is static by default.',
      ],
      code: { file: 'app/blog/[slug]/page.jsx', lang: 'jsx', src: `
// which slugs to prerender at build time
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export default async function Post({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);          // runs on the BUILD machine
  return <article><h1>{post.title}</h1>{post.body}</article>;
}

// Pages Router equivalent: getStaticProps + getStaticPaths`, hl: [2, 3, 4, 9] },
    },
    {
      short: 'ISR: fresh hit', title: 'ISR, t = 10 s: a normal cache hit', tag: 'internals',
      scene: { nodes: isrNodes({ va: { state: 'active' }, cdn: { state: 'ok' }, fn: { state: 'dim' }, cms: { state: 'dim' } }), edges: [e('va', 'cdn', 'GET /product/7')], flows: [f('va>cdn', 'GET', { kind: 'user', every: 2.2, back: 'HIT $20', backKind: 'cdn' })] },
      facts: [['age', '10 s'], ['revalidate', '60 s'], ['x-vercel-cache', 'HIT']],
      body: [
        '[[isr]] is SSG with an expiry timer. The product page was generated at build time (or on its first request) and stored with `revalidate = 60`. At 10 seconds old it is fresh, so Visitor A gets it straight from the edge.',
      ],
      code: { file: 'app/product/[id]/page.jsx', lang: 'jsx', src: `
export const revalidate = 60;   // page may be at most ~60 s old

export default async function Product({ params }) {
  const { id } = await params;
  const p = await fetch(\`https://cms.example.com/products/\${id}\`).then(r => r.json());
  return <h1>{p.name}: \${p.price}</h1>;
}`, hl: [1] },
    },
    {
      short: 'ISR: stale', title: 'ISR, t = 75 s: serve stale instantly, rebuild in the background', tag: 'internals',
      scene: { nodes: isrNodes({ vb: { state: 'active' }, cdn: { state: 'upd' }, fn: { state: 'active' }, cms: { state: 'active' } }),
        edges: [e('vb', 'cdn', 'GET /product/7'), e('cdn', 'fn', 'background regenerate'), e('fn', 'cms', 'fetch product 7')],
        flows: [f('vb>cdn', 'GET', { kind: 'browser', every: 3, back: 'STALE $20', backKind: 'cdn' }), f('cdn>fn', 'regen', { kind: 'cdn', every: 3, delay: 0.6 }), f('fn>cms', 'GET', { kind: 'func', every: 3, delay: 1.2, back: '$25', backKind: 'db' })] },
      facts: [['age', '75 s'], ['revalidate', '60 s'], ['x-vercel-cache', 'STALE']],
      body: [
        'Now the page is older than 60 s. Visitor B is <b>not</b> made to wait: they get the old page instantly ([[swr|stale-while-revalidate]]). At the same time Vercel invokes the Function in the background, which fetches fresh data — the price changed to $25 — and renders a new page.',
        'The new HTML (and its RSC payload) replaces the cached one, and the timer restarts. At most one request per window sees stale content; nobody waits.',
      ],
    },
    {
      short: 'ISR: fresh again', title: 'ISR, t = 90 s: everyone gets the new page at CDN speed', tag: 'internals',
      scene: { nodes: isrNodes({ va: { state: 'active' }, cdn: { state: 'ok' }, cache: 'stored HTML · $25', fn: { state: 'dim' }, cms: { state: 'dim' } }), edges: [e('va', 'cdn', 'GET /product/7'), e('cms', 'fn', 'webhook → revalidatePath', { style: 'dashed', bend: 40 })], flows: [f('va>cdn', 'GET', { kind: 'user', every: 2.2, back: 'HIT $25', backKind: 'cdn' })] },
      facts: [['age', '15 s'], ['revalidate', '60 s'], ['x-vercel-cache', 'HIT']],
      body: [
        'The next visitor gets the fresh page from the edge. You can also skip the timer entirely: when the CMS changes, a webhook calls a route that runs `revalidatePath()` or `revalidateTag()`, and the page is regenerated on demand.',
      ],
      code: { file: 'app/api/revalidate/route.js', lang: 'js', src: `
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(req) {
  const { secret, productId } = await req.json();
  if (secret !== process.env.REVALIDATE_SECRET) return new Response('no', { status: 401 });
  revalidatePath(\`/product/\${productId}\`);   // this page only
  // or revalidateTag('products')              // every fetch tagged 'products'
  return Response.json({ ok: true });
}`, hl: [6, 7] },
    },
    {
      short: 'Streaming', title: 'Streaming SSR: send the fast parts now, the slow part later', tag: 'internals',
      scene: { nodes: [
        n('br', 120, 250, 'Browser', { kind: 'browser', sub: 'paints chunk 1 at ~100 ms' }), n('fn', 480, 250, 'Function', { kind: 'func', sub: 'React server render', state: 'active' }), n('api', 860, 250, 'Slow API', { kind: 'server', sub: '2 seconds' }),
        n('c1', 300, 120, 'chunk 1: header + skeleton', { kind: 'html', icon: false, mono: true, state: 'ok' }), n('c2', 300, 390, 'chunk 2 @ 2 s: chart + $RC()', { kind: 'html', icon: false, mono: true, state: 'upd' }),
      ], edges: [e('fn', 'br', 'one open response'), e('fn', 'api', 'start fetch, don’t wait')], flows: [f('fn>br', 'chunk', { kind: 'func', every: 1.4 }), f('fn>api', 'GET', { kind: 'func', every: 3, back: 'data', backKind: 'server' })] },
      body: [
        'Plain SSR waits for <b>all</b> data before sending a byte, so one slow query makes the whole page slow. With [[streaming]], React flushes what is ready immediately — the layout, the header and a fallback for each [[suspense]] boundary — and keeps the connection open.',
        'When the slow component resolves, React streams its HTML into the <b>same response</b> with a tiny inline script that swaps it into place. That boundary hydrates on its own (selective hydration). Total time is similar; perceived speed is far better.',
      ],
      code: { file: 'app/dashboard/page.jsx', lang: 'jsx', src: `
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <>
      <Header />                                    {/* chunk 1 */}
      <Suspense fallback={<RevenueSkeleton />}>
        <Revenue />                                 {/* chunk 2, when ready */}
      </Suspense>
    </>
  );
}
async function Revenue() { const d = await slowApi(); return <Chart data={d} />; }

/* on the wire:
   <header>…</header><!--$?--><template id="B:0"></template><div>Loading…</div><!--/$-->
   … 2 s later, same response …
   <div hidden id="S:0"><svg>…</svg></div><script>$RC("B:0","S:0")</script>   */`, hl: [7, 8, 9] },
      callout: { kind: 'tip', text: 'A `loading.jsx` file next to a page is an automatic Suspense boundary around the whole route.' },
    },
    {
      short: 'RSC: the split', title: 'Server Components: some code never leaves the server', tag: 'concept',
      scene: rscSplit('server'),
      body: [
        'In the App Router every component is a [[rsc|Server Component]] unless its module starts with [[use-client|`"use client"`]]. Server Components run only on Vercel: they can be `async`, query the database directly, read secrets and import heavy libraries — and <b>none of that code is sent to the browser</b>.',
        '`"use client"` marks the boundary where components (and everything they import) join the client bundle, because they need state, effects, event handlers or browser APIs.',
      ],
      code: { file: 'app/posts/page.jsx', lang: 'jsx', src: `
import { marked } from 'marked';            // 40 KB — stays on the server
import LikeButton from './LikeButton';

export default async function PostsPage() {  // Server Component (default)
  const posts = await db.post.findMany();    // direct DB access, no API route
  return posts.map(p => (
    <article key={p.id}>
      <div dangerouslySetInnerHTML={{ __html: marked(p.body) }} />
      <LikeButton id={p.id} />               {/* client island */}
    </article>
  ));
}

// app/posts/LikeButton.jsx
'use client';
export default function LikeButton({ id }) {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>♥ {n}</button>;
}`, hl: [1, 5, 6, 15] },
    },
    {
      short: 'RSC payload', title: 'The RSC payload: the rendered tree as text', tag: 'internals',
      scene: merge(rscSplit('client'), { nodes: [n('pl', 500, 470, '0:["$","article",…,["$","$L1",null,{"id":1}]]', { kind: 'code', mono: true, icon: false })] }),
      body: [
        'Server Components execute and disappear; only their <b>output</b> remains. That output is serialized as the [[rsc-payload]] — a compact text stream describing elements and props, with <b>references</b> where Client Components go (“load chunk `LikeButton-a1.js` here with props `{id: 1}`”).',
        'Props crossing the boundary must be serializable (strings, numbers, plain objects, arrays, Dates, Promises…) — not functions or class instances. A Client Component cannot import a Server Component, but it can receive one as `children`.',
      ],
      code: { file: 'RSC payload (simplified)', lang: 'text', src: `
1:I["app/posts/LikeButton.js",["static/chunks/LikeButton-a1.js"],"default"]
0:["$","article","1",{"children":[
    ["$","div",null,{"dangerouslySetInnerHTML":{"__html":"<p>Hello</p>"}}],
    ["$","$L1",null,{"id":1}]          ← "client component #1 goes here"
]}]` },
    },
    {
      short: 'First load', title: 'First load: HTML for pixels + payload for React + JS only for islands', tag: 'internals',
      scene: { nodes: [
        n('br', 130, 250, 'Browser', { kind: 'browser', sub: 'paint → hydrate islands' }), n('cdn', 450, 140, 'Vercel CDN', { kind: 'cdn', sub: 'framework + LikeButton-a1.js' }),
        n('fn', 450, 360, 'Function', { kind: 'func', sub: 'runs Server Components' }), n('db', 820, 360, 'Database', { kind: 'db' }),
      ], edges: [e('br', 'fn', 'GET /posts'), e('fn', 'db', ''), e('br', 'cdn', 'GET client chunks')],
        flows: [f('br>fn', 'GET', { kind: 'browser', every: 3.2, back: 'HTML + payload', backKind: 'func' }), f('fn>db', 'query', { kind: 'func', every: 3.2, delay: 0.5, back: 'rows', backKind: 'db' }), f('br>cdn', 'GET js', { kind: 'browser', every: 3.2, delay: 1.6, back: 'chunks', backKind: 'js' })] },
      facts: [['PostsPage JS', '0 KB'], ['marked JS', '0 KB'], ['shipped', 'LikeButton only']],
      body: [
        'On the first visit, one response carries both: <b>HTML</b> (rendered from the payload, so the browser can paint immediately) and the <b>RSC payload</b> inlined in `<script>self.__next_f.push(…)</script>` tags so React can rebuild the tree.',
        'The browser then downloads JavaScript <b>only for Client Components</b>. React reads the payload and hydrates just those islands; everything else is already-final HTML.',
      ],
    },
    {
      short: 'Navigation', title: 'Clicking a <Link>: fetch the payload, not a page', tag: 'internals',
      scene: { nodes: [
        n('br', 160, 250, 'Browser', { kind: 'browser', sub: 'router + React', state: 'active' }), n('fn', 620, 250, 'Function', { kind: 'func', sub: 'renders /posts/2' }),
        n('lay', 160, 410, 'shared layout stays mounted', { kind: 'note', icon: false, sub: 'search text, scroll, state kept' }),
        n('pf', 620, 100, 'prefetched when the link was visible', { kind: 'note', icon: false }),
      ], edges: [e('br', 'fn', 'GET /posts/2?_rsc  RSC: 1'), e('pf', 'fn', '', { style: 'dashed', dir: 'none' })], flows: [f('br>fn', 'RSC: 1', { kind: 'browser', every: 2.4, back: 'text/x-component', backKind: 'func' })] },
      body: [
        'Client navigation does not load a new HTML document. The router requests only the RSC payload for the new route (`?_rsc=…` with an `RSC: 1` header → `content-type: text/x-component`), often already [[prefetch|prefetched]] when the link scrolled into view.',
        'React reconciles the new tree into the current DOM. Shared layouts are not re-rendered, so client state inside them — an input’s text, a sidebar’s scroll position — survives.',
      ],
      code: { file: 'network', lang: 'http', src: `
GET /posts/2?_rsc=1x9k
RSC: 1
Next-Router-State-Tree: …

HTTP/2 200
content-type: text/x-component      // payload only, no HTML`, hl: [1, 2, 6] },
    },
    {
      short: 'SSR vs RSC', title: 'Traditional SSR vs Server Components', tag: 'concept',
      scene: rscSplit(),
      body: [
        '<table class="t"><tr><th></th><th>Pages Router SSR</th><th>App Router RSC</th></tr><tr><td>JS sent</td><td>every component on the page</td><td>Client Components only</td></tr><tr><td>Heavy libraries</td><td>bundled if used in a page</td><td>stay on the server if used only there</td></tr><tr><td>Data fetching</td><td>page-level `getServerSideProps`</td><td>any async Server Component</td></tr><tr><td>Navigation</td><td>JSON + page JS chunks</td><td>streamed RSC payload</td></tr><tr><td>Hydration</td><td>whole page tree</td><td>`"use client"` islands only</td></tr></table>',
        'RSC is not “SSR again”. SSR is a way of producing HTML; RSC is a component model plus a transport format. A Next.js route typically uses both: RSC decides what runs where, SSR turns the result into HTML for the first paint.',
      ],
      callout: { kind: 'bad', text: 'Putting `"use client"` at the top of `page.jsx` turns the whole page and everything it imports into client code. Push the directive down to the smallest interactive leaf.' },
    },
    {
      short: 'PPR', title: 'Partial Prerendering: a static shell with dynamic holes', tag: 'internals',
      scene: { nodes: [
        n('br', 120, 250, 'Browser', { kind: 'browser' }), n('cdn', 450, 140, 'Vercel Edge', { kind: 'cdn', sub: 'static shell (built at deploy)', state: 'ok' }), n('fn', 450, 370, 'Function', { kind: 'func', sub: 'renders only <Cart/>', state: 'upd' }),
        n('sh', 800, 140, 'layout · product info · skeletons', { kind: 'html', icon: false, state: 'ok' }), n('hole', 800, 370, 'cart for this user (cookies)', { kind: 'react', icon: false, state: 'upd' }),
      ], edges: [e('cdn', 'br', 'shell instantly'), e('fn', 'br', 'hole streamed in'), e('cdn', 'fn', 'in parallel'), e('sh', 'cdn', '', { style: 'dashed', dir: 'none' }), e('hole', 'fn', '', { style: 'dashed', dir: 'none' })],
        flows: [f('cdn>br', 'shell', { kind: 'cdn', every: 2.8 }), f('cdn>fn', 'render', { kind: 'cdn', every: 2.8, delay: 0.3 }), f('fn>br', 'cart', { kind: 'func', every: 2.8, delay: 1.4 })] },
      body: [
        '[[ppr]] mixes SSG and streaming on <b>one page</b>. Everything that is the same for everyone is prerendered at build time and served instantly from the edge. Parts that depend on the request (cookies, headers, uncached data) sit inside Suspense boundaries; the Function renders just those and streams them into the same HTTP response.',
        'In Next.js 16 this is enabled with `cacheComponents: true`, and you mark cacheable work with the `"use cache"` directive.',
      ],
      code: { file: 'app/product/[id]/page.jsx', lang: 'jsx', src: `
// next.config.js → export default { cacheComponents: true }

export default function Page({ params }) {
  return (
    <>
      <ProductInfo params={params} />           {/* cached → in the static shell */}
      <Suspense fallback={<CartSkeleton />}>
        <Cart />                                 {/* dynamic hole → streamed */}
      </Suspense>
    </>
  );
}
async function ProductInfo({ params }) { 'use cache'; /* fetch product… */ }
async function Cart() { const jar = await cookies(); /* per-user → dynamic */ }`, hl: [1, 6, 8, 13] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What is the difference between SSG and SSR?', a: ['SSG renders HTML once at build time and serves the same file from a CDN to everyone — fastest and cheapest, but only as fresh as the last build. SSR renders HTML on every request on a server — always fresh and can be personalized, but costs compute and adds latency.'] },
    { lvl: 'M', q: 'Explain ISR and stale-while-revalidate.', a: ['ISR serves statically generated pages but regenerates them after a `revalidate` interval or on demand. When a page is stale, the next visitor still gets the cached (stale) copy instantly while a background regeneration fetches fresh data and replaces the cache — nobody waits.'], follow: ['How do you refresh a page immediately when the CMS changes?'] },
    { lvl: 'M', q: 'What problem does streaming SSR solve?', a: ['Plain SSR blocks the whole response on the slowest data. Streaming with Suspense sends the shell and fallbacks immediately and streams each slow section into the same response when ready, so the user sees content sooner and parts hydrate independently.'] },
    { lvl: 'M', q: 'What are React Server Components, and what can’t they do?', a: ['Components that run only on the server: async, direct data access, secrets, heavy libraries, zero client JS. They cannot use state, effects, event handlers or browser APIs — those need a Client Component (`"use client"`). Props passed to Client Components must be serializable.'] },
    { lvl: 'S', q: 'What exactly is the RSC payload and when is it fetched?', a: ['A streamed, line-based text format describing the rendered tree: host elements, serialized props, and references to Client Component modules. On first load it is inlined in the HTML for hydration; on client navigation the router fetches it alone (`RSC: 1`, `text/x-component`) and React reconciles it into the existing DOM, preserving layout state.'] },
    { lvl: 'S', q: 'A product page has static details, a personalized cart and a slow recommendations API. How would you render it on Vercel?', a: ['Partial Prerendering: product details in the static shell (`"use cache"` / static fetch, ISR-style revalidation or tag invalidation from the CMS), the cart as a dynamic Suspense hole reading cookies, and recommendations in their own Suspense boundary so they stream when ready. Keep interactive bits as small Client Components.'], why: 'Tests whether you can mix strategies per component instead of picking one per app.' },
  ],
  scenarios: [
    { title: 'A typo fix doesn’t appear on the blog', sit: 'The post is SSG with no revalidation.', steps: [['', 'The HTML was baked at build time; the CDN keeps serving it.'], ['w', 'It changes only after a new deploy.']], fix: 'Redeploy, or add `revalidate` / on-demand `revalidatePath` from a CMS webhook.' },
    { title: 'One slow widget makes the whole page slow', sit: 'A dashboard awaits a 3 s analytics API in the page component.', steps: [['x', 'TTFB = 3 s; the screen stays white.'], ['g', 'Wrapping the widget in Suspense paints the shell at ~100 ms and streams the widget at 3 s.']], fix: 'Suspense boundary + skeleton (or `loading.jsx`), and start independent fetches in parallel.' },
    { title: 'Bundle grew 300 KB after adding a markdown editor preview', sit: '`"use client"` was added to the page to use one `useState`.', steps: [['x', 'The whole page and its imports (markdown parser, syntax highlighter) moved into the client bundle.']], fix: 'Keep the page a Server Component; move the state into a small client child.' },
  ],
  history: {
    timeline: [
      { yr: '2008–2015', title: 'Static site generators', text: 'Jekyll (2008), Hugo, then Gatsby (React, 2015) generated HTML at build time.' },
      { yr: '2020', title: 'Next.js 9.5: ISR', text: 'Incremental Static Regeneration brought stale-while-revalidate to static pages.', c: 'g' },
      { yr: '2020-12', title: 'React Server Components RFC', text: 'Dan Abramov and Lauren Tan demoed components that run only on the server.' },
      { yr: '2022', title: 'React 18 streaming SSR', text: 'Suspense on the server, selective hydration.' },
      { yr: '2023', title: 'Next.js 13.4 App Router stable', text: 'RSC by default; per-route and per-component rendering choices.' },
      { yr: '2023–2025', title: 'Partial Prerendering', text: 'Introduced experimentally in Next.js 14, it became the model behind Cache Components in Next.js 16.' },
    ],
    alts: { cols: ['Need', 'Next.js', 'Elsewhere'], rows: [['Static content', 'SSG', 'Astro, Hugo, Eleventy'], ['Mostly static, periodic updates', 'ISR / revalidateTag', 'Netlify on-demand builders, Astro + CDN cache'], ['Personalized pages', 'SSR / dynamic RSC', 'React Router v7 loaders, SvelteKit'], ['Little JS, islands', 'RSC + client islands', 'Astro islands, Qwik resumability'], ['Static shell + dynamic bits', 'PPR', 'Edge includes (ESI), Astro server islands']] },
  },
  quiz: [
    { q: 'Which strategy runs no server code at request time?', o: ['SSR', 'SSG', 'Streaming', 'Dynamic RSC'], a: 1, why: 'SSG HTML is a file served from the CDN.' },
    { q: 'An ISR page is stale. The next visitor…', o: ['waits for a fresh render', 'gets the stale page instantly while it regenerates', 'gets a 404', 'gets an empty shell'], a: 1, why: 'Stale-while-revalidate.' },
    { q: 'What is sent to the browser for a Server Component?', o: ['Its source code', 'Its rendered output in the payload/HTML', 'Nothing at all', 'Its npm dependencies'], a: 1, why: '0 KB of its JS — only output.' },
    { q: 'Client-side navigation in the App Router fetches…', o: ['a full HTML page', 'the RSC payload', 'index.html', 'only CSS'], a: 1, why: '`RSC: 1` → `text/x-component`.' },
    { q: 'PPR serves…', o: ['only dynamic HTML', 'a static shell plus streamed dynamic holes in one response', 'two separate pages', 'CSR only'], a: 1, why: 'Shell from the edge, holes from the Function.' },
  ],
  cheat: `<h3>Choose by “when is HTML made?”</h3><table class="t"><tr><th>Strategy</th><th>HTML made</th><th>On Vercel</th><th>First bytes</th><th>Switch</th></tr>
  <tr><td>CSR</td><td>browser</td><td>CDN files</td><td>empty root</td><td>Vite SPA / client effect fetch</td></tr>
  <tr><td>SSG</td><td>build</td><td>CDN</td><td>full HTML (HIT)</td><td>static by default, <code>generateStaticParams</code></td></tr>
  <tr><td>ISR</td><td>build + background</td><td>CDN + cache + Function</td><td>full HTML (HIT/STALE)</td><td><code>revalidate</code>, <code>revalidatePath/Tag</code></td></tr>
  <tr><td>SSR</td><td>each request</td><td>Function</td><td>full HTML</td><td><code>cookies()</code>, <code>headers()</code></td></tr>
  <tr><td>Streaming</td><td>each request, chunks</td><td>Function</td><td>shell + fallbacks</td><td><code>&lt;Suspense&gt;</code>, <code>loading.jsx</code></td></tr>
  <tr><td>RSC</td><td>server</td><td>Function + CDN chunks</td><td>HTML + payload</td><td>default; <code>"use client"</code> = island</td></tr>
  <tr><td>PPR</td><td>shell at build, holes per request</td><td>Edge + Function</td><td>static shell instantly</td><td><code>cacheComponents</code>, <code>"use cache"</code></td></tr></table>`,
};
