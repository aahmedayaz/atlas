export default {
  title: 'The DOM, the Virtual DOM and JSX — from zero',
  intro: 'Why does React exist at all? This book starts with how a page is stored inside the browser, shows why changing it by hand gets messy, and ends with how React describes the screen and updates only what changed.',
  chapters: [
    {
      level: 1, title: 'The page lives in memory as a tree',
      text: [
        'When a browser reads HTML it builds a tree of objects in memory: the **DOM**. Every tag becomes an object (an **element**), and every piece of text becomes a small text object. Each object knows its parent and its children.',
        'What you see on screen is drawn *from* this tree. Change the tree and, a moment later, the screen changes too.',
      ],
      words: [
        ['DOM', 'Document Object Model — the browser’s tree of the page, kept in memory.'],
        ['Element', 'One tag on the page turned into an object, like a heading or a button.'],
        ['Object', 'In programming, a bundle of named values, like a contact card with name, phone and email.'],
      ],
      example: 'A family tree on a wall: grandparents at the top, parents below, children below them. The page’s `<html>` is the grandparent; buttons and paragraphs are the grandchildren.',
      remember: 'The DOM is a tree in memory. The screen is drawn from it.',
      check: ['If you delete a node from the DOM, what happens on screen?', 'That part of the page disappears at the next paint, because the screen is drawn from the tree.'],
    },
    {
      level: 1, title: 'JavaScript changes the page through the DOM',
      text: [
        'JavaScript cannot touch pixels. Instead it asks the browser for a handle to a DOM node and changes that node. `document.querySelector("#price")` finds a node; `.textContent = "$20"` changes its text.',
        'These calls are the **DOM API**. Each one crosses from JavaScript into the browser’s own code, which is written in C++. A single call is fast; thousands of careless calls are not.',
      ],
      words: [
        ['API', 'A set of buttons one program offers to another. The DOM API is the set of functions the browser offers JavaScript for reading and changing the page.'],
        ['`querySelector`', 'A DOM function that finds the first element matching a CSS selector such as `#price` or `.card`.'],
      ],
      example: 'You hold a TV remote (JavaScript). The TV (the browser) does the real work. Every button press sends a signal across the room — quick, but you would not press it ten thousand times a second.',
      remember: 'JavaScript → DOM API → browser updates the tree → screen updates.',
      check: ['Does `el.textContent = "Hi"` draw pixels directly?', 'No. It changes the DOM tree; the browser then redraws the affected part of the screen.'],
    },
    {
      level: 1, title: 'Why hand-written updates get messy',
      text: [
        'In a small page, updating the DOM by hand is fine. In a real app the same piece of data appears in many places: the cart count in the header, in the cart panel, on the checkout button.',
        'Every time the data changes you must remember *every* place to update. Miss one, and the screen shows two different truths. This is called **state getting out of sync**.',
      ],
      words: [
        ['State', 'The data your app is currently holding, like “the cart has 3 items”.'],
        ['Out of sync', 'Two parts of the screen showing different values for the same data.'],
      ],
      example: 'A restaurant prints its prices on the menu, the board outside and the website. Change a price and forget the board, and a customer sees two prices for the same dish.',
      remember: 'The more places data appears, the harder hand-written DOM updates become.',
      check: ['What is the real problem with hand-written DOM updates in big apps?', 'Keeping every place that shows the same data in sync; it is easy to forget one.'],
    },
    {
      level: 2, title: 'The React idea: describe, don’t edit',
      text: [
        'React flips the job around. You do not write “change this text, then hide that button”. You write a function that says **what the screen should look like for the current data**. When the data changes, React calls your function again and works out the edits itself.',
        'This style is called **declarative**: you declare the result. The old style is **imperative**: you give step-by-step orders.',
      ],
      words: [
        ['Declarative', 'Describing *what* you want (“a list of these 3 items”), not *how* to get there.'],
        ['Imperative', 'Giving step-by-step orders (“add this row, then remove that row”).'],
        ['Component', 'In React, a function that returns a description of part of the screen.'],
      ],
      example: 'Telling a taxi driver the address (declarative) versus giving every turn yourself (imperative). The driver handles the route; React handles the DOM edits.',
      remember: 'In React you write “UI = f(state)”. React figures out the edits.',
      check: ['Is “set the counter text to 5” declarative or imperative?', 'Imperative — it is an order. Declarative would be “the counter shows `count`”, and React keeps it true.'],
    },
    {
      level: 2, title: 'JSX is just shorthand',
      text: [
        'React code often looks like HTML inside JavaScript: `<h1>Hello</h1>`. That is **JSX**. Browsers cannot read JSX, so a build tool (**compiler**) rewrites it into normal function calls before the code ships.',
        '`<Button color="red">Save</Button>` becomes roughly `jsx(Button, { color: "red", children: "Save" })`. Nothing magical: it is a function call that returns an object.',
      ],
      words: [
        ['JSX', 'A syntax that lets you write HTML-like tags inside JavaScript.'],
        ['Compiler', 'A tool that translates code from one form into another before it runs (Babel, SWC, esbuild).'],
        ['Props', 'Short for properties — the inputs you pass to a component, like `color="red"`.'],
      ],
      example: 'Writing “ASAP” in a note that a secretary types out as “as soon as possible” before it is sent. JSX is the shorthand; the compiler types it out.',
      remember: 'JSX → compiled to `jsx(...)` calls → returns plain objects.',
      check: ['Can a browser run a `.jsx` file directly?', 'No. It must be compiled to plain JavaScript first.'],
    },
    {
      level: 2, title: 'Elements are descriptions, not the real thing',
      text: [
        'The object returned by `jsx(...)` is a **React element**: a small note like `{ type: "h1", props: { children: "Hello" } }`. It is not a DOM node and is not on screen.',
        'Elements are cheap to make and are never edited. Each render makes fresh ones. A tree of these descriptions is what people call the **Virtual DOM**.',
      ],
      words: [
        ['React element', 'A plain object describing one piece of UI: its type and its props.'],
        ['Virtual DOM', 'The tree of React elements — React’s lightweight description of what the DOM should be.'],
        ['Immutable', 'Never changed after it is made. To change it, you make a new one.'],
      ],
      example: 'An architect’s sketch on paper. You can draw a hundred sketches cheaply; only the final one is used to move real bricks.',
      remember: 'React elements are sketches. The DOM is the building.',
      check: ['`console.log(<p>Hi</p>)` prints what?', 'A plain object with `type: "p"` and `props`. No DOM node is created.'],
    },
    {
      level: 2, title: 'From description to real DOM: the root',
      text: [
        'Your page starts with an empty `<div id="root">`. `createRoot(div).render(<App />)` tells React: “this element is yours; keep it matching my description”.',
        'On the first render React creates all the DOM nodes. On later renders it compares the new description with the previous one and changes only the differences. This comparison is **reconciliation**.',
      ],
      words: [
        ['Root', 'The one real DOM element React controls; everything React draws lives inside it.'],
        ['Render (in React)', 'Calling your components to get a fresh description.'],
        ['Reconciliation', 'Comparing the old and new descriptions to find the smallest set of DOM changes.'],
      ],
      example: 'An empty plot of land (the root). The first time, the builder builds the whole house. After that, they only repaint the room you asked to change.',
      remember: 'First render = create everything. Later renders = compare and patch.',
      check: ['What happens if you delete the `createRoot(...).render(...)` line?', 'Nothing is drawn: React never gets a root to put the UI in, so the page stays empty.'],
    },
    {
      level: 3, title: 'Is the Virtual DOM “faster than the DOM”?',
      text: [
        'A common myth says React is fast because the Virtual DOM is faster than the real DOM. Not quite. React still has to change the real DOM; building and comparing descriptions is *extra* work.',
        'What the Virtual DOM really buys is **correctness with good-enough speed**: you write simple “describe the screen” code, and React batches the minimum changes for you. Hand-written, perfectly targeted DOM code can be faster — but it is much harder to keep correct.',
        'Some newer libraries (Svelte, Solid) skip the Virtual DOM and compile updates straight to targeted DOM calls. React chose descriptions plus a smart compare step.',
      ],
      words: [
        ['Batching', 'Collecting many changes and applying them together in one go.'],
        ['Fine-grained reactivity', 'An approach (Solid, Svelte 5 runes) where each piece of data knows exactly which DOM node to update, with no tree comparison.'],
      ],
      example: 'A good accountant does not make you cheaper than doing your own taxes perfectly — but they make mistakes far less likely and save you hours.',
      remember: 'The Virtual DOM is about simple, correct code, not raw speed.',
      check: ['Why is “VDOM is faster than the DOM” misleading?', 'React still updates the real DOM; the VDOM adds work. Its value is making correct updates easy, with batching keeping it fast enough.'],
    },
    {
      level: 3, title: 'SPAs: one page that redraws itself',
      text: [
        'Because React can redraw any part of the page, a whole app can live in one HTML page. Clicking a link only changes the URL and swaps components; no new HTML page is downloaded. This is a **single-page application (SPA)**.',
        'The cost: the first visit must download the JavaScript before anything useful appears. That trade-off leads to server rendering, which later lessons cover.',
      ],
      words: [
        ['SPA', 'Single-Page Application — the browser loads one page once, and JavaScript redraws it as you navigate.'],
        ['Client-side routing', 'Changing the URL and the visible screen with JavaScript instead of loading a new page.'],
      ],
      example: 'Gmail, Figma and Notion load once; moving between emails or files afterwards only fetches data.',
      remember: 'SPA = fast moves after load, slower first load.',
      check: ['What does an SPA download when you click to a new page inside the app?', 'Usually just data (and maybe a small code chunk), not a new HTML page.'],
    },
  ],
};
