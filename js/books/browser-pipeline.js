export default {
  title: 'How a browser turns code into pixels',
  intro: 'You type an address and, a moment later, a page appears. This book walks through every stage in between, starting from “what is a web page made of?” and ending with how experts keep animations perfectly smooth. No prior knowledge needed.',
  chapters: [
    {
      level: 1, title: 'A web page is just three kinds of text',
      text: [
        'A website arrives at your computer as plain text files, like letters in the post. There are three main kinds.',
        '**HTML** says *what is on the page*: a heading, a paragraph, a button, an image. **CSS** says *how it looks*: colours, sizes, where things sit. **JavaScript** says *what it does*: what happens when you click, type or scroll.',
        'None of these files is a picture. The browser’s whole job is to read these three kinds of text and turn them into the coloured dots (pixels) you see on the screen. Everything else in this book is how it does that.',
      ],
      words: [
        ['Browser', 'The app you use to visit websites — Chrome, Safari, Firefox, Edge.'],
        ['Pixel', 'One tiny coloured dot on your screen. A laptop screen has about 2–4 million of them.'],
        ['HTML / CSS / JavaScript', 'The three languages of the web: content, look, and behaviour.'],
      ],
      example: 'A house: HTML is the rooms and furniture, CSS is the paint and decoration, JavaScript is the electricity that makes the lights and doorbell work.',
      remember: 'The browser receives text, not pictures. Turning text into pixels is its job.',
      check: ['If you changed only the colour of every button on a site, which of the three files would you edit?', 'The CSS — it controls how things look, not what they are or what they do.'],
    },
    {
      level: 1, title: 'The browser is a team, not one program',
      text: [
        'Modern browsers split their work across several small programs running at the same time, each in its own walled-off area of memory. These are called **processes**.',
        'The **browser process** is the manager: it draws the address bar and tabs, and handles downloads. Each tab usually gets its own **renderer process**, which reads the page’s files and works out what to show. A **GPU process** does the final drawing using your graphics chip.',
        'Why so many? Safety and stability. If one website crashes or is malicious, its walls stop it from touching your other tabs or your files.',
      ],
      words: [
        ['Process', 'A running program with its own private memory. One process cannot read another’s memory.'],
        ['Renderer', 'The worker that turns one page’s HTML, CSS and JavaScript into a picture.'],
        ['GPU', 'Graphics Processing Unit — a chip built to draw pixels very fast, many at once.'],
      ],
      example: 'Open Chrome’s Task Manager with Shift+Esc. You will see a separate line for every tab and extension. When one tab shows “Aw, Snap!”, the others keep working — that is the walls doing their job.',
      remember: 'One tab = (usually) one renderer process. Crashes stay inside their walls.',
      check: ['Why does a crash in one tab not close your other tabs?', 'Each tab runs in its own renderer process with its own memory, so the crash cannot spread.'],
    },
    {
      level: 1, title: 'Reading the HTML: building the DOM',
      text: [
        'The renderer reads the HTML from top to bottom, piece by piece, while it is still downloading. This reading is called **parsing**.',
        'As it reads, it builds a family tree of everything on the page. `<html>` is the great-grandparent, `<body>` is a child of it, a `<div>` inside the body is a grandchild, and so on. This tree is the **DOM**.',
        'The DOM is not text any more — it is a living structure in memory that JavaScript can read and change. When JavaScript “changes the page”, it is really changing this tree.',
      ],
      words: [
        ['Parsing', 'Reading text and understanding its structure, like a teacher reading a sentence and finding the subject and verb.'],
        ['DOM', 'Document Object Model — the browser’s family tree of everything on the page, kept in memory.'],
        ['Node', 'One member of that tree: an element like a `<p>`, or a piece of text.'],
      ],
      example: 'On a slow phone connection you can often read the top of a long Wikipedia article before the bottom has arrived. The browser builds the DOM as the bytes stream in; it does not wait for the whole file.',
      remember: 'HTML text → parsed → DOM tree. JavaScript talks to the tree, not to the text.',
      check: ['Is the DOM the same thing as the HTML file?', 'No. The HTML file is text; the DOM is the tree the browser builds from it in memory, and it can change after the page loads.'],
    },
    {
      level: 1, title: 'Scripts can pause the reading',
      text: [
        'When the parser meets a normal `<script>` tag, it must stop. The script might change the page with `document.write`, so the browser downloads and runs it before reading another line. This is called **blocking**.',
        'A big script at the top of the page therefore delays everything below it. Two small words fix this. `defer` means “download in the background and run after the HTML is fully read, in order”. `async` means “download in the background and run as soon as you have it, in any order”.',
        'For most app code, `defer` (or `type="module"`, which defers automatically) is the right choice.',
      ],
      words: [
        ['Blocking', 'Making everything else wait until one thing finishes.'],
        ['`defer`', 'A script attribute: fetch now, run after the HTML is parsed, keep order.'],
        ['`async`', 'A script attribute: fetch now, run the moment it arrives, order not guaranteed — good for independent things like analytics.'],
      ],
      example: 'A marketing site that pastes a chat widget `<script>` into the `<head>` without `defer` can show a white screen for an extra second on mobile, because the page cannot be read past that line until the widget arrives.',
      remember: 'Plain `<script>` = stop and wait. `defer` = later, in order. `async` = whenever, any order.',
      check: ['You have two scripts where the second needs the first. `async` or `defer`?', '`defer` — it keeps the order. With `async` the second might run first and break.'],
    },
    {
      level: 2, title: 'CSS becomes the CSSOM, then every element gets a style',
      text: [
        'CSS is parsed into its own tree, the **CSSOM**. Then the browser must decide, for every single element, which rules apply to it and which one wins when two rules disagree. This step is called **style calculation**, and the winner-picking system is the **cascade**.',
        'The result is the **computed style**: one final value for every property of every element (exact colour, exact font size, and so on).',
        'Important detail: the browser will not paint anything until it has all the CSS in the `<head>`. Otherwise you would see the page flash unstyled and then jump. That is why CSS is called **render-blocking**.',
      ],
      words: [
        ['CSSOM', 'CSS Object Model — the parsed form of all the CSS rules.'],
        ['Cascade', 'The rules that decide which CSS declaration wins: importance, then specificity (how precise the selector is), then which came last.'],
        ['Computed style', 'The final, resolved value of each style property for one element.'],
        ['Render-blocking', 'Something that must finish before the first picture can be shown.'],
      ],
      example: 'In DevTools → Elements, pick any element and open the “Computed” tab. That list is the result of style calculation — and Lighthouse’s “Eliminate render-blocking resources” warning is about the waiting described above.',
      remember: 'DOM + CSSOM → computed style for each element. No CSS, no first paint.',
      check: ['Why does the browser not show the page before the CSS file arrives?', 'Because the CSS could change how everything looks; showing it early would cause a flash of unstyled content and a jarring jump.'],
    },
    {
      level: 2, title: 'Layout: working out sizes and positions',
      text: [
        'Knowing that a box is “50% wide with 16px padding” is not enough to draw it. The browser must turn those rules into real numbers: this box starts at x = 240, y = 96, and is 612 × 180 pixels. This step is **layout** (Firefox calls it **reflow**).',
        'Layout is like seating guests at a wedding. Each element’s position depends on its parent and on the elements before it. Make one table bigger and many guests must move.',
        'That is why changing the size or position of something near the top of a page can be expensive: everything after it may need re-measuring.',
      ],
      words: [
        ['Layout / reflow', 'Calculating the exact size and position (the geometry) of every visible box.'],
        ['Geometry', 'Where something is and how big it is.'],
      ],
      example: 'Opening a sidebar that pushes the main content to the right makes the browser re-run layout for the whole main column. In the DevTools Performance panel this shows as a purple “Layout” bar.',
      remember: 'Layout turns style rules into exact boxes with x, y, width and height.',
      check: ['Changing a button’s text colour — does that need layout?', 'No. Colour does not change any box’s size or position, so only painting is needed.'],
    },
    {
      level: 2, title: 'Paint and layers: drawing instructions',
      text: [
        'Next the browser writes a list of drawing instructions: “fill this rectangle beige, draw this text in black at 14px, draw this border”. This is **paint**. No pixels are produced yet — it is a to-do list for drawing.',
        'Some parts of the page are put on their own **layers**, like transparent sheets stacked on top of each other: a fixed header, a video, an element being animated with `transform`.',
        'Finally the GPU process takes the layers, turns them into pixels (**rasterising**) and stacks them in the right order (**compositing**). That final stacking is what reaches your screen.',
      ],
      words: [
        ['Paint', 'Recording the drawing instructions for each layer.'],
        ['Layer', 'A separately drawn sheet that can be moved or faded without redrawing what is on it.'],
        ['Raster / rasterise', 'Turning drawing instructions into actual pixels.'],
        ['Composite', 'Stacking the finished layers in the right order to make the final image.'],
      ],
      example: 'Think of an old cartoon studio: the background is painted once, the characters are on clear sheets on top. To make a character walk, you slide its sheet — you do not repaint the background every frame.',
      remember: 'Style → Layout → Paint → Composite. The later the step you trigger, the cheaper the change.',
      check: ['Why does moving a layer cost less than repainting it?', 'Its pixels already exist; the GPU just draws them in a new place instead of producing them again.'],
    },
    {
      level: 2, title: 'Which changes are cheap and which are expensive',
      text: [
        'Every change you make to a page restarts the pipeline from some step. Changing **width, height, top, left, font-size** restarts at layout — the most work. Changing **colour, background, shadow** skips layout and restarts at paint. Changing **transform** or **opacity** on an element with its own layer skips both and only re-composites — the least work.',
        'So for anything that moves or fades many times a second, prefer `transform: translate()` and `opacity`.',
      ],
      words: [
        ['`transform`', 'A CSS property that moves, scales or rotates an element visually, without changing the layout around it.'],
        ['`opacity`', 'How see-through something is, from 0 (invisible) to 1 (solid).'],
      ],
      example: 'Rearranging furniture (layout) takes an afternoon. Repainting one wall (paint) takes an hour. Sliding a picture frame along a shelf (composite) takes a second.',
      remember: 'Animate `transform` and `opacity`. Avoid animating `top`, `left`, `width`, `height`.',
      check: ['A drawer slides in from the left. What should you animate?', '`transform: translateX(...)` — not `left`, which would force layout on every frame.'],
    },
    {
      level: 3, title: 'Frames and the 16-millisecond budget',
      text: [
        'Screens usually refresh 60 times per second. Each picture is a **frame**, so the browser has about 16.7 ms to produce each one. In that time it may need to run JavaScript, recalculate styles, lay out, paint and composite.',
        'Most of this runs on one **main thread** — one worker that can only do one thing at a time. If your JavaScript takes 120 ms, about 7 frames are missed and the page stutters. This stutter is called **jank**.',
        'Long jobs should be split into smaller pieces, moved off the main thread (into a **Web Worker**), or scheduled for when the browser is idle.',
      ],
      words: [
        ['Frame', 'One complete picture on the screen. 60 frames per second = smooth motion.'],
        ['Main thread', 'The single line of work where JavaScript, style and layout run, one task after another.'],
        ['Jank', 'Visible stutter caused by missed frames.'],
        ['Web Worker', 'A separate thread that runs JavaScript in the background and cannot touch the DOM.'],
      ],
      example: 'A train leaves every 16.7 ms. If your luggage (work) is not on board in time, the train leaves without it, and the passengers (users) see an old picture for another frame.',
      remember: 'About 16 ms per frame at 60 Hz. A long task on the main thread = dropped frames.',
      check: ['A JSON parse takes 80 ms during a scroll. Roughly how many frames are missed?', 'About 5 (80 ÷ 16.7 ≈ 4.8), so the scroll visibly stutters.'],
    },
    {
      level: 3, title: 'Layout thrashing and how experts avoid it',
      text: [
        'The browser is lazy in a good way: when you change styles, it waits and does one layout later. But if you then *read* a size (like `offsetHeight` or `getBoundingClientRect()`), it must do layout right now to give you a correct answer. This is a **forced synchronous layout**.',
        'Doing “write, read, write, read” in a loop forces a layout on every pass. This is **layout thrashing**, and it can freeze a page for hundreds of milliseconds.',
        'The fix is to batch: do all the reads first, then all the writes. `requestAnimationFrame` lets you schedule the writes just before the next frame.',
      ],
      words: [
        ['Forced synchronous layout', 'Making the browser do layout immediately because you asked for a measurement.'],
        ['Layout thrashing', 'Repeatedly forcing layout by mixing reads and writes.'],
        ['`requestAnimationFrame`', 'A browser function that runs your code just before the next frame is drawn.'],
      ],
      example: 'Asking “how tall is the room?” right after moving the sofa forces someone to measure again. Ask all your questions first, then move all the furniture at once.',
      remember: 'Read everything, then write everything. Never interleave in a loop.',
      check: ['Why is `el.style.height = x; el.offsetHeight;` repeated 500 times slow?', 'Each read after a write forces a fresh layout, so you get 500 layouts instead of one.'],
    },
  ],
};
