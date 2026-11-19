# Engineering Atlas

A free, interactive engineering course. Every idea is an animated diagram you step through, with code, interview reasoning, scenarios, history and alternatives.

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
  build.js            helpers: n() node, e() edge, f() flow, z() zone, tree(), arr(), merge()
  player.js           lesson view: walkthrough player + interview / scenarios / history / quiz / cheat sheet
  text.js             prose formatting ([[term]], `code`) and a small syntax highlighter
  icons.js            node icons
js/lessons/<tab>/*.js one file per lesson — pure data
```

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
