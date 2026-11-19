import { n, e, f, z, merge } from '../../engine/build.js';

const users = (o = {}) => n('users', 110, 260, 'Users', { kind: 'user', sub: o.sub || '50,000 online', ...o });
const lb = (o = {}) => n('lb', 400, 260, 'Load balancer', { kind: 'lb', sub: o.sub || 'round robin', ...o });
const srv = (k, y, o = {}) => n('s' + k, 760, y, 'Server ' + 'ABC'[k - 1], { kind: 'server', sub: o.sub || 'CPU 33%', ...o });
const three = (subs = [], st = []) => [srv(1, 120, { sub: subs[0], state: st[0] }), srv(2, 260, { sub: subs[1], state: st[1] }), srv(3, 400, { sub: subs[2], state: st[2] })];
const lbEdges = (dead) => [e('users', 'lb'), ...[1, 2, 3].map((k) => e('lb', 's' + k, '', { state: dead === k ? 'dim' : '', style: dead === k ? 'dashed' : '' }))];

export default {
  id: 'load-balancing',
  title: 'Load balancing: one front door, many servers',
  level: 'Beginner',
  minutes: 20,
  tags: ['Scaling', 'Reliability', 'AWS'],
  summary: 'Why one server stops being enough, how a load balancer spreads traffic, which algorithm to pick, how health checks route around failure, why servers must be stateless, and how to keep the balancer itself from being a single point of failure.',
  learn: ['Vertical vs horizontal scaling', 'Round robin vs least connections vs hashing', 'Health checks and automatic failover', 'Stateless servers vs sticky sessions', 'L4 vs L7, and avoiding a single point of failure'],
  steps: [
    {
      short: 'One server', title: 'One server hits its limit', tag: 'concept',
      scene: { nodes: [users({ sub: '50,000 online' }), n('s1', 600, 260, 'Server', { kind: 'server', sub: 'CPU 100% · queue growing', state: 'bad' })], edges: [e('users', 's1', '6,000 req/s')],
        flows: [f('users>s1', 'GET', { kind: 'user', every: 0.35, speed: 320 }), f('users>s1', '', { kind: 'cache', every: 0.9, fail: true, speed: 320 })] },
      facts: [['requests / s', '6,000'], ['p99 latency', '2.4 s'], ['errors', '7%'], ['healthy servers', '1 / 1']],
      body: [
        'A single server can handle only so many requests per second before its CPU, memory or connection limits are reached. Past that point requests queue, latency explodes, and some time out (the red bursts).',
        'You can buy a bigger machine (<b>vertical scaling</b>) — simple, but there is always a ceiling, it gets expensive fast, and that one machine is still a single point of failure. Or you can add more machines ([[horizontal-scaling]]) — which needs something in front of them to share out the work.',
      ],
    },
    {
      short: 'Add an LB', title: 'Add servers behind one front door', tag: 'concept',
      scene: { nodes: [users(), lb({ state: 'active' }), ...three(['CPU 34%', 'CPU 33%', 'CPU 33%'], ['ok', 'ok', 'ok'])], edges: lbEdges(),
        flows: [f('users>lb', 'req', { kind: 'user', every: 0.35, speed: 320 }), f('lb>s1', '', { kind: 'lb', every: 1.05, speed: 320 }), f('lb>s2', '', { kind: 'lb', every: 1.05, delay: 0.35, speed: 320 }), f('lb>s3', '', { kind: 'lb', every: 1.05, delay: 0.7, speed: 320 })] },
      facts: [['requests / s', '6,000'], ['p99 latency', '90 ms'], ['errors', '0%'], ['healthy servers', '3 / 3']],
      body: [
        'A [[load-balancer]] has one public address. Clients only ever talk to it; it forwards each request to one of several identical servers behind it, and passes the response back.',
        'Now capacity grows by adding servers, and losing one server no longer takes the site down. The simplest strategy, <b>round robin</b>, hands requests to A, B, C, A, B, C… in turn.',
      ],
    },
    {
      short: 'Algorithms', title: 'Round robin vs least connections when requests differ', tag: 'concept',
      scene: { nodes: [users(), lb({ sub: 'least connections', state: 'active' }), ...three(['2 open (one 8 s report)', '1 open', '1 open'], ['upd', '', ''])], edges: lbEdges(),
        flows: [f('users>lb', 'req', { kind: 'user', every: 0.5, speed: 320 }), f('lb>s1', 'report', { kind: 'cache', every: 6, speed: 120 }), f('lb>s2', '', { kind: 'lb', every: 0.9, speed: 320 }), f('lb>s3', '', { kind: 'lb', every: 0.9, delay: 0.45, speed: 320 })] },
      body: [
        'Round robin assumes every request costs the same. Real traffic mixes a 5 ms “get profile” with an 8-second “export report”. Round robin keeps sending A its share even while it is busy with heavy work.',
        '<ul><li><b>Least connections</b>: pick the server with the fewest in-flight requests — adapts to uneven work.</li><li><b>Weighted</b>: bigger machines get a bigger share.</li><li><b>Hashing</b> (by client IP or a key): the same client or key always lands on the same server — useful for caches, see Consistent Hashing.</li><li><b>Power of two choices</b>: pick two servers at random, send to the less loaded. Nearly as good as least-connections, much cheaper at scale.</li></ul>',
      ],
      interview: 'Interviewers like the trade-off: round robin is stateless and simple; least connections needs the balancer to track in-flight requests per server, but handles slow requests far better.',
    },
    {
      short: 'Health checks', title: 'Health checks: stop sending traffic to a dead server', tag: 'concept',
      scene: { nodes: [users(), lb({ sub: 'GET /health every 5 s', state: 'active' }), ...three(['✗ 3 failed checks', 'CPU 50%', 'CPU 50%'], ['bad', 'ok', 'ok'])], edges: lbEdges(1),
        flows: [f('users>lb', 'req', { kind: 'user', every: 0.35, speed: 320 }), f('lb>s2', '', { kind: 'lb', every: 0.7, speed: 320 }), f('lb>s3', '', { kind: 'lb', every: 0.7, delay: 0.35, speed: 320 }), f('lb>s1', '/health', { kind: 'cache', every: 2.5, fail: true })] },
      facts: [['requests / s', '6,000'], ['p99 latency', '110 ms'], ['errors', '0%'], ['healthy servers', '2 / 3']],
      body: [
        'The balancer sends a [[health-check]] — e.g. `GET /health` — to every server on a schedule. After a few consecutive failures (the “unhealthy threshold”) it removes that server from rotation; after a few passes it adds it back.',
        'Server A crashes; within seconds traffic flows only to B and C and users notice nothing. Make `/health` meaningful but cheap: check that the process can serve requests and reach critical dependencies, without hammering the database on every probe.',
      ],
      code: { file: 'health.js', lang: 'js', src: `
// Express: a cheap, honest health endpoint
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');                 // can we reach the DB?
    res.status(200).json({ ok: true, version: process.env.GIT_SHA });
  } catch {
    res.status(503).json({ ok: false });       // LB takes us out of rotation
  }
});`, hl: [4, 5, 7] },
    },
    {
      short: 'Stateless', title: 'Servers must be stateless (or sessions stick)', tag: 'concept',
      scene: { nodes: [users(), lb(), ...three(['no session in memory', 'no session in memory', 'no session in memory'], ['ok', 'ok', 'ok']), n('redis', 760, 490, 'Session store (Redis)', { kind: 'cache', sub: 'shared by all servers', state: 'active' })],
        edges: [...lbEdges(), e('s1', 'redis', '', { style: 'dashed', bend: 60 }), e('s2', 'redis', '', { style: 'dashed', bend: 40 }), e('s3', 'redis', '', { style: 'dashed' })], h: 540,
        flows: [f('users>lb', 'cookie', { kind: 'user', every: 0.6, speed: 300 }), f('lb>s2', '', { kind: 'lb', every: 1.2, speed: 300 }), f('s2>redis', 'session?', { kind: 'cache', every: 2.4, delay: 0.4 })] },
      body: [
        'If server A keeps your login session in its own memory, your next request — sent to B — finds no session and logs you out. Two fixes:',
        '<ul><li><b>[[sticky-session|Sticky sessions]]</b>: the balancer pins each user to one server (via a cookie). Quick, but load becomes uneven, and when that server dies its users lose their sessions.</li><li><b>[[stateless]] servers</b> (preferred): keep session data in a shared store (Redis, the database) or in a signed token the client sends. Any server can handle any request, so scaling and failover just work.</li></ul>',
      ],
    },
    {
      short: 'L4 vs L7', title: 'Layer 4 vs Layer 7 load balancing', tag: 'concept',
      scene: { nodes: [
        users(), n('lb', 400, 260, 'L7 load balancer', { kind: 'lb', sub: 'reads HTTP: path, headers', state: 'active' }),
        n('api', 760, 120, 'API pool', { kind: 'server', sub: '/api/*' }), n('web', 760, 260, 'Web pool', { kind: 'server', sub: '/*' }), n('ws', 760, 400, 'Realtime pool', { kind: 'server', sub: 'Upgrade: websocket' }),
        n('l4', 400, 440, 'L4: sees only IP + port → fastest, protocol-agnostic', { kind: 'note', icon: false }),
      ], edges: [e('users', 'lb'), e('lb', 'api', '/api'), e('lb', 'web', '/'), e('lb', 'ws', 'ws')],
        flows: [f('users>lb', 'req', { kind: 'user', every: 0.5, speed: 300 }), f('lb>api', '/api/cart', { kind: 'lb', every: 1.5, speed: 300 }), f('lb>web', '/', { kind: 'lb', every: 1.5, delay: 0.5, speed: 300 }), f('lb>ws', 'ws', { kind: 'lb', every: 3, delay: 1, speed: 300 })] },
      body: [
        '<b>Layer 4</b> balancers (TCP/UDP) route by IP address and port without reading the request. They are extremely fast and work for any protocol (databases, game servers, raw TCP). AWS Network Load Balancer is one.',
        '<b>Layer 7</b> balancers (HTTP) terminate TLS and read the request, so they can route by path, host or header, rewrite requests, add retries, rate limit and compress. AWS Application Load Balancer, nginx, HAProxy and Envoy all work here. Most web apps want L7.',
      ],
    },
    {
      short: 'No SPOF', title: 'Don’t let the load balancer become the single point of failure', tag: 'concept',
      scene: { nodes: [
        users({ sub: 'DNS → one virtual IP' }), n('lb', 400, 180, 'LB (active)', { kind: 'lb', sub: 'holds the virtual IP', state: 'ok' }), n('lb2', 400, 360, 'LB (standby)', { kind: 'lb', sub: 'heartbeat · takes over in ~1 s', state: 'dim' }),
        ...three(['zone a', 'zone b', 'zone c'], ['ok', 'ok', 'ok']),
      ], edges: [e('users', 'lb'), e('lb', 'lb2', 'heartbeat', { dir: '<->', style: 'dashed' }), e('lb', 's1'), e('lb', 's2'), e('lb', 's3')],
        flows: [f('users>lb', 'req', { kind: 'user', every: 0.5, speed: 300 }), f('lb>s1', '', { kind: 'lb', every: 1.5, speed: 300 }), f('lb>s2', '', { kind: 'lb', every: 1.5, delay: 0.5, speed: 300 }), f('lb>s3', '', { kind: 'lb', every: 1.5, delay: 1, speed: 300 })] },
      body: [
        'One balancer in front of many servers is itself a single point of failure. Classic fix: an <b>active–passive pair</b> sharing a virtual IP; the standby watches a heartbeat and takes the IP over if the active one dies (keepalived/VRRP).',
        'Cloud balancers (AWS ALB/NLB, Google Cloud Load Balancing) are already redundant across availability zones. At global scale, DNS-based balancing and [[anycast]] spread traffic across regions before it ever reaches a balancer.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'What does a load balancer do, and why use one?', a: ['It accepts client traffic on one address and distributes requests across multiple backend servers, removing unhealthy ones. It enables horizontal scaling, higher availability, zero-downtime deploys (drain and replace servers) and often TLS termination.'] },
    { lvl: 'J', q: 'Vertical vs horizontal scaling?', a: ['Vertical: a bigger machine — simple, but limited, pricey at the top end, and still a single point of failure. Horizontal: more machines behind a load balancer — nearly unlimited and fault-tolerant, but requires stateless services and more operational work.'] },
    { lvl: 'M', q: 'Compare round robin, least connections and hashing.', a: ['Round robin: rotate evenly, stateless, best when requests are similar. Least connections: send to the server with fewest active requests, best for uneven request costs. Hash-based (IP or key): same client/key → same server, good for cache locality but uneven under hot keys and reshuffles when servers change (use consistent hashing).'] },
    { lvl: 'M', q: 'Why are sticky sessions discouraged?', a: ['They cause uneven load (a few heavy users pinned to one server), complicate scaling down and deploys, and lose sessions when a server dies. Stateless services with sessions in a shared store or signed tokens avoid all three.'] },
    { lvl: 'S', q: 'Design load balancing for an app serving 1M users across two regions.', a: ['Global layer: DNS with latency-based or geo routing (or anycast) to the nearest healthy region, with health-checked failover. Regional layer: a managed L7 balancer across 3 availability zones, routing by path to service pools in autoscaling groups. Stateless services, sessions in a replicated store, health checks on meaningful endpoints, connection draining for deploys, and a CDN in front for static assets.'], why: 'Checks that you can layer global and regional balancing and connect it to statelessness and failure handling.' },
  ],
  scenarios: [
    { title: 'Deploys cause a burst of 502 errors', sit: 'New servers start receiving traffic immediately and old ones are killed instantly.', steps: [['x', 'Old servers are killed with requests still in flight → 502.'], ['x', 'New servers get traffic before they finish warming up.']], fix: 'Connection draining (deregistration delay) for old servers, and readiness checks so new ones join only when ready.' },
    { title: 'One server is at 95% CPU, the others at 20%', sit: 'The balancer uses IP hashing; a corporate customer sends all traffic from one NAT IP.', steps: [['x', 'Every request from that office hashes to the same server.']], fix: 'Switch to least connections or round robin, and keep servers stateless.' },
  ],
  history: {
    timeline: [
      { yr: '1990s', title: 'DNS round robin', text: 'Multiple A records for one name spread clients across servers — crude, with no health checks and slow caching.' },
      { yr: '1990s–2000s', title: 'Hardware appliances', text: 'Dedicated L4/L7 boxes (F5 BIG-IP and others) sat in front of data-centre server farms.' },
      { yr: '2000–2004', title: 'HAProxy and nginx', text: 'Fast open-source software balancers on commodity hardware.', c: 'g' },
      { yr: '2009', title: 'AWS Elastic Load Balancing', text: 'Load balancing became a managed cloud service; ALB (L7) and NLB (L4) followed in 2016–2017.' },
      { yr: '2016–now', title: 'Service meshes', text: 'Envoy (Lyft, 2016) and Istio moved balancing into sidecars next to every service, with retries and circuit breaking.' },
    ],
    alts: { cols: ['Option', 'Layer', 'Good for'], rows: [['AWS ALB', 'L7', 'HTTP apps, path/host routing, containers'], ['AWS NLB', 'L4', 'Very high throughput, static IPs, any TCP/UDP'], ['nginx / HAProxy', 'L4 + L7', 'Self-managed, highly configurable'], ['Envoy / service mesh', 'L7', 'Microservice-to-microservice traffic'], ['DNS / anycast (Route 53, Cloudflare)', 'Global', 'Routing users to the nearest healthy region']] },
  },
  quiz: [
    { q: 'Requests vary from 5 ms to 8 s. Which algorithm adapts best?', o: ['Round robin', 'Least connections', 'Random', 'DNS round robin'], a: 1, why: 'It avoids servers busy with long requests.' },
    { q: 'A server fails its health check 3 times. The balancer…', o: ['restarts it', 'stops routing traffic to it', 'deletes the database', 'switches region'], a: 1, why: 'It removes it from rotation until it passes again.' },
    { q: 'Which can route `/api/*` and `/*` to different pools?', o: ['L4 balancer', 'L7 balancer', 'DNS', 'A switch'], a: 1, why: 'Only L7 reads the HTTP path.' },
    { q: 'The preferred way to handle sessions behind a balancer is…', o: ['sticky sessions', 'stateless servers with a shared session store or tokens', 'one big server', 'cookies stored on each server'], a: 1, why: 'Any server can then serve any request.' },
  ],
  cheat: `<h3>Algorithms</h3><table class="t"><tr><td>Round robin</td><td>equal turns; similar requests</td></tr><tr><td>Weighted</td><td>mixed machine sizes</td></tr><tr><td>Least connections</td><td>uneven request cost</td></tr><tr><td>IP / key hash</td><td>affinity, cache locality (use consistent hashing)</td></tr><tr><td>Power of two choices</td><td>large fleets, cheap and near-optimal</td></tr></table>
  <h3>Checklist</h3><ul><li>Stateless services; sessions in Redis/DB or signed tokens</li><li>Health checks + readiness; connection draining on deploy</li><li>L7 for HTTP routing/TLS; L4 for raw throughput</li><li>Redundant balancers across zones; DNS/anycast across regions</li></ul>`,
};
