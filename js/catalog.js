// The curriculum: tabs → chapters → lessons.
// A lesson module with `steps` is built; a soon(...) entry shows on the roadmap as "coming soon".
// To add a lesson: write js/lessons/<tab>/<id>.js, import it here, and put it in a chapter.
import browserPipeline from './lessons/eng/browser-pipeline.js';
import domVsVdom from './lessons/eng/dom-vs-vdom.js';
import renderCommit from './lessons/eng/render-commit.js';
import diffingKeys from './lessons/eng/diffing-keys.js';
import fiberLanes from './lessons/eng/fiber-lanes.js';
import effectTiming from './lessons/eng/effect-timing.js';
import rerenders from './lessons/eng/rerenders.js';
import buildDeploy from './lessons/eng/build-deploy.js';
import csrSsr from './lessons/eng/csr-ssr.js';
import renderingStrategies from './lessons/eng/rendering-strategies.js';
import binarySearch from './lessons/dsa/binary-search.js';
import loadBalancing from './lessons/sd/load-balancing.js';

const soon = (id, title, summary) => ({ id, title, summary });

export const TABS = [
  {
    id: 'eng', title: 'Engineering', short: 'Eng',
    headline: 'How the web actually works — from the browser’s pixels to React’s internals to how Vercel serves your app.',
    blurb: 'Start with the browser, then React’s rendering engine, then how apps are built, deployed and rendered on servers. Every step shows <b>what</b> happens, <b>where</b> it happens and <b>why</b> — with code, interview reasoning, history and today’s alternatives.',
    chapters: [
      { id: 'browser', title: 'Browser & Web Platform', blurb: 'What the browser does on its own, before any framework is involved.', lessons: [
        browserPipeline, domVsVdom,
        soon('http-tls', 'HTTP, DNS & TLS: the network trip', 'From typing a URL to the first byte: DNS, TCP, TLS 1.3, HTTP/2 vs HTTP/3, caching headers.'),
        soon('event-loop', 'The JavaScript event loop', 'Call stack, tasks, microtasks, rendering opportunities, and why `await` doesn’t block.'),
        soon('web-vitals', 'Core Web Vitals in practice', 'Measuring and fixing LCP, INP and CLS with field data.'),
      ] },
      { id: 'react', title: 'React Rendering Internals', blurb: 'What React does inside your browser’s memory, from a click to a committed DOM change.', lessons: [
        renderCommit, diffingKeys, fiberLanes, effectTiming, rerenders,
        soon('react-state-data', 'State, data fetching & caching', 'useReducer, external stores, TanStack Query, Suspense for data, Actions.'),
      ] },
      { id: 'ship', title: 'Shipping React: Build, Deploy & Render', blurb: 'From `npm run build` to bytes on a CDN and HTML from a Function.', lessons: [
        buildDeploy, csrSsr, renderingStrategies,
      ] },
      { id: 'backend', title: 'Backend & APIs', blurb: 'Planned next.', lessons: [
        soon('node-runtime', 'Node.js: event loop, streams & workers', 'How one thread serves thousands of connections.'),
        soon('api-styles', 'REST vs GraphQL vs gRPC', 'Shapes of APIs, versioning, pagination, idempotency.'),
        soon('auth', 'Authentication: sessions, JWT, OAuth & passkeys', 'Who you are, how it is proven, and where it is stored.'),
        soon('databases', 'Databases, indexes & ORMs', 'What a query really does, and why indexes matter.'),
      ] },
      { id: 'devops', title: 'DevOps & AWS', blurb: 'Planned.', lessons: [
        soon('docker', 'Containers & Docker', 'Images, layers, and why “works on my machine” went away.'),
        soon('cicd', 'CI/CD pipelines', 'From pull request to production safely.'),
        soon('aws-core', 'AWS core services', 'EC2, S3, Lambda, CloudFront, RDS, DynamoDB, SQS — when to use which.'),
        soon('iac', 'Infrastructure as code', 'Terraform, CDK and reproducible environments.'),
      ] },
      { id: 'seo', title: 'SEO for Engineers', blurb: 'Planned.', lessons: [
        soon('crawl-index', 'Crawling, rendering & indexing', 'How Googlebot sees CSR vs SSR pages.'),
        soon('structured-data', 'Metadata & structured data', 'Titles, canonical URLs, Open Graph, JSON-LD.'),
      ] },
      { id: 'ai', title: 'AI, ML & Agentic AI', blurb: 'Planned.', lessons: [
        soon('ml-basics', 'Machine learning fundamentals', 'Training, inference, loss, overfitting — visually.'),
        soon('llm-inference', 'How an LLM generates text', 'Tokens, attention, sampling, context windows.'),
        soon('rag', 'Embeddings & RAG', 'Vector search and grounding answers in your data.'),
        soon('agents', 'Agents & tool use', 'Loops, tools, memory, evaluation and guardrails.'),
      ] },
      { id: 'automation', title: 'Automation', blurb: 'Planned.', lessons: [
        soon('jobs-queues', 'Cron jobs, queues & workflows', 'Background work that survives failures.'),
      ] },
    ],
  },
  {
    id: 'dsa', title: 'DSA',
    headline: 'Data structures and algorithms, traced line by line.',
    blurb: 'Watch the pointers move while the code runs. Every pattern comes with the <b>invariant</b> that proves it correct, its complexity, and the interview variations.',
    chapters: [
      { id: 'foundations', title: 'Foundations & Searching', blurb: 'The building blocks every pattern relies on.', lessons: [
        soon('big-o', 'Big-O without the hand-waving', 'Counting work, amortized cost, and space.'),
        binarySearch,
        soon('two-pointers', 'Two pointers', 'Pair sums, partitioning, removing duplicates in place.'),
        soon('sliding-window', 'Sliding window', 'Longest substring, fixed and variable windows.'),
        soon('hashing', 'Hash maps & sets', 'Two-sum, frequency counts, and how hashing works inside.'),
      ] },
      { id: 'structures', title: 'Core Data Structures', blurb: 'Planned.', lessons: [
        soon('stack-queue', 'Stacks, queues & monotonic stacks', ''), soon('linked-list', 'Linked lists', ''), soon('trees', 'Trees & BST', ''), soon('heaps', 'Heaps & priority queues', ''), soon('graphs', 'Graphs: BFS & DFS', ''),
      ] },
      { id: 'patterns', title: 'Advanced Patterns', blurb: 'Planned.', lessons: [
        soon('backtracking', 'Backtracking', ''), soon('dp', 'Dynamic programming', ''), soon('greedy', 'Greedy algorithms', ''), soon('union-find', 'Union-find', ''),
      ] },
    ],
  },
  {
    id: 'sd', title: 'System Design', short: 'Design',
    headline: 'Design systems that scale — one building block at a time.',
    blurb: 'Each building block is animated with live traffic, then stress-tested with failure scenarios and the trade-offs interviewers probe.',
    chapters: [
      { id: 'scaling', title: 'Scaling Basics', blurb: 'From one server to many.', lessons: [
        loadBalancing,
        soon('caching', 'Caching layers', 'Browser, CDN, application and database caches; invalidation.'),
        soon('cdn', 'CDNs & edge', 'Serving the world from nearby.'),
        soon('estimation', 'Back-of-the-envelope estimation', 'QPS, storage and bandwidth in an interview.'),
      ] },
      { id: 'data', title: 'Data at Scale', blurb: 'Planned.', lessons: [
        soon('replication', 'Replication', ''), soon('sharding', 'Sharding & consistent hashing', ''), soon('cap', 'CAP & consistency models', ''), soon('queues', 'Message queues & pub/sub', ''),
      ] },
      { id: 'cases', title: 'Whole-System Designs', blurb: 'Planned.', lessons: [
        soon('url-shortener', 'Design a URL shortener', ''), soon('news-feed', 'Design a news feed', ''), soon('chat', 'Design a chat system', ''),
      ] },
    ],
  },
];

export const LESSONS = {};
for (const t of TABS) for (const c of t.chapters) for (const l of c.lessons) LESSONS[l.id] = l;
