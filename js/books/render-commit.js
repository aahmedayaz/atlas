export default {
  title: 'What “render” really means in React',
  intro: 'React people say “render” all the time, and it rarely means “draw on the screen”. This book separates the four moments — trigger, render, commit, paint — and builds up to state snapshots, purity and Strict Mode.',
  chapters: [
    {
      level: 1, title: 'Four moments, one update',
      text: [
        'Every change you see in a React app goes through four moments. **Trigger**: something asks for an update (a click sets state). **Render**: React calls your components to get a new description. **Commit**: React applies the differences to the real DOM. **Paint**: the browser draws the new pixels.',
        'Only the last two touch the real page. Render is just React asking your code a question.',
      ],
      words: [
        ['Trigger', 'The event that starts an update, usually a state change.'],
        ['Render', 'React calling your component functions to get a fresh description of the UI.'],
        ['Commit', 'React writing the needed changes into the real DOM.'],
        ['Paint', 'The browser drawing the updated pixels on screen.'],
      ],
      example: 'Ordering coffee: you order (trigger), the barista makes it (render), hands it over in one go (commit), and you finally see and taste it (paint).',
      remember: 'Trigger → Render → Commit → Paint.',
      check: ['Does “a component rendered” mean the screen changed?', 'No. It only means React called the function. The screen changes only if the commit found differences.'],
    },
    {
      level: 1, title: 'State: the memory of a component',
      text: [
        'A component is a function, and functions forget everything when they finish. To remember things between renders (a counter, the text in a box), React gives you **state** with `useState`.',
        '`const [count, setCount] = useState(0)` gives you the current value and a **setter** function. Calling the setter does not change the variable on the spot — it asks React for a new render with a new value.',
      ],
      words: [
        ['`useState`', 'A React Hook that gives a component a value it remembers between renders, plus a function to change it.'],
        ['Hook', 'A special React function whose name starts with `use`, called at the top of a component.'],
        ['Setter', 'The function (like `setCount`) that schedules a new value and a re-render.'],
      ],
      example: 'A whiteboard next to a goldfish. The goldfish (your function) forgets everything, but it can read and write the whiteboard (state) each time it swims past.',
      remember: 'State survives between renders. The setter schedules a new render.',
      check: ['Right after `setCount(5)`, does `count` equal 5 on the next line?', 'No. `count` stays the old value in this render; the new value appears in the next render.'],
    },
    {
      level: 1, title: 'The first render builds everything',
      text: [
        'When the app starts, there is no previous picture to compare with. React calls every component, collects the full description, creates every DOM node and attaches the whole tree to the root at once.',
        'After that first time, every later update is a **re-render**: React compares with what it already has and changes only what differs.',
      ],
      words: [
        ['Mount', 'A component appearing on the page for the first time.'],
        ['Re-render', 'Calling a component again after a change, to see if its output differs.'],
      ],
      example: 'Opening night of a play: every set piece is built. Later performances only swap the props that change between scenes.',
      remember: 'First render = mount everything. Later = compare and patch.',
      check: ['On the very first render, does React compare anything?', 'No — there is nothing to compare with, so it creates all the DOM nodes.'],
    },
    {
      level: 2, title: 'Render is off-stage work',
      text: [
        'During render React builds the new version in memory while the user still sees the old screen. Nothing on the page changes during this phase.',
        'Because nothing visible changes, React can **pause, restart or throw away** render work (React 18+ uses this for transitions). If render touched the DOM halfway, the user would see half-built screens.',
      ],
      words: [
        ['Render phase', 'The part of an update where React calls components and computes changes, without touching the DOM.'],
        ['Interruptible', 'Able to be paused and resumed (or abandoned) before finishing.'],
      ],
      example: 'A stage crew builds the next scene behind the curtain. The audience never sees half a castle.',
      remember: 'Render can be interrupted because it has no visible effect.',
      check: ['Why must render not change the DOM directly?', 'Render may be paused or thrown away; DOM changes would leave the user looking at a half-finished screen.'],
    },
    {
      level: 2, title: 'Commit: one clean switch',
      text: [
        'Once render is done, React enters the **commit phase**. It applies every collected change — insert this node, update that text, remove this one — in one uninterrupted pass. The browser then paints the result.',
        'Commit cannot be interrupted, so the user always sees either the old screen or the complete new one.',
        'Right after commit, React runs your **effects**: `useLayoutEffect` before the paint, `useEffect` usually after it.',
      ],
      words: [
        ['Commit phase', 'The synchronous step where React writes all changes into the DOM.'],
        ['Synchronous', 'Done in one go, without stopping for anything else.'],
        ['Effect', 'Code you ask React to run after commit, for talking to things outside React.'],
      ],
      example: 'Pulling back the theatre curtain: one smooth movement reveals the whole finished scene.',
      remember: 'Render can pause. Commit never does.',
      check: ['Can the user ever see half of a commit?', 'No. Commit runs in one pass before the browser paints.'],
    },
    {
      level: 2, title: 'State is a snapshot',
      text: [
        'Inside one render, state values are **constants**. If `count` is 0 in this render, it is 0 everywhere in this render — including inside click handlers created in it.',
        'So `setCount(count + 1)` three times queues “set to 1” three times, and the result is 1, not 3. To build on the latest value, pass an **updater function**: `setCount(c => c + 1)`. React runs updaters in order, each receiving the previous result.',
      ],
      words: [
        ['Snapshot', 'A frozen copy of values at one moment.'],
        ['Updater function', 'A function you pass to the setter, like `c => c + 1`, that computes the next value from the latest one.'],
        ['Queue', 'A waiting line where items are processed in order.'],
      ],
      example: 'A photograph of a scoreboard. Writing “score + 1” three times on the same photo gives the same answer each time. Asking the scorekeeper to add one, three times, gives +3.',
      remember: 'Next value depends on the previous one? Use `setX(prev => …)`.',
      check: ['`setCount(count + 1); setCount(count + 1);` with count = 4 — what is next?', '5. Both calls read the same snapshot (4).'],
    },
    {
      level: 2, title: 'Which components re-render?',
      text: [
        'When state changes in a component, React re-renders **that component and everything it returns below it**. Parents and siblings above are not re-rendered.',
        'React can skip a child if nothing about it could have changed — for example, if it is wrapped in `memo` and receives the same props. In the DevTools Profiler, skipped components appear grey.',
      ],
      words: [
        ['Subtree', 'A component plus all the components inside it.'],
        ['`memo`', 'A wrapper that lets React skip a component when its props are unchanged.'],
        ['Bail out', 'React deciding to skip work for a component because nothing changed.'],
      ],
      example: 'When one department changes its rules, only that department and the teams under it get the new memo — not the whole company.',
      remember: 'State change re-renders that component and its children, never its parents.',
      check: ['A child calls its own setter. Does the parent re-render?', 'No. Only the child and its own subtree.'],
    },
    {
      level: 3, title: 'Render must be pure',
      text: [
        'Because React may call your component more than once, pause it, or throw the result away, the component must be **pure**: same props and state in, same description out, and no side jobs (no network requests, no changing outside variables, no DOM changes).',
        'Side jobs belong in event handlers or effects, which run at well-defined times.',
      ],
      words: [
        ['Pure function', 'A function that always returns the same output for the same input and changes nothing outside itself.'],
        ['Side effect', 'Anything a function does besides returning a value: network calls, timers, writing to variables outside, changing the DOM.'],
      ],
      example: 'A calculator: press 2 + 2 and you always get 4, and the calculator never secretly orders a pizza while working it out.',
      remember: 'Render calculates. Handlers and effects act.',
      check: ['Why is `items.push(x)` on an outside array inside render a bug?', 'It is a side effect: each extra render pushes again, so items appear twice (or more).'],
    },
    {
      level: 3, title: 'Strict Mode renders twice on purpose',
      text: [
        'In development, `<StrictMode>` calls your components twice and runs effect setup → cleanup → setup once more. In production it does not.',
        'This is a deliberate test: a pure component gives the same result twice, so nothing changes. An impure one shows the bug immediately (duplicate items, double requests) instead of months later in production.',
      ],
      words: [
        ['Strict Mode', 'A development-only React wrapper that runs extra checks to expose unsafe code.'],
        ['Development build', 'The version of your app used while coding, with extra warnings; production builds remove them.'],
      ],
      example: 'A teacher asks you to solve the same sum twice. If you get two different answers, something in your method is wrong.',
      remember: 'Double logs in development are Strict Mode, not a bug in React.',
      check: ['Your effect logs “connected” twice in development only. Bug?', 'Not by itself — Strict Mode runs setup, cleanup, setup. Make sure cleanup disconnects so the real app has one connection.'],
    },
  ],
};
