export default {
  title: 'Re-renders — when React repeats work, and how to stop it',
  intro: 'Re-rendering is normal and usually cheap. But in big apps, unnecessary re-renders make typing and scrolling feel slow. This book explains exactly what causes a re-render and the simple fixes, before reaching for memoization and the React Compiler.',
  chapters: [
    {
      level: 1, title: 'A re-render is React asking again',
      text: [
        'A **re-render** means React calls a component function again to see whether its output changed. It does not mean the DOM changes — if the output is the same, the commit does nothing.',
        'Re-renders are how React stays correct. They only become a problem when expensive components re-run very often for no reason.',
      ],
      words: [
        ['Re-render', 'Running a component function again after something changed.'],
        ['Expensive', 'Taking a lot of time to compute, like drawing a large chart or a list of 5,000 rows.'],
      ],
      example: 'A teacher re-reading the class list when one name changes. Re-reading is quick for 30 names, slow for 30,000.',
      remember: 'Re-render ≠ DOM change. It is only a problem when it is slow and frequent.',
      check: ['A component re-renders and returns the same output. Does the DOM change?', 'No. Reconciliation finds no differences, so nothing is committed for it.'],
    },
    {
      level: 1, title: 'The three reasons a component re-renders',
      text: [
        'A component re-renders when: **(1)** its own state changes; **(2)** its parent re-renders; **(3)** a context it reads changes.',
        'Reason 2 surprises people: React does **not** check whether the props are the same by default. If the parent runs, the children run.',
      ],
      words: [
        ['Parent / child', 'A component that returns another component is its parent; the returned one is the child.'],
        ['Context', 'A React feature for passing data deep down the tree without passing props through every level.'],
      ],
      example: 'When a manager calls a meeting, the whole team attends, even those whose work did not change.',
      remember: 'Own state, parent re-render, or context change.',
      check: ['A `Header` takes no props. Its parent’s state changes. Does `Header` re-render?', 'Yes, by default — because its parent re-rendered.'],
    },
    {
      level: 1, title: 'First fix: keep state close to where it is used',
      text: [
        'The cheapest optimisation is moving state **down**. If only a search box needs the search text, keep that state inside the search box component instead of the page.',
        'Then typing re-renders only the search box, not the entire page.',
      ],
      words: [
        ['Colocation', 'Keeping state in the lowest component that needs it.'],
        ['Lift state up', 'The opposite: moving state to a common parent so several children can share it — necessary sometimes, costly when overdone.'],
      ],
      example: 'Keep the office kettle in the kitchen, not in the CEO’s office — otherwise every cup of tea interrupts the CEO.',
      remember: 'State as low as possible, as high as necessary.',
      check: ['A modal’s `isOpen` state lives in `App`. What re-renders when it opens?', 'The whole `App` tree. Moving `isOpen` into the component that owns the modal limits the re-render.'],
    },
    {
      level: 2, title: 'Second fix: pass heavy parts as children',
      text: [
        'If a wrapper component owns frequently changing state, but contains an expensive part that does not use that state, pass the expensive part in as `children`.',
        'The element `<ExpensiveReport />` is created by the **outer** component. When the wrapper re-renders, `children` is the same object as before, so React skips it.',
      ],
      words: [
        ['`children`', 'The special prop holding whatever you put between a component’s opening and closing tags.'],
        ['Element identity', 'Whether React receives the very same element object as last time; the same object can be skipped.'],
      ],
      example: 'Handing over a sealed box: the courier can change the wrapping paper (the wrapper’s state) without opening the box (the report).',
      remember: '`<Panel><Heavy /></Panel>` — Panel’s state changes do not re-render Heavy.',
      check: ['Why does `children` help even without `memo`?', 'The child element was created by the parent above the wrapper, so it is the same object when only the wrapper re-renders.'],
    },
    {
      level: 2, title: '`memo`: skip when props are the same',
      text: [
        '`const Chart = memo(function Chart(props) { … })` tells React: “before re-rendering this, compare each prop with last time; if all are equal, skip it.”',
        'The comparison is **shallow**: React uses `Object.is` on each prop. Numbers and strings compare by value; objects, arrays and functions compare by **identity** — is it the very same object?',
      ],
      words: [
        ['`memo`', 'A wrapper that makes React skip a component when its props are unchanged.'],
        ['Shallow comparison', 'Comparing each prop one level deep, without looking inside objects.'],
        ['Identity', 'Whether two values are the same object in memory, not just alike.'],
      ],
      example: 'A bouncer checking ID cards: if you show the exact same card as last time, you are waved through without a full check.',
      remember: '`memo` compares props by `Object.is`. Same identity → skip.',
      check: ['`memo` component receives `count={5}` twice. Does it re-render?', 'No — 5 equals 5, so the props are unchanged.'],
    },
    {
      level: 2, title: 'Why `memo` often does nothing',
      text: [
        'Writing `<Chart options={{ sort: "asc" }} onSelect={() => pick()} />` creates a **new object** and a **new function** on every render. They look the same but are different objects, so `memo` sees “changed” every time.',
        'Fix: keep the same object between renders. `useMemo(() => ({ sort: "asc" }), [])` for objects and `useCallback(() => pick(), [])` for functions — or move constants outside the component.',
      ],
      words: [
        ['Inline object', 'An object written directly in JSX like `{{ a: 1 }}`, created fresh each render.'],
        ['`useMemo`', 'A Hook that remembers a calculated value until its dependencies change.'],
        ['`useCallback`', 'A Hook that remembers a function until its dependencies change.'],
      ],
      example: 'Printing a new ID card every morning with the same details — the bouncer sees a new card each day and checks you again.',
      remember: 'Inline objects/functions break `memo`. Stabilise them or hoist them.',
      check: ['Does `useCallback` make a function run faster?', 'No. It keeps the same function object between renders so memoized children can skip.'],
    },
    {
      level: 2, title: 'Context: everyone listening hears every change',
      text: [
        'Every component that reads a context with `useContext` re-renders whenever that context’s **value** changes — even if it only uses one small part of it.',
        'One giant `AppContext` holding user, theme, cart and notifications means a new notification re-renders every themed button.',
        'Fixes: split contexts by topic; keep the provided value stable with `useMemo`; put rarely-changing data in its own context.',
      ],
      words: [
        ['Provider', 'The component that supplies a context value to everything inside it.'],
        ['Consumer', 'A component that reads a context.'],
      ],
      example: 'A building-wide loudspeaker: every announcement interrupts every office, even if it is only for the third floor.',
      remember: 'Small, focused contexts. Stable values.',
      check: ['Why can `value={{ user, setUser }}` on a provider cause extra re-renders?', 'It is a new object every time the provider renders, so all consumers re-render even if `user` did not change.'],
    },
    {
      level: 3, title: 'The React Compiler',
      text: [
        'Adding `memo`, `useMemo` and `useCallback` by hand is tedious and easy to get wrong. The **React Compiler** (stable 1.0 since October 2025) analyses your components at build time and inserts the memoization automatically.',
        'It only works on code that follows the Rules of React (pure render, no mutation of props or state). You enable it as a Babel / Vite / Next.js plugin; manual memo then becomes mostly unnecessary.',
      ],
      words: [
        ['Memoization', 'Remembering a result so it does not have to be recalculated when the inputs are the same.'],
        ['Rules of React', 'The official requirements: pure components, Hooks called at the top level, no mutating props or state.'],
        ['Build time', 'When your code is compiled before deployment, as opposed to when it runs in the browser.'],
      ],
      example: 'A spell-checker that fixes mistakes as you type instead of you proofreading every page by hand.',
      remember: 'Compiler = automatic memo, if your code follows the rules.',
      check: ['Does the Compiler fix a component that mutates props?', 'No. It relies on the Rules of React; code that breaks them is skipped or may behave incorrectly.'],
    },
    {
      level: 3, title: 'Measure before you optimise',
      text: [
        'Guessing wastes time. Use React DevTools: turn on **Highlight updates when components render** to see what flashes, and use the **Profiler** to record an interaction and see which components rendered, why, and how long each took.',
        'Then apply the smallest fix: move state down → use `children` → split context → `memo` with stable props. Re-measure after each change.',
      ],
      words: [
        ['Profiler', 'A tool that records what happened during an interaction and how long each part took.'],
        ['Flame graph', 'A chart where each bar is a component and its width is how long it took to render.'],
      ],
      example: 'A doctor runs tests before prescribing medicine, then checks again to see if it worked.',
      remember: 'Measure → smallest fix → measure again.',
      check: ['The Profiler shows a list re-rendering on every keystroke in an unrelated input. First thing to try?', 'Move the input’s state down into the input component (or pass the list as `children`), so typing no longer re-renders the list.'],
    },
  ],
};
