import { n, e, merge, arr } from '../../engine/build.js';

const A = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
const CODE = `
function binarySearch(nums, target) {
  let lo = 0, hi = nums.length - 1;          // search space: [lo, hi]
  while (lo <= hi) {                           // not empty yet
    const mid = lo + ((hi - lo) >> 1);         // middle, overflow-safe
    if (nums[mid] === target) return mid;      // found
    if (nums[mid] < target) lo = mid + 1;      // answer is to the right
    else hi = mid - 1;                         // answer is to the left
  }
  return -1;                                   // space empty → not found
}`;

// draw the array with discarded cells faded
const view = ({ lo, hi, mid, found, target = 23, note, extra = [] }) => {
  const states = {};
  A.forEach((_, i) => { if (lo != null && (i < lo || i > hi)) states[i] = 'dim'; });
  if (mid != null) states[mid] = found ? 'ok' : 'active';
  const ptrs = {};
  if (lo != null && lo < A.length) ptrs.lo = lo;
  if (hi != null && hi >= 0) ptrs.hi = hi;
  if (mid != null) ptrs.mid = mid;
  return merge(arr(A, { id: 'a', x: 113, y: 200, gap: 86, states, ptrs, ptrKind: { lo: 'cdn', hi: 'cache', mid: 'react' } }), {
    h: 420,
    nodes: [n('tgt', 500, 70, `target = ${target}`, { kind: 'search', mono: true }), ...(note ? [n('note', 500, 380, note, { kind: 'note', icon: false })] : []), ...extra],
  });
};

export default {
  id: 'binary-search',
  title: 'Binary search: halve the problem every step',
  level: 'Beginner',
  minutes: 18,
  tags: ['Arrays', 'Search', 'O(log n)'],
  summary: 'Trace binary search line by line on a sorted array, learn the invariant that makes it correct, the off-by-one and overflow traps, and the “binary search on the answer” pattern interviewers love.',
  learn: ['Why sorted data lets you discard half', 'The loop invariant `target ∈ [lo, hi]`', 'Exact trace with lo / mid / hi', 'Overflow-safe mid and off-by-one rules', 'Lower bound and search-on-answer templates'],
  steps: [
    {
      short: 'The problem', title: 'Find 23 in a sorted array — without checking everything', tag: 'concept',
      scene: view({ note: 'linear scan: up to n = 10 checks · binary search: at most 4' }),
      body: [
        'Given a <b>sorted</b> array and a target, return its index or −1. A linear scan checks every element — O(n). For a billion items that is a billion comparisons.',
        'Sorting gives us a superpower: one comparison with the middle element tells us which <i>half</i> cannot contain the target. Throw that half away and repeat. That is O(log n): about 30 steps for a billion items.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE },
      facts: [['n', '10'], ['worst-case steps', '⌈log₂(11)⌉ = 4'], ['time', 'O(log n)'], ['space', 'O(1)']],
    },
    {
      short: 'Invariant', title: 'The invariant: if the target exists, it is inside [lo, hi]', tag: 'concept',
      scene: view({ lo: 0, hi: 9, note: 'invariant: target ∈ nums[lo..hi]   (if it exists at all)' }),
      body: [
        'Every correct binary search keeps one [[invariant]] true on every iteration: <b>if the target is in the array, its index is between `lo` and `hi`, inclusive.</b>',
        'We start with the whole array, so it is trivially true. Each step shrinks the range while keeping it true. When the range becomes empty (`lo > hi`), the target cannot be anywhere — return −1. Writing the invariant down is how you avoid off-by-one bugs in interviews.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE, hl: [2, 3] },
      vars: { lo: '0', hi: '9', 'space size': '10' },
    },
    {
      short: 'Step 1', title: 'Iteration 1: mid = 4 → 16 < 23, go right', tag: 'code',
      scene: view({ lo: 0, hi: 9, mid: 4, note: '16 < 23 → everything at index ≤ 4 is too small' }),
      body: [
        '`mid = 0 + ((9 − 0) >> 1) = 4`. `nums[4] = 16`, which is less than 23. Because the array is sorted, every element left of and including index 4 is ≤ 16, so none can be 23.',
        'Keep the invariant: the target, if present, is in `[5, 9]`. Set `lo = mid + 1 = 5`.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE, hl: [4, 6], focus: true },
      vars: { lo: '0 → 5', hi: '9', mid: '4', 'nums[mid]': '16 < 23' },
      facts: [['comparisons', '1'], ['space left', '5']],
    },
    {
      short: 'Step 2', title: 'Iteration 2: mid = 7 → 56 > 23, go left', tag: 'code',
      scene: view({ lo: 5, hi: 9, mid: 7, note: '56 > 23 → everything at index ≥ 7 is too big' }),
      body: [
        '`mid = 5 + ((9 − 5) >> 1) = 7`. `nums[7] = 56` is greater than 23, so indexes 7…9 are all too big.',
        'The target must be in `[5, 6]`. Set `hi = mid − 1 = 6`.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE, hl: [4, 7], focus: true },
      vars: { lo: '5', hi: '9 → 6', mid: '7', 'nums[mid]': '56 > 23' },
      facts: [['comparisons', '2'], ['space left', '2']],
    },
    {
      short: 'Step 3', title: 'Iteration 3: mid = 5 → found 23', tag: 'code',
      scene: view({ lo: 5, hi: 6, mid: 5, found: true, note: 'found at index 5 after 3 comparisons' }),
      body: [
        '`mid = 5 + ((6 − 5) >> 1) = 5`. `nums[5] = 23` — return 5.',
        'Three comparisons instead of six for a linear scan. The gap grows fast: doubling the array adds just <b>one</b> more step.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE, hl: [4, 5], focus: true },
      vars: { lo: '5', hi: '6', mid: '5', result: '5' },
      facts: [['comparisons', '3'], ['space left', 'found']],
    },
    {
      short: 'Not found', title: 'Searching for 20: the range empties and we return −1', tag: 'code',
      scene: view({ lo: 5, hi: 4, target: 20, note: 'lo = 5 > hi = 4 → empty range → return -1' }),
      body: [
        'For target 20: mid 4 (16 < 20) → lo = 5; mid 7 (56 > 20) → hi = 6; mid 5 (23 > 20) → hi = 4. Now `lo = 5 > hi = 4`: the range is empty, the loop condition `lo <= hi` fails, return −1.',
        'Notice where `lo` ends: index 5, exactly where 20 <i>would</i> be inserted to keep the array sorted. That observation is the basis of the lower-bound variant.',
      ],
      code: { file: 'binarySearch.js', lang: 'js', src: CODE, hl: [3, 10], focus: true },
      vars: { lo: '5', hi: '4', result: '-1', 'insert position': '5 (= lo)' },
    },
    {
      short: 'Traps', title: 'The two classic bugs: overflow and off-by-one', tag: 'scenario',
      scene: view({ lo: 0, hi: 9, mid: 4, note: '(lo + hi) / 2 can overflow 32-bit ints · lo + (hi - lo) / 2 cannot' }),
      body: [
        '<b>Overflow.</b> `mid = (lo + hi) / 2` overflows in languages with fixed-size integers (Java, C++, Go) once `lo + hi` exceeds 2³¹ − 1. Use `lo + (hi − lo) / 2`. This exact bug sat in the JDK’s `Arrays.binarySearch` for about nine years.',
        '<b>Off-by-one.</b> Pick one convention and keep every line consistent with it. Closed interval `[lo, hi]` → `while (lo <= hi)`, `hi = mid − 1`. Half-open `[lo, hi)` → `hi = n`, `while (lo < hi)`, `hi = mid`. Mixing them gives infinite loops or skipped elements.',
      ],
      code: { file: 'traps.java', lang: 'js', src: `
int mid = (lo + hi) / 2;          // ❌ overflows when lo + hi > 2^31 - 1
int mid = lo + (hi - lo) / 2;     // ✅
int mid = (lo + hi) >>> 1;        // ✅ Java: unsigned shift

// closed [lo, hi]            half-open [lo, hi)
// hi = n - 1                 hi = n
// while (lo <= hi)           while (lo < hi)
// hi = mid - 1               hi = mid`, hl: [1, 2] },
      interview: 'Saying “my invariant is target ∈ [lo, hi], so the loop runs while lo ≤ hi and I move hi to mid − 1” before coding is the strongest signal you can give.',
    },
    {
      short: 'Lower bound', title: 'Lower bound: first index with nums[i] ≥ target', tag: 'code',
      scene: merge(view({ lo: 3, hi: 3, target: 12, note: 'first index where nums[i] >= 12 → 3' }), { nodes: [] }),
      body: [
        'Many problems need the <i>boundary</i>, not an exact match: first element ≥ x, last element ≤ x, first bad version, where to insert. The half-open template returns the first index where a condition becomes true, and handles duplicates correctly.',
        'Invariant: everything left of `lo` is < target; everything from `hi` on is ≥ target. When `lo === hi`, that is the answer (`n` if no such element). Python’s `bisect_left` and C++’s `std::lower_bound` are exactly this.',
      ],
      code: { file: 'lowerBound.js', lang: 'js', src: `
// first index i with nums[i] >= target (nums.length if none)
function lowerBound(nums, target) {
  let lo = 0, hi = nums.length;            // half-open [lo, hi)
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] < target) lo = mid + 1;  // mid is too small → answer is right of it
    else hi = mid;                         // mid might be the answer → keep it
  }
  return lo;                               // lo === hi
}

lowerBound([2, 5, 8, 12, 12, 16], 12);    // 3 (first of the duplicates)
lowerBound([2, 5, 8], 9);                 // 3 = insert at the end`, hl: [3, 4, 6, 7, 9] },
    },
    {
      short: 'Search the answer', title: 'Binary search on the answer, not on an array', tag: 'concept',
      scene: { h: 420, nodes: [
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k, i) => n('s' + k, 85 + i * 83, 180, String(k), { kind: 'cell', sub: k < 4 ? 'too slow' : 'ok', state: k < 4 ? 'bad' : k === 4 ? 'active' : 'ok' })),
        n('q', 500, 70, 'Koko: smallest speed k that eats all piles in h hours', { kind: 'search' }),
        n('m', 500, 340, 'feasible(k) is monotonic: false … false, true … true → find the first true', { kind: 'note', icon: false }),
      ] },
      body: [
        'If you can write a yes/no check `feasible(x)` that is <b>monotonic</b> — once true, true for every larger x — you can binary-search the smallest x that works, even though there is no array. Each check might cost O(n), giving O(n log range).',
        'Classic examples: minimum eating speed (Koko), ship packages within D days, split array largest sum, minimum time to finish jobs. Recognizing “minimize the maximum” or “smallest x such that…” is the interview skill.',
      ],
      code: { file: 'minEatingSpeed.js', lang: 'js', src: `
function minEatingSpeed(piles, h) {
  const hours = k => piles.reduce((t, p) => t + Math.ceil(p / k), 0);
  let lo = 1, hi = Math.max(...piles);       // answer is in [1, max pile]
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (hours(mid) <= h) hi = mid;           // feasible → try slower
    else lo = mid + 1;                       // too slow → must be faster
  }
  return lo;
}
// time: O(n · log(max pile))   space: O(1)`, hl: [3, 4, 6, 7] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What are the preconditions and complexity of binary search?', a: ['The data must be sorted (or the predicate monotonic) and support O(1) random access. Time O(log n), space O(1) iterative (O(log n) recursive).'], follow: ['Why doesn’t binary search help on a linked list?'] },
    { lvl: 'J', q: 'Why `lo + (hi - lo) / 2` instead of `(lo + hi) / 2`?', a: ['With fixed-width integers `lo + hi` can overflow for large arrays, producing a negative index. `lo + (hi - lo) / 2` never exceeds `hi`. JavaScript numbers do not overflow at 2³¹, but interviewers expect the safe form.'] },
    { lvl: 'M', q: 'How do you find the first and last position of a target with duplicates?', a: ['Two boundary searches: `lowerBound(target)` gives the first index ≥ target; `lowerBound(target + 1) − 1` (or an upper-bound search) gives the last index ≤ target. If the first index is out of range or holds a different value, return [−1, −1]. Both are O(log n).'] },
    { lvl: 'M', q: 'Search in a rotated sorted array.', a: ['At each mid, one half is still sorted. Check which (`nums[lo] <= nums[mid]` means the left half is sorted), test whether the target lies inside that sorted half’s range, and discard the other half accordingly. O(log n) when values are distinct.'] },
    { lvl: 'S', q: 'How do you recognise a “binary search on the answer” problem?', a: ['The question asks for the minimum or maximum value satisfying a condition (“smallest capacity”, “minimize the largest sum”), the answer lies in a known numeric range, and a feasibility check for a candidate is easy and monotonic. Then binary-search the range with the check: O(cost(check) · log(range)).'] },
  ],
  scenarios: [
    { title: 'Infinite loop on a two-element range', sit: 'Code uses `while (lo < hi)` with `lo = mid` when moving right.', steps: [['', 'lo = 4, hi = 5 → mid = 4.'], ['x', '`lo = mid` keeps lo at 4 forever.']], fix: 'Use `lo = mid + 1` (or round mid up with `lo + ((hi - lo + 1) >> 1)` when the template moves `lo = mid`).' },
    { title: 'git bisect', sit: 'A bug appeared somewhere in the last 1,000 commits.', steps: [['g', '`git bisect` is binary search over history: about 10 test runs instead of up to 1,000.']], fix: 'Use `git bisect start/bad/good`, or `git bisect run ./test.sh` to automate it.' },
  ],
  history: {
    timeline: [
      { yr: '1946', title: 'First described', text: 'John Mauchly described binary search in the Moore School Lectures, one of the first courses on computing.' },
      { yr: '1962', title: 'A correct version for any length', text: 'Early published versions only handled arrays of length 2ⁿ − 1; a general correct version came years later.' },
      { yr: '1986', title: 'Programming Pearls', text: 'Jon Bentley reported that most professional programmers he tested could not write a bug-free binary search.' },
      { yr: '2006', title: 'The JDK overflow bug', text: 'Joshua Bloch revealed that `(low + high) / 2` in Java’s `Arrays.binarySearch` overflowed on huge arrays — a bug present for about nine years.', c: 'x' },
    ],
    alts: { cols: ['Structure / API', 'Lookup', 'Use when'], rows: [['Sorted array + binary search', 'O(log n)', 'Static or rarely changing data, range queries'], ['Hash map', 'O(1) average', 'Exact-match lookups, no ordering needed'], ['Balanced BST / TreeMap', 'O(log n)', 'Frequent inserts plus ordered queries'], ['B-tree index (databases)', 'O(log n) disk pages', 'Data on disk; what SQL indexes use'], ['`bisect` (Python), `lower_bound` (C++), `Arrays.binarySearch` (Java)', 'O(log n)', 'Use the library in real code']] },
  },
  quiz: [
    { q: 'With `while (lo <= hi)` and closed [lo, hi], after `nums[mid] > target` you set…', o: ['hi = mid', 'hi = mid - 1', 'lo = mid', 'lo = mid + 1'], a: 1, why: 'mid is excluded, and the range is inclusive.' },
    { q: 'About how many steps for 1,000,000 sorted items?', o: ['1,000', '100', '20', '6'], a: 2, why: 'log₂(10⁶) ≈ 20.' },
    { q: 'After an unsuccessful search, `lo` equals…', o: ['−1', 'the insertion position', 'n − 1', 'mid'], a: 1, why: 'It is where the target would be inserted.' },
    { q: 'Binary search on the answer needs the check to be…', o: ['O(1)', 'monotonic', 'recursive', 'sorted'], a: 1, why: 'false…false, true…true lets you find the boundary.' },
  ],
  cheat: `<h3>Template A — exact match, closed [lo, hi]</h3><p><code>lo=0, hi=n-1; while (lo<=hi) { mid=lo+((hi-lo)>>1); == → return; &lt; → lo=mid+1; else hi=mid-1 } return -1</code></p>
  <h3>Template B — first true / lower bound, half-open [lo, hi)</h3><p><code>lo=0, hi=n; while (lo&lt;hi) { mid=lo+((hi-lo)>>1); if (ok(mid)) hi=mid; else lo=mid+1 } return lo</code></p>
  <h3>Recognize it</h3><ul><li>sorted input or rotated sorted input</li><li>“first / last position”, “insert position”, “first bad version”</li><li>“minimize the maximum”, “smallest x such that…” → search the answer</li></ul>
  <p><b>Complexity:</b> O(log n) time, O(1) space. Say the invariant out loud before coding.</p>`,
};
