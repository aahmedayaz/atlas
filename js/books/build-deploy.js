export default {
  title: 'From your code to a live website',
  intro: 'What really happens between `npm run build` and a page loading on someone’s phone? This book explains compiling, bundling, hashing, hosting, CDNs and deploys in plain words — the things every frontend interview eventually asks about.',
  chapters: [
    {
      level: 1, title: 'Why you cannot ship your source files as they are',
      text: [
        'The code you write is made for humans: TypeScript types, JSX, hundreds of small files, long variable names, comments.',
        'Browsers want something else: plain JavaScript they understand, as **few** and as **small** files as possible. A **build** turns your human-friendly source into browser-friendly files.',
      ],
      words: [
        ['Source code', 'The files you write and edit.'],
        ['Build', 'An automated step that transforms source code into files ready to serve to users.'],
        ['TypeScript', 'JavaScript with type labels (`name: string`) that catch mistakes early; browsers cannot run it directly.'],
      ],
      example: 'A chef’s messy recipe notebook versus the neat packaged meal delivered to a customer.',
      remember: 'Source is for developers; the build output is for browsers.',
      check: ['Name two things in your source that a browser cannot run as-is.', 'TypeScript type annotations and JSX.'],
    },
    {
      level: 1, title: 'Dev server versus production build',
      text: [
        'While coding you run a **dev server** (`npm run dev`). It compiles each file only when the browser asks for it, so it starts instantly and updates the page the moment you save (**hot module replacement**).',
        'For real users you run `npm run build`. This does all the work in advance: compile, bundle, shrink and fingerprint every file, and write them into a `dist/` (or `.next/`) folder.',
      ],
      words: [
        ['Dev server', 'A local program that serves your app while you work, optimised for fast feedback.'],
        ['Hot module replacement (HMR)', 'Swapping changed code into the running page without a full reload.'],
        ['Production', 'The live version real users visit.'],
      ],
      example: 'A kitchen cooking each dish as it is ordered (dev) versus a factory preparing and packing every meal before the shop opens (build).',
      remember: 'Dev = fast feedback. Build = fast for users.',
      check: ['Why is the dev server not used for real users?', 'It skips optimisations (bundling, minifying) and compiles on demand, which is slower for visitors.'],
    },
    {
      level: 1, title: 'Compiling: one language for every browser',
      text: [
        'The first job is **transpiling**: removing TypeScript types and turning JSX into function calls, sometimes also rewriting very new JavaScript features for older browsers.',
        'Modern tools like **esbuild** and **SWC** do this in milliseconds because they are written in fast languages (Go and Rust).',
      ],
      words: [
        ['Transpile', 'Translate code into another version of (roughly) the same language.'],
        ['esbuild / SWC', 'Very fast compilers used inside Vite, Next.js and others.'],
      ],
      example: 'A translator turning your notes full of abbreviations into plain sentences everyone can read.',
      remember: 'TS + JSX → plain JavaScript.',
      check: ['Does TypeScript check types in the browser at runtime?', 'No. Types are checked at build/edit time and then removed entirely.'],
    },
    {
      level: 2, title: 'Bundling, tree-shaking and code splitting',
      text: [
        '**Bundling** joins many small modules into a few larger files, so the browser makes fewer requests.',
        '**Tree-shaking** removes code you imported but never used — like dead branches shaken off a tree.',
        '**Code splitting** does the opposite of bundling where it helps: rarely used parts (an admin page, a big chart library) go into separate **chunks** that load only when needed, often with `import()` or `React.lazy`.',
      ],
      words: [
        ['Module', 'One JavaScript file that imports and exports code.'],
        ['Bundle / chunk', 'An output file containing many modules joined together.'],
        ['Tree-shaking', 'Automatically dropping unused exports from the final bundle.'],
        ['Lazy loading', 'Downloading code only when it is first needed.'],
      ],
      example: 'Packing for a house move: related items share boxes (bundling), junk is thrown away (tree-shaking), and the garden tools go in a separate box you open only in spring (code splitting).',
      remember: 'Fewer, smaller files; load the rare stuff later.',
      check: ['Why not put the whole app in one giant file?', 'Every visitor would download code for pages they never open; splitting lets the first page load faster.'],
    },
    {
      level: 2, title: 'Minifying and content hashes',
      text: [
        '**Minifying** shrinks code: removes spaces and comments and renames long variables to single letters. Then servers compress files further with **gzip** or **Brotli**.',
        'Each output file gets a **content hash** in its name: `index-3f9a1c.js`. The hash is calculated from the file’s contents, so it changes only when the contents change.',
        'That makes caching safe: browsers can keep hashed files for a year, and a new deploy simply references new file names.',
      ],
      words: [
        ['Minify', 'Make code smaller without changing what it does.'],
        ['Content hash', 'A short fingerprint computed from a file’s contents.'],
        ['Cache', 'A saved copy kept nearby so it does not have to be downloaded again.'],
      ],
      example: 'Vacuum-packing clothes (minify), and printing a label that changes whenever the contents change, so nobody grabs an old box by mistake (hash).',
      remember: 'Hashed names → cache forever, never stale.',
      check: ['Why can `index-3f9a1c.js` be cached for a year safely?', 'If its contents change, its name changes too, so the browser will request the new file.'],
    },
    {
      level: 2, title: 'Static hosting and CDNs',
      text: [
        'A client-rendered app’s build output is just files: one HTML page, some JS and CSS, images. Any **static host** can serve them — no server code runs.',
        'A **CDN** copies those files to servers in many cities. A visitor in Karachi is served from a nearby **edge** location instead of a server across the world, so files arrive much sooner.',
      ],
      words: [
        ['Static host', 'A service that serves files exactly as they are, with no code running per request.'],
        ['CDN', 'Content Delivery Network — servers in many locations that keep copies of your files close to users.'],
        ['Edge', 'A CDN location near the user.'],
        ['Latency', 'The delay for data to travel between two places.'],
      ],
      example: 'A bakery chain with shops in every neighbourhood instead of one big bakery everyone must travel to.',
      remember: 'Static files + CDN = fast, cheap, simple.',
      check: ['What does a CDN mainly reduce?', 'Latency — the distance (and time) between the user and the files.'],
    },
    {
      level: 2, title: 'What happens when you `git push` to Vercel',
      text: [
        'Vercel watches your GitHub repository. On every push it starts a fresh machine, installs your dependencies, runs your build command, and uploads the result. You never build on your own laptop.',
        'Every branch and pull request gets its own **preview deployment** with a unique URL; merging to `main` updates **production**.',
        'For frameworks like Next.js, the output is split: static files go to the CDN; server code becomes **Functions** that run on demand in a region.',
      ],
      words: [
        ['Repository (repo)', 'The folder of your project’s code and its full history, stored with Git.'],
        ['Preview deployment', 'A live copy of a branch at its own URL, for testing before release.'],
        ['Serverless function', 'Server code that runs only when a request arrives, managed by the platform.'],
      ],
      example: 'Each pull request link can be sent to a designer or product manager to click through before anything goes live.',
      remember: 'Push → build in the cloud → static to CDN, server code to Functions.',
      check: ['Where does the build run when you deploy on Vercel?', 'On Vercel’s build machines, from the code in your repository.'],
    },
    {
      level: 3, title: 'Immutable deploys and instant rollback',
      text: [
        'Every deploy is a sealed, numbered snapshot that never changes. Your domain is just a pointer to one of them.',
        'Releasing means moving the pointer to a new snapshot. Rolling back means moving it back to an old one — no rebuild, so it takes seconds.',
      ],
      words: [
        ['Immutable', 'Cannot be changed after it is created.'],
        ['Rollback', 'Returning production to a previous working version.'],
        ['Atomic', 'All-or-nothing: users get either the old version or the new one, never a mix.'],
      ],
      example: 'A shop sign pointing to one of several fully stocked stalls. If the new stall has a problem, you point the sign back to yesterday’s stall.',
      remember: 'Deploy = new snapshot + move the pointer.',
      check: ['Why is a rollback on Vercel almost instant?', 'The old deployment still exists unchanged; only the domain pointer moves.'],
    },
    {
      level: 3, title: 'Caching across deploys',
      text: [
        'The HTML page is usually served with short or no caching, so visitors always get the newest version, which points at the newest hashed files.',
        'Hashed JS and CSS files are served with `Cache-Control: public, max-age=31536000, immutable`. Returning visitors download only files whose hash changed — often just one small chunk.',
      ],
      words: [
        ['`Cache-Control`', 'An HTTP header telling browsers and CDNs how long they may keep a file.'],
        ['`max-age`', 'How many seconds a cached copy stays valid. 31,536,000 is one year.'],
        ['HTTP header', 'Extra information sent along with a request or response.'],
      ],
      example: 'You re-check the restaurant’s menu each visit (HTML), but keep the cooking pots you already own (hashed assets).',
      remember: 'HTML: always fresh. Hashed assets: cached for a year.',
      check: ['After a tiny CSS fix, what does a returning visitor download?', 'The HTML and the one changed CSS file; unchanged hashed JS comes from cache.'],
    },
  ],
};
