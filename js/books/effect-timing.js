export default {
  title: 'Effects and timing — when your code actually runs',
  intro: 'React gives you several places to run code after an update. Picking the wrong one causes flicker, double requests or jumping scroll positions. This book builds up from “what is an effect?” to keeping a chat’s scroll position perfect.',
  chapters: [
    {
      level: 1, title: 'What an effect is for',
      text: [
        'Most of a component is a pure calculation: data in, description out. But sometimes you must talk to things **outside** React: open a WebSocket, start a timer, listen to window resizing, measure an element.',
        '`useEffect(() => { … })` is where that code goes. React runs it **after** the update has been committed, so it never slows down the calculation itself.',
      ],
      words: [
        ['Effect', 'Code that synchronises your component with something outside React.'],
        ['External system', 'Anything React does not control: the network, timers, browser APIs, third-party widgets.'],
        ['WebSocket', 'A connection that stays open so a server can push messages to the page, used for chats and live data.'],
      ],
      example: 'Plugging your phone into a charger when you arrive at your desk. The charger is outside the phone; the effect is the act of connecting.',
      remember: 'Effects connect a component to the outside world.',
      check: ['Should you compute a filtered list inside an effect?', 'No. That is pure calculation; do it during render. Effects are for talking to outside systems.'],
    },
    {
      level: 1, title: 'Setup, cleanup and dependencies',
      text: [
        'An effect can return a **cleanup** function. React runs cleanup before running the effect again, and when the component disappears.',
        'The second argument, the **dependency array**, says when to re-run: `[roomId]` means “re-run when `roomId` changes”. `[]` means “only after the first render”. No array means “after every render”.',
      ],
      words: [
        ['Cleanup', 'A function that undoes what the effect set up: disconnect, clear a timer, remove a listener.'],
        ['Dependency array', 'The list of values an effect uses; React re-runs the effect when any of them changes.'],
      ],
      example: 'Switching chat rooms: hang up the call to the old room (cleanup) before dialling the new room (setup).',
      remember: 'Every setup needs a matching cleanup.',
      check: ['An effect adds a `resize` listener but has no cleanup. What happens over time?', 'Each re-run adds another listener; they pile up and leak memory.'],
    },
    {
      level: 1, title: 'The exact order after a click',
      text: [
        'After a state change React does: **render** (calculate) → **commit** (change the DOM) → **layout effects** (`useLayoutEffect`) → the browser **paints** → **passive effects** (`useEffect`).',
        'So `useLayoutEffect` runs while the new DOM exists but the user has not seen it yet. `useEffect` usually runs just after the user sees the new screen.',
      ],
      words: [
        ['`useLayoutEffect`', 'An effect that runs after DOM changes but before the browser paints.'],
        ['Passive effect', 'Another name for a `useEffect` effect: it runs after paint and does not block it.'],
      ],
      example: 'A shop rearranges its window: staff move items (commit), check the arrangement with the curtain closed (layout effect), open the curtain (paint), then tidy the storeroom (passive effect).',
      remember: 'commit → layout effects → paint → effects.',
      check: ['Which runs first: `useEffect` or `useLayoutEffect`?', '`useLayoutEffect`, before the paint; `useEffect` usually after.'],
    },
    {
      level: 2, title: 'When to use `useLayoutEffect`',
      text: [
        'Use it when you must **measure** the DOM and **adjust** something before the user sees it — otherwise they would see one wrong frame (a flicker).',
        'Typical case: a tooltip measures its size and the space around it, then flips above its button if there is no room below. Because it runs before paint, the user only ever sees the final position.',
        'It blocks painting, so keep it short. Everything else belongs in `useEffect`.',
      ],
      words: [
        ['Measure', 'Read sizes or positions from the DOM, for example with `getBoundingClientRect()`.'],
        ['Flicker', 'A brief wrong frame that the user notices before it is corrected.'],
      ],
      example: 'Measuring a sofa and moving it before guests walk in, so nobody sees it blocking the door.',
      remember: 'Measure-then-fix before paint → `useLayoutEffect`. Everything else → `useEffect`.',
      check: ['Fetching data in `useLayoutEffect` — good idea?', 'No. It delays the paint for no reason; fetching does not need to happen before the screen updates.'],
    },
    {
      level: 2, title: 'Why `useEffect` sometimes runs before paint',
      text: [
        'Normally React lets the browser paint first and runs `useEffect` afterwards. But after a **discrete** user event — a click, a key press — React finishes the effects synchronously before handling the next event.',
        'This guarantees the next click sees fully updated state, so you cannot double-submit a form because an effect had not run yet.',
      ],
      words: [
        ['Discrete event', 'A single, intentional user action like a click or key press (as opposed to continuous ones like mouse moves).'],
        ['Flush', 'Run all the pending work right now.'],
      ],
      example: 'A cashier finishes recording your payment before serving the next customer, so the next customer never sees your half-processed receipt.',
      remember: 'After clicks and key presses, effects are flushed quickly and in order.',
      check: ['Should you rely on `useEffect` always running after paint?', 'No. Treat timing as “after commit”; if you need before-paint, use `useLayoutEffect`.'],
    },
    {
      level: 2, title: 'The chat scroll problem',
      text: [
        'A chat shows the newest messages at the bottom. When you scroll up, it loads **older** messages and adds them at the top.',
        'Adding content above you pushes everything down. Your scroll position (`scrollTop`) stays the same number, but now different messages are at that spot — the view jumps and you lose your place.',
      ],
      words: [
        ['`scrollTop`', 'How many pixels a scrollable box has been scrolled down from its top.'],
        ['`scrollHeight`', 'The total height of all the content inside a scrollable box, including the hidden parts.'],
        ['Prepend', 'Add to the beginning instead of the end.'],
      ],
      example: 'Adding pages to the front of a book while someone is reading: their finger is still the same distance from the front cover, but now points to a different line.',
      remember: 'Prepending content shifts what is under the reader’s eyes.',
      check: ['Old messages are added at the bottom instead. Is there a jump?', 'No — content added below the visible area does not move what the reader is looking at.'],
    },
    {
      level: 2, title: 'The fix: measure before, restore after',
      text: [
        'Before the update, save how far you are from the bottom: `distance = scrollHeight - scrollTop`. After the new messages are in the DOM but before paint, set `scrollTop = newScrollHeight - distance`. The same messages stay under your eyes.',
        'Class components had a dedicated method for the “before” moment: `getSnapshotBeforeUpdate`, whose return value is passed to `componentDidUpdate`.',
      ],
      words: [
        ['`getSnapshotBeforeUpdate`', 'A class component method that runs right before the DOM is updated, to capture things like scroll position.'],
        ['`componentDidUpdate`', 'A class method that runs right after the DOM is updated.'],
      ],
      example: 'Before rearranging a bookshelf, note “the blue book is 3 books from the right end”, then after rearranging, put your bookmark back by counting from the right.',
      remember: 'Save distance-from-bottom before; restore it before paint.',
      check: ['Why measure distance from the bottom, not from the top?', 'New content is added at the top, so the bottom part stays fixed relative to the end.'],
    },
    {
      level: 3, title: 'The same fix with Hooks',
      text: [
        'Hooks have no `getSnapshotBeforeUpdate`. When **your own code** triggers the change (the “load older” handler), save the snapshot right there, before calling `setMessages`, in a `useRef`.',
        'Then restore it in `useLayoutEffect`, which runs after the DOM update and before paint.',
        'If messages arrive from **outside** as props, a tiny class wrapper with `getSnapshotBeforeUpdate` is still a valid choice — or the CSS property `overflow-anchor`, which lets modern browsers keep your place automatically in many cases.',
      ],
      words: [
        ['`useRef`', 'A Hook that holds a value that survives renders without causing re-renders when changed.'],
        ['`overflow-anchor`', 'A CSS property controlling the browser’s built-in “scroll anchoring”, which keeps content steady when things above it change.'],
      ],
      example: 'Slack, WhatsApp Web and Discord all solve this problem when you load history.',
      remember: 'Hooks: snapshot in the handler (ref) → restore in `useLayoutEffect`.',
      check: ['Why `useLayoutEffect` rather than `useEffect` for restoring?', 'To fix the position before paint; with `useEffect` the user might see one jumped frame.'],
    },
    {
      level: 3, title: 'Choosing the right tool',
      text: [
        'A quick decision guide: need to inject CSS before any layout reads it? `useInsertionEffect` (for CSS-in-JS libraries). Need to measure and fix before paint? `useLayoutEffect`. Talking to the network, timers, subscriptions, analytics? `useEffect`. Reacting to a user action? Just put the code in the **event handler** — no effect needed.',
        'Many bugs come from effects that should have been handlers or plain calculations.',
      ],
      words: [
        ['`useInsertionEffect`', 'An effect that runs before layout effects, meant only for libraries that inject `<style>` tags.'],
        ['Event handler', 'A function that runs in response to a user action, like `onClick`.'],
      ],
      example: 'You do not hire a full-time assistant (an effect) to press one button when you could press it yourself in the moment (an event handler).',
      remember: 'Ask: “why does this code run?” Because of a user action → handler. Because the component is on screen → effect.',
      check: ['“Send analytics when the user clicks Buy” — handler or effect?', 'Handler. It is caused by a specific user action, not by the component being displayed.'],
    },
  ],
};
