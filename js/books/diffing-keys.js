export default {
  title: 'How React finds what changed — and why keys matter',
  intro: 'After every render React has two descriptions of the screen: the old and the new. This book explains, step by step, how React compares them quickly, what “keys” are, and the classic bugs that come from getting them wrong.',
  chapters: [
    {
      level: 1, title: 'Two pictures, find the differences',
      text: [
        'After a render React holds the previous tree and the new tree. Its job is to find the differences and make the fewest DOM changes to turn the old screen into the new one. This is called **diffing**.',
        'A perfect comparison of two trees is extremely slow: for 1,000 elements it takes around a billion steps. React instead follows two simple rules that make it about 1,000 steps.',
      ],
      words: [
        ['Diffing', 'Comparing two versions to find what is different.'],
        ['Algorithm', 'A step-by-step recipe a computer follows to solve a problem.'],
        ['Heuristic', 'A smart shortcut that is right almost always, used because the perfect method is too slow.'],
      ],
      example: 'A “spot the difference” puzzle. You do not compare every possible arrangement — you scan matching spots side by side.',
      remember: 'React trades a perfect comparison for a fast, nearly-always-right one.',
      check: ['Why does React not compute the perfect minimum set of changes?', 'It would take far too long (about n³ steps); its rules give a near-optimal answer in about n steps.'],
    },
    {
      level: 1, title: 'Rule 1: a different type means start over',
      text: [
        'React compares the two trees level by level. If an element’s **type** changed — a `<div>` became a `<section>`, or `<LoginForm>` became `<SignupForm>` — React does not try to reuse anything. It throws the old part away (with all its children and their state) and builds the new part from scratch.',
      ],
      words: [
        ['Type', 'What kind of element it is: a tag name like `div`, or a component like `ProfileCard`.'],
        ['Unmount', 'Removing a component and its DOM from the page, and forgetting its state.'],
      ],
      example: 'If a room changes from a kitchen to a bedroom, the builders do not move the oven into the bedroom — they empty the room and furnish it again.',
      remember: 'Type changed → old subtree destroyed, new one created, state lost.',
      check: ['You switch a wrapper from `<div>` to `<form>` around an input. What happens to text typed in the input?', 'It is lost: the whole subtree was recreated because the parent’s type changed.'],
    },
    {
      level: 1, title: 'Same type means update in place',
      text: [
        'If the type is the same, React keeps the existing DOM node and only updates what changed: a `className`, a `style` value, some text.',
        'For components of the same type, React keeps the component’s state and calls it again with the new props.',
      ],
      words: [
        ['Attribute', 'A setting on an HTML element, like `class`, `href` or `disabled`.'],
        ['Patch', 'A small targeted change applied to something that already exists.'],
      ],
      example: 'Same room, same furniture — you just repaint one wall.',
      remember: 'Same type → keep the node, patch its attributes, keep its state.',
      check: ['A button’s `className` changes from `primary` to `danger`. Is the button recreated?', 'No. Same type, so React only updates the `class` attribute; focus and state stay.'],
    },
    {
      level: 2, title: 'State belongs to a position',
      text: [
        'React remembers each component’s state by **where it sits in the tree** — “the first child of the second child of App” — not by its name or the variable that created it.',
        'So if two different JSX branches render the same component type in the same spot, React treats them as the same component, and the state carries over.',
      ],
      words: [
        ['Position in the tree', 'The path from the root to an element, like an address.'],
        ['Preserve state', 'Keep the remembered values instead of starting fresh.'],
      ],
      example: 'Seats in a classroom. Whoever sits in seat 2 inherits the books on seat 2’s desk, whatever their name.',
      remember: 'Same type in the same spot = same state.',
      check: ['`isAdmin ? <Counter /> : <Counter />` — does the counter reset when `isAdmin` flips?', 'No. Same type, same position, so React keeps the same state.'],
    },
    {
      level: 2, title: 'Lists without keys line up by position',
      text: [
        'For lists, React compares children by their **index**: the first old item with the first new item, the second with the second, and so on.',
        'If you add an item at the end, that is fine. But add one at the **start**, and every item shifts down by one: React thinks item 0 changed into the new item, item 1 changed into the old item 0, and so on. It rewrites every row and keeps the wrong state in the wrong row.',
      ],
      words: [
        ['Index', 'An item’s position number in a list, starting from 0.'],
        ['Array', 'An ordered list of values in JavaScript, like `["a", "b", "c"]`.'],
      ],
      example: 'Matching students to desks by desk number. A new student takes desk 1 and everyone shifts — now every desk has the wrong person’s bag on it.',
      remember: 'No keys = compared by position. Inserting at the top shifts everything.',
      check: ['Why is adding to the end of an unkeyed list cheap?', 'Existing positions do not change, so React only creates the new last item.'],
    },
    {
      level: 2, title: 'Keys are name tags',
      text: [
        'A **key** is a stable, unique label you give each list item: `key={message.id}`. React then matches old and new items by key instead of position.',
        'Inserted item? React creates one node. Removed? It deletes one. Re-ordered? It moves nodes. State stays attached to the right item.',
        'Keys must be **stable** (the same item keeps the same key across renders) and **unique** among siblings.',
      ],
      words: [
        ['Key', 'A special prop that tells React which list item is which across renders.'],
        ['Stable', 'Does not change over time for the same thing.'],
        ['Siblings', 'Elements that share the same parent.'],
      ],
      example: 'Conference name badges. People can swap seats freely; you still know who is who by the badge.',
      remember: 'Use an ID from your data as the key: `key={item.id}`.',
      check: ['Is `key={Math.random()}` a good key?', 'No. It changes every render, so React thinks every item is new and recreates all of them, losing state.'],
    },
    {
      level: 2, title: 'Why `key={index}` causes strange bugs',
      text: [
        'Using the array index as the key is the same as having no key: “third in line” is not a stable name.',
        'With inputs or local state inside rows, adding, removing or sorting items makes the state jump to a different item. The text you typed next to “Buy milk” suddenly sits next to “Pay rent”.',
        'Index keys are only safe if the list never re-orders, never inserts or deletes in the middle, and rows have no state.',
      ],
      words: [
        ['Uncontrolled input', 'An input that keeps its own value in the DOM rather than in React state — it moves with the DOM node.'],
      ],
      example: 'Naming people “first in queue”, “second in queue”. The moment someone leaves, everyone’s name changes.',
      remember: '`key={index}` + reordering + state = bugs.',
      check: ['A sortable table uses `key={index}` and each row has a checkbox. What goes wrong when sorting?', 'The checked state stays at the same position, so it ends up on a different row.'],
    },
    {
      level: 3, title: 'Using keys on purpose to reset state',
      text: [
        'Since a new key means “a different item”, you can change a component’s key to force React to throw away its state and start fresh.',
        '`<ProfileForm key={userId} />` resets every field when you switch users — no effect needed to clear them.',
      ],
      words: [
        ['Reset', 'Return to the starting values.'],
        ['Remount', 'Unmount and mount again: a fresh component with fresh state.'],
      ],
      example: 'Issuing a new ID card: as far as the building is concerned, it is a new person with no history.',
      remember: 'Change the key to reset a component on purpose.',
      check: ['An edit form keeps showing the previous user’s draft. What is the one-line fix?', 'Give the form `key={userId}` so it remounts when the user changes.'],
    },
    {
      level: 3, title: 'Never define components inside components',
      text: [
        'A component defined inside another component’s body is a brand-new function every render. To React, a new function is a new **type** — so Rule 1 applies: destroy and recreate, every render.',
        'Symptoms: inputs lose focus after each keystroke, animations restart, state resets. The fix is to define components at the top level of the file and pass data in as props.',
      ],
      words: [
        ['Function identity', 'Whether two functions are the very same object. Two functions with the same code created at different times are different.'],
      ],
      example: 'Printing a fresh rule book every day and calling it a new game — nobody keeps their score.',
      remember: 'Declare components at the top level, never inside another component.',
      check: ['An input inside an inner `Field` component loses focus on every key press. Likely cause?', '`Field` is defined inside the parent, so it is a new type every render and gets remounted.'],
    },
  ],
};
