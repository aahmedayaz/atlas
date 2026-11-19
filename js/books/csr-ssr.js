export default {
  title: 'Client rendering, server rendering and hydration',
  intro: 'Should the browser build your page, or the server? This book follows one real request both ways, step by step, and explains hydration — the moment a server-built page comes alive — in plain words.',
  chapters: [
    {
      level: 1, title: 'Who builds the HTML?',
      text: [
        'Every page the user sees is HTML in the end. The big question is **where** that HTML gets built.',
        'With **client-side rendering (CSR)**, the server sends an almost empty page plus JavaScript, and the user’s browser builds everything. With **server-side rendering (SSR)**, a server builds the full HTML for each request and sends it ready to show.',
      ],
      words: [
        ['Client', 'The user’s side: their browser and device.'],
        ['Server', 'A computer elsewhere that answers requests.'],
        ['Rendering', 'Here: producing the HTML for a page.'],
      ],
      example: 'Flat-pack furniture you assemble at home (CSR) versus furniture delivered already assembled (SSR).',
      remember: 'CSR: browser builds the page. SSR: server builds the page.',
      check: ['In CSR, what does the first HTML response contain?', 'Almost nothing visible — usually an empty `<div id="root">` and script tags.'],
    },
    {
      level: 1, title: 'A CSR request, step by step',
      text: [
        '1) The browser asks for the page; the CDN returns tiny HTML with an empty root. The screen is blank. 2) The browser downloads the JavaScript and CSS. 3) The JavaScript runs, React builds the page — but it has no data yet, so it shows “Loading…”. 4) The app fetches data from an API. 5) Data arrives, React renders the real content.',
        'Each step waits for the one before. This chain of waits is called a **waterfall**.',
      ],
      words: [
        ['API', 'Here: a server address that returns data (usually JSON) instead of pages.'],
        ['Waterfall', 'Requests that happen one after another because each needs the previous result.'],
        ['Round trip', 'One request going to a server and the answer coming back.'],
      ],
      example: 'Ordering flat-pack furniture, waiting for delivery, then discovering the screws come in a second delivery.',
      remember: 'CSR first view = HTML → JS → data → content.',
      check: ['Why does a CSR page often show a spinner first?', 'React can only ask for data after its JavaScript has loaded and run.'],
    },
    {
      level: 1, title: 'Strengths and costs of CSR',
      text: [
        'CSR is simple and cheap to host: only static files, served from a CDN, no servers to run. After the first load, moving around the app is fast.',
        'The costs: a slower first view, especially on slow phones; and search engines or link previews may see only the empty page.',
      ],
      words: [
        ['SEO', 'Search Engine Optimisation — making pages easy for search engines to read and rank.'],
        ['First Contentful Paint (FCP)', 'The moment the first text or image appears on screen.'],
      ],
      example: 'Internal dashboards behind a login are usually fine as CSR: users visit often, and search engines never see them.',
      remember: 'CSR: cheap and simple, slow first content.',
      check: ['Name a good fit for pure CSR.', 'A logged-in admin dashboard or internal tool where SEO does not matter.'],
    },
    {
      level: 2, title: 'An SSR request, step by step',
      text: [
        '1) The request reaches a **server function**. 2) It fetches the data directly (it can sit right next to the database). 3) It runs your React components on the server and produces finished HTML. 4) The browser receives real content and paints it immediately.',
        'Meanwhile the JavaScript is still downloading. The page **looks** ready before it **is** interactive.',
      ],
      words: [
        ['Server function', 'Code that runs on the server for each request (on Vercel: a Function).'],
        ['Interactive', 'Able to respond to clicks and typing.'],
        ['`renderToString` / streaming render', 'React functions that turn components into HTML on the server.'],
      ],
      example: 'A news article page arrives with the headline and text already inside the HTML — you start reading at once.',
      remember: 'SSR: content arrives in the first response.',
      check: ['Why can SSR fetch data faster than the browser?', 'The server is usually close to the database and fetches in the same place it renders, avoiding a browser round trip.'],
    },
    {
      level: 2, title: 'Hydration: bringing the page to life',
      text: [
        'The server’s HTML is just a picture: buttons do nothing yet. When the JavaScript arrives, React runs `hydrateRoot`. It renders the same components in the browser and walks the existing HTML alongside, **reusing** each DOM node and attaching event handlers and state.',
        'This is **hydration**: adding water (JavaScript) to dry (static) HTML.',
      ],
      words: [
        ['Hydration', 'React taking over server-made HTML by attaching event handlers and state, without rebuilding the DOM.'],
        ['`hydrateRoot`', 'The React function that hydrates instead of creating the DOM from scratch.'],
        ['Event handler', 'Code that runs when the user does something, like clicking.'],
      ],
      example: 'A room already painted and furnished; the electrician arrives later and connects the light switches.',
      remember: 'SSR paints first; hydration makes it clickable.',
      check: ['During hydration, does React create new DOM nodes for the page?', 'No — it adopts the existing ones and attaches behaviour.'],
    },
    {
      level: 2, title: 'The hydration gap',
      text: [
        'Between “content visible” and “content interactive” there is a gap. On a fast laptop it is tiny; on a cheap phone it can be seconds. A user may tap “Add to cart” and nothing happens — sometimes called the **uncanny valley**.',
        'Ways to shrink it: send less JavaScript, split code, and let React hydrate parts separately (**selective hydration** with `<Suspense>`), prioritising the part the user is interacting with.',
      ],
      words: [
        ['Time to Interactive (TTI)', 'When the page reliably responds to input.'],
        ['Selective hydration', 'React hydrating sections independently and prioritising those the user touches.'],
        ['`<Suspense>`', 'A React component that marks a part of the page that may load or hydrate separately, with a fallback.'],
      ],
      example: 'A shop with the lights on and goods on display, but the tills are still starting up.',
      remember: 'Less JS = smaller hydration gap.',
      check: ['Why can SSR feel worse than CSR on a slow phone in one specific way?', 'The page looks ready earlier, so users try to click during the hydration gap and nothing happens.'],
    },
    {
      level: 3, title: 'Hydration mismatches',
      text: [
        'Hydration assumes the browser’s first render produces exactly the same HTML as the server did. If not — for example, you render `new Date().toLocaleTimeString()`, `Math.random()`, or something read from `window` — React reports a **hydration mismatch** and must patch or re-render that part.',
        'Fixes: render the same thing on both sides first, then update in an effect; or move browser-only bits into client-only components.',
      ],
      words: [
        ['Mismatch', 'The server HTML and the browser’s first render disagree.'],
        ['`window`', 'The browser’s global object; it does not exist on the server.'],
      ],
      example: 'A tailor’s measurements differ from the suit already delivered — that part must be re-cut.',
      remember: 'Server output and first client render must match exactly.',
      check: ['Why does showing the current time during render cause a mismatch?', 'The server and the browser render at different moments, so the text differs.'],
    },
    {
      level: 3, title: 'Choosing between them',
      text: [
        'Pick **CSR** for app-like screens behind a login, where SEO does not matter and hosting should be simple. Pick **SSR** when the first view must be fast and indexable, and the content depends on the request (user, cookies, location).',
        'Most real products mix both — and add static generation for pages that are the same for everyone, which the next lesson covers.',
      ],
      words: [
        ['Indexable', 'Readable by search engines so it can appear in results.'],
        ['Personalised', 'Different for each user, e.g. “Welcome back, Ada”.'],
      ],
      example: 'An online shop: product and category pages are server-rendered for search engines; the account dashboard can be client-rendered.',
      remember: 'Public + per-request → SSR. Private app screens → CSR is fine.',
      check: ['A logged-in analytics dashboard. SSR or CSR?', 'CSR is usually fine — no SEO need, users return often, and it is cheaper to host.'],
    },
  ],
};
