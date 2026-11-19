export default {
  title: 'Fiber and lanes — how React keeps typing smooth',
  intro: 'How can React render a huge list and still let you type without lag? This book explains the problem with the old React, what a “fiber” is, how React pauses work, and how “lanes” decide what is urgent.',
  chapters: [
    {
      level: 1, title: 'One worker, many jobs',
      text: [
        'JavaScript in a web page runs on one **main thread**. It can do only one thing at a time: run your code, handle a click, update the page. While it is busy, everything else waits.',
        'If one job takes 300 ms, a key press made during that time is not handled until the job ends. To the user, the page feels frozen.',
      ],
      words: [
        ['Thread', 'A line of work a computer follows, one step after another.'],
        ['Main thread', 'The single thread in a web page that runs JavaScript and updates the screen.'],
        ['ms', 'Millisecond — one thousandth of a second. 100 ms is when delays start to feel noticeable.'],
      ],
      example: 'A café with one barista. If they spend five minutes on one complicated order, everyone else in the line waits — even someone who only wants water.',
      remember: 'One main thread. Long work = everything else waits.',
      check: ['Why does a long JavaScript task make typing lag?', 'Key presses are handled on the same main thread, which is busy until the task finishes.'],
    },
    {
      level: 1, title: 'The old React could not stop',
      text: [
        'React 15 and earlier rendered a whole update in one go by calling components inside other components, like opening boxes inside boxes. This used the JavaScript **call stack**, which cannot be paused halfway and resumed later.',
        'For big updates (a 2,000-row table) this blocked the main thread, and typing felt sluggish.',
      ],
      words: [
        ['Call stack', 'The list JavaScript keeps of which functions are running inside which. It must finish from the top down; you cannot leave and come back.'],
        ['Recursion', 'A function calling itself on smaller parts, like opening a box that contains more boxes.'],
      ],
      example: 'A cook who has promised never to leave the stove until the whole banquet is done — the doorbell goes unanswered.',
      remember: 'Old React: one big uninterruptible job per update.',
      check: ['What could old React not do in the middle of a render?', 'Pause to handle something more urgent, like a key press.'],
    },
    {
      level: 1, title: 'A fiber is a work ticket',
      text: [
        'React 16 introduced **Fiber**: instead of using the call stack, React keeps its own objects, one per component or element. Each **fiber** is like a ticket on a kitchen rail: what component this is, its props, its state, and what work is still needed.',
        'Because React keeps the tickets itself, it can stop after any ticket and pick up later exactly where it left off.',
      ],
      words: [
        ['Fiber', 'React’s internal object for one component or element, holding its type, props, state and pending work.'],
        ['Unit of work', 'One small piece of a bigger job that can be done and then paused after.'],
      ],
      example: 'Order tickets on a kitchen rail. The chef can stop between tickets to serve an urgent customer, then continue with the next ticket.',
      remember: 'Fiber = React’s own to-do list, so work can be paused.',
      check: ['Why did React need its own data structure instead of the call stack?', 'The call stack cannot be paused; React’s own fiber objects can be walked one at a time and resumed later.'],
    },
    {
      level: 2, title: 'Fibers link together like a treasure hunt',
      text: [
        'Each fiber has three links: `child` (its first child), `sibling` (the next one at the same level) and `return` (its parent). With these, React can walk the whole tree with a simple loop — no recursion needed.',
        'The loop is: work on this fiber; go to its child if it has one; otherwise go to its sibling; otherwise go back up and try the parent’s sibling.',
      ],
      words: [
        ['Linked list', 'Items that each point to the next one, like clues in a treasure hunt.'],
        ['Pointer / link', 'A reference from one object to another.'],
        ['Traversal', 'Visiting every item in a structure in some order.'],
      ],
      example: 'A treasure hunt where every clue says “first go down to …, then next door to …, and if nothing is left, go back up to …”. You can put the hunt down and resume from the last clue.',
      remember: 'child → sibling → return: a loop React can pause.',
      check: ['After a fiber with no child and no sibling, where does React go?', 'Back up via `return` to its parent, then to the parent’s sibling.'],
    },
    {
      level: 2, title: 'Going down and coming back up',
      text: [
        'On the way **down**, React runs `beginWork` for each fiber: it calls your component (or reuses the last result) and creates fibers for its children.',
        'On the way **up**, React runs `completeWork`: it prepares DOM nodes for host elements like `<li>` and gathers which changes the commit will need.',
        'When the walk reaches the top again, the render phase is complete and React can commit.',
      ],
      words: [
        ['`beginWork`', 'The step that renders a fiber and produces its children.'],
        ['`completeWork`', 'The step that finishes a fiber, preparing DOM nodes and noting changes.'],
        ['Host component', 'A plain HTML element like `div` or `li`, as opposed to your own components.'],
      ],
      example: 'Walking down stairs opening every door to check each room, then walking back up closing each door and writing notes on what to fix.',
      remember: 'Down: render children. Up: prepare DOM and record changes.',
      check: ['During which step are DOM nodes for new `<li>` elements created?', 'During `completeWork`, on the way back up.'],
    },
    {
      level: 2, title: 'Yielding: stepping aside every few milliseconds',
      text: [
        'In concurrent rendering, React’s loop checks a timer between fibers. Roughly every 5 ms, `shouldYield()` says “time’s up”. React then hands the main thread back to the browser so it can handle clicks, typing and painting, and continues rendering afterwards.',
        'This is called **yielding**, and it is what keeps the page responsive during big renders.',
      ],
      words: [
        ['Yield', 'Voluntarily give up the main thread so other work can run.'],
        ['Concurrent rendering', 'React’s ability to work on renders in small slices and interrupt them.'],
        ['Scheduler', 'React’s internal helper that decides when to run and when to yield.'],
      ],
      example: 'A kitchen timer that rings every few minutes: the cook steps away so the waiter can pass orders, then goes back to the pot.',
      remember: 'Concurrent render = small slices with breaks for the browser.',
      check: ['Does yielding make a big render finish faster?', 'Not faster in total — it makes the page stay responsive while the render happens.'],
    },
    {
      level: 2, title: 'Two trees: on screen and in progress',
      text: [
        'React keeps two fiber trees. The **current** tree matches what is on screen. The **work-in-progress** tree is the draft being built during render.',
        'If the draft is abandoned (a newer, more urgent update arrived), the screen is untouched because the current tree was never changed. When the draft finishes and commits, it becomes the new current tree. This swap is called **double buffering**.',
      ],
      words: [
        ['Current tree', 'The fibers that match what the user sees right now.'],
        ['Work-in-progress tree', 'The draft fibers being built for the next screen.'],
        ['Double buffering', 'Drawing the next picture off-screen, then swapping it in all at once.'],
      ],
      example: 'Editing a copy of a document and only replacing the original when the edit is complete.',
      remember: 'Draft in the background; swap only when finished.',
      check: ['Why can React throw away a half-finished render safely?', 'The work-in-progress tree is separate; the current tree and the screen were never changed.'],
    },
    {
      level: 3, title: 'Lanes: priority for updates',
      text: [
        'Not all updates are equally urgent. Typing should feel instant; re-filtering 10,000 products can wait a moment. React marks each update with a **lane** — a priority level stored as a bit in a number.',
        'Clicks and key presses get a high-priority lane (**SyncLane** for discrete events). Updates wrapped in `startTransition` get a **TransitionLane**. React always works on the most urgent lanes first.',
      ],
      words: [
        ['Lane', 'React’s label for how urgent an update is.'],
        ['Priority', 'Which job should be done first.'],
        ['Bitmask', 'A number where each binary digit is an on/off switch — a fast way to store many flags.'],
      ],
      example: 'Motorway lanes: ambulances use the fast lane; delivery vans stay in the slow lane and pull over when needed.',
      remember: 'Every update has a lane. Urgent lanes go first.',
      check: ['Which lane does an update inside `startTransition` use?', 'A TransitionLane, which is lower priority than input updates.'],
    },
    {
      level: 3, title: 'When an urgent update arrives mid-render',
      text: [
        'Suppose React is halfway through a transition render (filtering a long list) and the user clicks “Clear”. At the next yield point React sees a higher-priority lane waiting.',
        'It **abandons** the half-built draft, renders and commits the urgent update, and then starts the transition render again on top of the new state. The user sees the click handled immediately.',
      ],
      words: [
        ['Interrupt', 'Stop current work because something more important arrived.'],
        ['Rebase', 'Redo lower-priority work on top of the newest state.'],
      ],
      example: 'An ambulance comes up behind a slow van: the van pulls over, the ambulance passes, then the van continues.',
      remember: 'Urgent update wins; the transition is restarted afterwards.',
      check: ['What happens to the half-finished transition render when a click arrives?', 'It is thrown away; React handles the click, then restarts the transition with fresh state.'],
    },
    {
      level: 3, title: 'Using it yourself: `useTransition` and `useDeferredValue`',
      text: [
        'You opt in to this priority system with two Hooks. `const [isPending, startTransition] = useTransition()` lets you wrap a slow state update: `startTransition(() => setFilter(text))`. The input updates instantly; the slow result follows.',
        '`useDeferredValue(value)` gives you a copy of a value that “lags behind” during busy moments, so an expensive child can render the older value while the input stays snappy.',
      ],
      words: [
        ['`useTransition`', 'A Hook that marks some state updates as non-urgent and tells you while they are pending.'],
        ['`useDeferredValue`', 'A Hook that returns a version of a value that may update a little later when the app is busy.'],
      ],
      example: 'Search-as-you-type on an online shop: the letters appear immediately; the product grid catches up a moment later, with a subtle “updating…” hint from `isPending`.',
      remember: 'Keep input updates urgent; wrap heavy updates in a transition.',
      check: ['Should the input’s own `setText` go inside `startTransition`?', 'No. The input must stay urgent; only the heavy update (the filter/results) goes in the transition.'],
    },
  ],
};
