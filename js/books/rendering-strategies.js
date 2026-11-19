export default {
  title: 'SSG, ISR, streaming, Server Components and PPR',
  intro: 'Modern frameworks offer many ways to produce a page. They all answer one question: when is the HTML made, and where? This book introduces each strategy in order, from the simplest to the newest, so the acronyms finally make sense.',
  chapters: [
    {
      level: 1, title: 'The one question behind every strategy',
      text: [
        'Every rendering strategy is an answer to: **when** is the HTML produced? Once at build time? Again every few minutes? On every request? In the browser?',
        'Earlier means faster and cheaper to serve. Later means fresher and more personal. Each strategy is a different balance.',
      ],
      words: [
        ['Build time', 'When you run the build, before any user visits.'],
        ['Request time', 'When a user’s request arrives.'],
        ['Fresh', 'Showing the latest data.'],
      ],
      example: 'A newspaper printed overnight (build time) versus a live news ticker updated every second (request time).',
      remember: 'Earlier = faster. Later = fresher.',
      check: ['Why is HTML made at build time faster to serve?', 'It already exists as a file and can be served straight from a CDN, with no computation per request.'],
    },
    {
      level: 1, title: 'SSG: print once, serve to everyone',
      text: [
        '**Static Site Generation** renders pages to HTML files during the build. Every visitor gets the same file from the CDN.',
        'It is the fastest and cheapest option. The catch: the content is only as fresh as the last build.',
      ],
      words: [
        ['SSG', 'Static Site Generation — producing HTML files at build time.'],
        ['Static', 'The same for everyone and unchanged until the next build.'],
      ],
      example: 'Printing a brochure once and handing the same copy to every visitor. Documentation sites and blogs work like this.',
      remember: 'SSG = same HTML for all, made at build.',
      check: ['A product price changes in your database. When does an SSG page show it?', 'Only after the next build and deploy.'],
    },
    {
      level: 1, title: 'ISR: reprint in the background',
      text: [
        '**Incremental Static Regeneration** starts like SSG but adds a timer: `revalidate: 60` means “this page may be up to 60 seconds old”.',
        'Within that window, visitors get the cached page instantly. After it, the **next** visitor still gets the old page instantly, while the server rebuilds a fresh copy in the background. Later visitors get the new copy. This pattern is called **stale-while-revalidate**.',
      ],
      words: [
        ['ISR', 'Incremental Static Regeneration — static pages that are re-generated in the background after a time limit.'],
        ['Revalidate', 'Check and refresh a cached copy.'],
        ['Stale', 'Older than the allowed time, but still served while a fresh one is prepared.'],
      ],
      example: 'A brochure with a sticker: “reprint after 60 seconds”. Nobody ever waits at the counter; the reprint happens in the back room.',
      remember: 'ISR = static speed with periodic freshness.',
      check: ['Does any visitor wait for the background regeneration?', 'No. The visitor who triggers it is served the stale copy instantly.'],
    },
    {
      level: 2, title: 'On-demand revalidation',
      text: [
        'Waiting for a timer is not always good enough. When content changes in your CMS, it can call your app (a **webhook**) and your code runs `revalidatePath("/product/7")` or `revalidateTag("products")`.',
        'The cached page is marked out of date immediately, and the next request gets fresh HTML.',
      ],
      words: [
        ['CMS', 'Content Management System — where editors change text, prices and images, like Contentful, Sanity or WordPress.'],
        ['Webhook', 'An automatic message one service sends to another when something happens.'],
        ['Tag', 'A label on cached data so everything with that label can be refreshed together.'],
      ],
      example: 'Instead of reprinting brochures every hour, the shop manager phones the printer the moment a price changes.',
      remember: 'Content changed → webhook → revalidate exactly what changed.',
      check: ['Why tag-based revalidation instead of path-based?', 'One piece of data (e.g. a product) may appear on many pages; a tag refreshes all of them at once.'],
    },
    {
      level: 2, title: 'Streaming: send the fast parts first',
      text: [
        'Plain SSR waits for **all** data before sending anything. One slow query makes the whole page slow.',
        'With **streaming**, React sends the page in pieces over one open connection. The layout and fast parts arrive first; slow parts are wrapped in `<Suspense fallback={…}>` and show a placeholder, which is replaced when that data is ready.',
      ],
      words: [
        ['Streaming', 'Sending a response in chunks as each part becomes ready, instead of all at the end.'],
        ['Fallback', 'Temporary content (like a skeleton) shown while something loads.'],
        ['Chunk', 'One piece of a streamed response.'],
      ],
      example: 'A restaurant bringing the starters as soon as they are ready instead of holding the whole table’s order for the slowest dish.',
      remember: 'Streaming + Suspense = no waiting for the slowest query.',
      check: ['A page has a fast header and a 2-second recommendations query. What does streaming change?', 'The header shows immediately; the recommendations box appears about 2 seconds later instead of delaying everything.'],
    },
    {
      level: 2, title: 'Server Components: code that never leaves the server',
      text: [
        '**React Server Components (RSC)** run only on the server. They can read the database or files directly, use big libraries, and keep secrets — and **none of their code is sent to the browser**.',
        'Components that need interactivity (state, effects, click handlers) are marked with `"use client"` and work like normal React components. Server Components can render Client Components inside them.',
      ],
      words: [
        ['Server Component', 'A component that runs only on the server; its code is never downloaded by the browser.'],
        ['Client Component', 'A component (marked `"use client"`) that is sent to the browser and can be interactive.'],
        ['Bundle size', 'How much JavaScript the browser must download.'],
      ],
      example: 'Kitchen staff who never leave the kitchen: they can open the fridge (database) directly, and only the plated food goes out to the dining room.',
      remember: 'Server Components = zero JS in the browser for that part.',
      check: ['Can a Server Component use `useState`?', 'No. State and effects need the browser, so that part must be a Client Component.'],
    },
    {
      level: 3, title: 'The RSC payload',
      text: [
        'The result of Server Components is not only HTML. React also produces the **RSC payload**: a compact text description of the rendered tree, with references to Client Components and the props to give them.',
        'On the first visit, the browser gets HTML (to paint quickly) plus the payload (so React knows the tree). On later navigations, the app fetches **only the payload** for the new page and React merges it in — the layout and client state stay in place.',
      ],
      words: [
        ['Payload', 'The data carried in a response.'],
        ['Serialise', 'Turn a structure into text so it can be sent over the network.'],
        ['Soft navigation', 'Moving to a new page inside the app without a full page reload.'],
      ],
      example: 'A delivery note listing exactly what is on the plate and which waiter (Client Component) should serve which part — not the chef’s recipes.',
      remember: 'First load: HTML + payload. Later navigations: payload only.',
      check: ['In DevTools, what do App Router navigations usually fetch?', 'Requests with `?_rsc=` returning the RSC payload text, not full HTML pages.'],
    },
    {
      level: 3, title: 'Partial Prerendering (PPR)',
      text: [
        '**Partial Prerendering** combines the best of static and dynamic in one page. At build time, the framework prerenders a **static shell** — everything that is the same for all users — and leaves holes (Suspense boundaries) for the personal or fresh parts.',
        'On request, the shell is served instantly from the CDN while the server streams in the dynamic holes over the same response.',
        'In Next.js this is the direction of “cache components”: you mark what can be cached, and everything else streams.',
      ],
      words: [
        ['Prerender', 'Render ahead of time, before a request arrives.'],
        ['Static shell', 'The parts of a page that are identical for everyone, served immediately.'],
        ['Dynamic hole', 'A part of the page filled in per request, such as a cart count.'],
      ],
      example: 'A printed brochure with blank boxes that fill in live as you hold it: the layout is instant; your name and basket appear a moment later.',
      remember: 'PPR = static shell instantly + dynamic parts streamed.',
      check: ['On a PPR product page, which parts are in the static shell?', 'Everything the same for all users: layout, product photos, description. The cart count and personal recommendations stream in.'],
    },
    {
      level: 3, title: 'Picking a strategy',
      text: [
        'Same for everyone, rarely changes → **SSG**. Same for everyone, changes sometimes → **ISR** with on-demand revalidation. Different per request → **SSR** with **streaming**. Mostly static with small personal parts → **PPR**. Highly interactive and private → **client components** (or CSR).',
        'And in every case, prefer **Server Components** for parts that do not need interactivity, to ship less JavaScript.',
      ],
      words: [
        ['Trade-off', 'Gaining one thing by giving up another.'],
      ],
      example: 'One e-commerce site: blog (SSG), product pages (ISR + PPR), checkout (SSR), account settings (client components).',
      remember: 'Choose per page, not per app.',
      check: ['A pricing page edited a few times a month by marketing. Best fit?', 'SSG or ISR with on-demand revalidation triggered from the CMS.'],
    },
  ],
};
