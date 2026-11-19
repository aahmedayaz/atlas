export default {
  title: 'Binary search — halving your way to the answer',
  intro: 'Binary search is one of the most useful ideas in programming and one of the most common interview topics. This book starts with a children’s guessing game and ends with “binary search on the answer”, the pattern behind many hard interview questions.',
  chapters: [
    {
      level: 1, title: 'The guessing game',
      text: [
        'I think of a number from 1 to 100. You guess; I say “higher” or “lower”. The smart first guess is 50: whatever I answer, you have removed half the possibilities. Next guess the middle of what is left, and so on.',
        'You will always find it in at most 7 guesses, because 100 halves to 1 in about 7 steps. That is binary search.',
      ],
      words: [
        ['Binary search', 'Finding something in a sorted collection by repeatedly checking the middle and discarding half.'],
        ['Halving', 'Cutting the remaining options in half each step.'],
      ],
      example: 'Looking up a word in a paper dictionary: you open near the middle, see you are too far, and flip back — you never read page by page.',
      remember: 'Check the middle, throw away half, repeat.',
      check: ['How many guesses at most for a number from 1 to 1,000?', 'About 10, because 2¹⁰ = 1,024.'],
    },
    {
      level: 1, title: 'Why the data must be sorted',
      text: [
        'Throwing away half only works if you know which half the target **cannot** be in. That knowledge comes from order: in a **sorted** array, everything left of the middle is smaller and everything right is larger.',
        'In an unsorted array the middle value tells you nothing about the rest, so you must check every item one by one (**linear search**).',
      ],
      words: [
        ['Sorted', 'Arranged in order, e.g. smallest to largest.'],
        ['Array', 'A list of values stored in order, each with a position number (index).'],
        ['Linear search', 'Checking items one by one from the start.'],
      ],
      example: 'Finding a name in a phone book works because it is alphabetical. In a random pile of business cards you must look at each one.',
      remember: 'No order → no binary search.',
      check: ['Can you binary-search `[7, 2, 9, 4]` for 9?', 'No. It is not sorted, so the middle value does not tell you which side to drop.'],
    },
    {
      level: 1, title: 'How fast is it? O(log n)',
      text: [
        'Each step halves the search space. For `n` items, the number of steps is how many times you can halve `n` before reaching 1 — that is **log₂ n**.',
        'Computer scientists write this as **O(log n)**. A billion items need only about 30 checks. Linear search would need up to a billion.',
      ],
      words: [
        ['Big-O notation', 'A way to describe how the work grows as the input grows, ignoring small details.'],
        ['log₂ n', 'How many times you can divide n by 2 before reaching 1.'],
        ['O(n)', 'Work grows in step with the input size — linear.'],
      ],
      example: '1 → 2 → 4 → 8 … doubling 30 times passes one billion. Halving a billion 30 times gets to one.',
      remember: 'Binary search = O(log n). Linear search = O(n).',
      check: ['If an array doubles in size, how many extra steps does binary search need?', 'Just one more step.'],
    },
    {
      level: 2, title: 'Two pointers and the invariant',
      text: [
        'In code you keep two positions: `lo` (left edge) and `hi` (right edge) of the part still possible. The **invariant** — a promise you keep at every step — is: “if the target exists, it is between `lo` and `hi`.”',
        'Each loop: compute `mid`, compare `arr[mid]` with the target. Equal → found. Too small → `lo = mid + 1`. Too big → `hi = mid - 1`. Stop when `lo > hi` (nothing left).',
      ],
      words: [
        ['Pointer (here)', 'A variable holding a position in the array, not a memory address.'],
        ['Invariant', 'A statement that stays true before and after every loop step; it proves your code is correct.'],
        ['`mid`', 'The middle position between `lo` and `hi`.'],
      ],
      example: 'Two fingers on a bookshelf marking where the book could still be. Each check moves one finger inward.',
      remember: 'State your invariant before coding; it decides every `+1` and `-1`.',
      check: ['Why `lo = mid + 1` and not `lo = mid`?', '`arr[mid]` is already known to be too small, so `mid` itself can be excluded; keeping it risks an endless loop.'],
    },
    {
      level: 2, title: 'Walking through an example',
      text: [
        'Find 23 in `[2, 5, 8, 12, 16, 23, 38, 56, 72, 91]`. `lo = 0`, `hi = 9`, `mid = 4` → `arr[4] = 16` < 23 → `lo = 5`.',
        '`mid = 7` → `arr[7] = 56` > 23 → `hi = 6`. `mid = 5` → `arr[5] = 23` → found at index 5, in 3 checks instead of 6.',
        'If the target were 24: after index 5 (23 < 24) we set `lo = 6`; index 6 holds 38 > 24, so `hi = 5`. Now `lo > hi` — the fingers crossed, so 24 is not there.',
      ],
      words: [
        ['Trace', 'Following code by hand, step by step, writing down the variables.'],
      ],
      example: 'Interviewers love when you trace a small example out loud before running the code — it shows you understand, not just memorised.',
      remember: 'Fingers crossed (`lo > hi`) = not found.',
      check: ['In the example, how many checks to find 2?', 'Three: index 4 (16), then index 1 (5), then index 0 (2).'],
    },
    {
      level: 2, title: 'The classic bugs',
      text: [
        '**Off-by-one:** using `lo < hi` with `hi = mid - 1` (or similar mismatches) skips the last candidate or loops forever. Pick one convention and follow the invariant.',
        '**Overflow:** `mid = (lo + hi) / 2` can exceed the maximum integer in languages like Java or C++ for huge arrays. Use `lo + (hi - lo) / 2` (or `>>> 1` in Java/JS).',
        'This overflow bug sat in Java’s own `Arrays.binarySearch` for about nine years before it was fixed in 2006.',
      ],
      words: [
        ['Off-by-one error', 'Being wrong by exactly one — one step too many or too few.'],
        ['Integer overflow', 'A number becoming too large for its type and wrapping around to a wrong (often negative) value.'],
      ],
      example: 'Stopping one page too early when looking for a word in a dictionary — the word was on the page you skipped.',
      remember: '`mid = lo + (hi - lo) / 2`. Test arrays of size 0, 1 and 2.',
      check: ['Why test with an array of size 1?', 'It exercises the loop’s boundaries; many off-by-one bugs only appear when `lo == hi`.'],
    },
    {
      level: 3, title: 'Lower bound: the first position that fits',
      text: [
        'Often you do not want “is it there?” but “where is the **first** element ≥ target?” This is the **lower bound**. It answers “where should I insert this to keep order?” and “how many items are smaller than x?”',
        'Template: `lo = 0`, `hi = n`; while `lo < hi`: `mid`; if `arr[mid] < target` then `lo = mid + 1` else `hi = mid`. When the loop ends, `lo` is the answer.',
      ],
      words: [
        ['Lower bound', 'The first index whose value is ≥ the target.'],
        ['Upper bound', 'The first index whose value is > the target.'],
        ['Half-open range `[lo, hi)`', 'Includes `lo`, excludes `hi` — a convention that makes this template clean.'],
      ],
      example: 'Python’s `bisect_left`, C++’s `std::lower_bound` and database index lookups all do exactly this.',
      remember: 'Count of x = upper bound − lower bound.',
      check: ['Lower bound of 10 in `[2, 5, 8, 12, 16]`?', 'Index 3 (the value 12) — the first value ≥ 10.'],
    },
    {
      level: 3, title: 'Binary search on the answer',
      text: [
        'The biggest leap: you can binary-search things that are not arrays. If a yes/no question flips from **no** to **yes** at some point as a number grows (it is **monotonic**), you can binary-search for that point.',
        'Example: “What is the slowest eating speed that finishes all bananas in H hours?” Too slow → no; fast enough → yes, and every faster speed is also yes. Search speeds from 1 to max and test each `mid` with a quick check.',
      ],
      words: [
        ['Monotonic', 'Only ever moving in one direction: once true, it stays true.'],
        ['Predicate', 'A function that answers yes/no for a given value.'],
        ['Search space', 'The range of possible answers you are searching.'],
      ],
      example: '`git bisect` finds the commit that broke a test: older commits pass, newer ones fail, so it halves the commit history until it finds the first failing one.',
      remember: 'Monotonic yes/no question → binary-search the boundary.',
      check: ['What property must the check have for “search on the answer” to work?', 'Monotonicity: if a value works, every larger (or smaller) value must also work.'],
    },
  ],
};
