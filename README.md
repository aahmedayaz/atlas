# Engineering Atlas

A free, interactive engineering course. Every idea is an animated diagram you step through, with code, interview reasoning, scenarios, history and alternatives.

Tabs: **Engineering** (browser, React internals, shipping React) · **DSA** · **System Design** · **AWS** (root user & IAM users, Regions & Availability Zones, CLI & credentials, CDK bootstrap/deploy, IAM policies & roles, and Amazon S3 in depth).

**Stack:** plain HTML + CSS + JavaScript ES modules. No framework, no build step, no dependencies. Open it with any static server and deploy it to any static host (Vercel, Netlify, Cloudflare Pages, S3).

## Run locally

```bash
npx serve .          # or: python3 -m http.server
```

## Deploy to Vercel

Push the folder to GitHub, import the repo on Vercel, framework preset **Other**, no build command, output directory `.`.

## Folder structure

```
index.html            app shell (fonts, stylesheet, entry script)
styles.css            theme tokens (light + dark), layout, diagram styles
js/app.js             tabs, sidebar, routing (#lesson-id, #lesson-id-s3, #lesson-id-quiz…), search, progress
js/catalog.js         the curriculum: tabs → chapters → lessons (built or "soon")
js/glossary.js        every [[term]] used in lessons
js/engine/
  scene.js            animated SVG renderer: nodes glide between steps, packets travel along edges
  book.js             Magic Book modal (two-page spread, page turns, contents, keys, progress)
  layout.js           auto-layout: sizes nodes from their text, pushes overlaps apart, grows zones,
                      routes edges around nodes, places edge labels where nothing covers them, frames the camera
  build.js            helpers: n() node, e() edge, f() flow, z() zone, tree(), arr(), merge()
  player.js           lesson view: walkthrough player + interview / scenarios / history / quiz / cheat sheet
  text.js             prose formatting ([[term]], `code`) and a small syntax highlighter
  icons.js            node icons
js/lessons/<tab>/*.js one file per lesson — pure data (eng, dsa, sd, aws)
js/scenarios/*.js     Scenario lab cases per lesson
js/books/<id>.js      Magic Book per lesson: chapters from Basic → Core → Advanced, each with plain-words text,
                      new words explained, a real-life example, a one-line takeaway and a check question
js/simple/*.js        "In plain words" analogy + "Real example" for every step: { lessonId: [[plain, example], …] }
```

## Diagram positions are hints

Lesson files give rough `x`/`y` positions. `layout.js` then cleans the picture on every step: no node overlaps,
no edge through a node, no covered label or zone title, and wide empty gaps are squeezed so text stays readable.
The same result is used on every screen size; the camera simply frames it.

## Add a lesson

1. Copy an existing lesson file (e.g. `js/lessons/sd/load-balancing.js`).
2. Write the steps. Each step is data:

```js
{
  short: 'Health checks',               // label in the stepper
  title: 'Stop sending traffic to a dead server',
  tag: 'concept',                       // concept · code · internals · scenario · interview · history
  scene: { nodes: [...], edges: [...], flows: [...], zones: [...] },
  body: ['Paragraph with a [[glossary-key]] and `inline code`.'],
  callout: { kind: 'tip' | 'warn' | 'insight' | 'bad', text: '…' },
  code: { file: 'health.js', lang: 'js', src: `…`, hl: [4, 5] },   // highlighted lines
  vars: { lo: '0 → 5' },                // "What changed" list
  facts: [['requests / s', '6,000']],   // stat tiles above the diagram
  interview: 'What an interviewer wants to hear here.',
}
```

3. Fill the lesson-level sections: `interview`, `scenarios`, `history` (`timeline` + `alts` table), `quiz`, `cheat`.
4. Import it in `js/catalog.js` and put it in a chapter (replace its `soon(...)` entry).

Nodes are matched by `id` between steps, so a node that exists in two steps glides to its new position. Flows reference edges as `'from>to'`; `back: '200 OK'` sends the packet back, `fail: true` makes it burst.
