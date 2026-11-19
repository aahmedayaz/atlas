export default {
  title: 'Load balancing — sharing traffic across servers',
  intro: 'What happens when one server is not enough? This book starts with a single overloaded shop counter and builds up to health checks, sessions, Layer 4 vs Layer 7, and avoiding a single point of failure — the core of almost every system design interview.',
  chapters: [
    {
      level: 1, title: 'One server has limits',
      text: [
        'A server is a computer with a fixed amount of CPU, memory and network capacity. It can handle only so many requests per second.',
        'When more requests arrive than it can handle, they queue up, responses get slow, and eventually requests fail with errors or **timeouts**.',
      ],
      words: [
        ['Request', 'One message from a user’s browser or app asking the server for something.'],
        ['Throughput', 'How many requests a system handles per second.'],
        ['Timeout', 'Giving up on a request because the answer took too long.'],
      ],
      example: 'A shop with one cashier: on a quiet day it is fine; on sale day the queue goes out the door and people leave.',
      remember: 'Every server has a ceiling.',
      check: ['What do users notice first when a server is near its limit?', 'Responses get slower (higher latency), before outright errors appear.'],
    },
    {
      level: 1, title: 'Scale up or scale out',
      text: [
        '**Vertical scaling** (scale up) means buying a bigger server. It is simple, but there is a maximum size, it gets very expensive, and it is still one machine that can fail.',
        '**Horizontal scaling** (scale out) means adding more servers that do the same job. It can grow almost without limit and survive failures — but now something has to decide which server gets each request.',
      ],
      words: [
        ['Vertical scaling', 'Making one machine more powerful.'],
        ['Horizontal scaling', 'Adding more machines.'],
        ['Instance', 'One running copy of your server.'],
      ],
      example: 'Hiring one super-fast cashier (vertical) versus opening more checkout counters (horizontal).',
      remember: 'Scale out needs a traffic director.',
      check: ['Name one weakness of vertical scaling besides cost.', 'It is still a single machine: if it fails, everything is down. And there is a size limit.'],
    },
    {
      level: 1, title: 'The load balancer',
      text: [
        'A **load balancer** sits in front of your servers. Users connect to it, and it forwards each request to one of the servers behind it (the **backends**), then passes the response back.',
        'To users there is one address. Behind it you can add, remove or replace servers freely.',
      ],
      words: [
        ['Load balancer (LB)', 'A component that spreads incoming requests across several servers.'],
        ['Backend / upstream', 'A server behind the load balancer that does the real work.'],
        ['Pool', 'The group of backends the load balancer can choose from.'],
      ],
      example: 'The person at a supermarket entrance pointing each customer to an open checkout. AWS ALB, NGINX, HAProxy and Cloudflare all play this role.',
      remember: 'One front door, many workers behind it.',
      check: ['Does the user know which backend served them?', 'Normally no — they only see the load balancer’s address.'],
    },
    {
      level: 2, title: 'Choosing a server: algorithms',
      text: [
        '**Round robin** gives each server a turn in order: 1, 2, 3, 1, 2, 3. Simple, and fine when requests are similar. **Weighted round robin** sends more to bigger servers.',
        '**Least connections** picks the server currently handling the fewest requests — better when some requests are long (reports, uploads).',
        '**Hashing** (e.g. by user ID or IP) always sends the same key to the same server, useful for caches.',
      ],
      words: [
        ['Algorithm', 'A rule the load balancer follows to choose a server.'],
        ['Round robin', 'Taking turns in a fixed order.'],
        ['Least connections', 'Choosing the server with the fewest active requests.'],
        ['Consistent hashing', 'A hashing method where adding/removing a server moves only a small share of keys.'],
      ],
      example: 'Round robin is “next counter please” regardless of queue; least connections is “go to the shortest queue”.',
      remember: 'Similar requests → round robin. Mixed lengths → least connections.',
      check: ['Some requests take 30 s, most take 50 ms. Which algorithm?', 'Least connections, so long requests do not pile up on one server.'],
    },
    {
      level: 2, title: 'Health checks: stop sending to broken servers',
      text: [
        'The load balancer regularly calls each backend, e.g. `GET /health` every 10 seconds. If a server fails several checks in a row, it is marked **unhealthy** and removed from rotation. When it passes again, it is added back.',
        'A good health endpoint checks that the app can really serve (for example, that it can reach its database), not only that the process is alive.',
      ],
      words: [
        ['Health check', 'A small automatic test request to see if a server is working.'],
        ['Unhealthy', 'Marked as not able to serve; receives no traffic.'],
        ['Threshold', 'How many failed (or passed) checks in a row are needed to change status.'],
      ],
      example: 'A manager tapping each cashier on the shoulder; if one does not answer three times, that counter’s light goes off.',
      remember: 'No health checks = traffic sent to dead servers.',
      check: ['Why require several failed checks, not just one?', 'To avoid removing a healthy server because of one brief glitch (flapping).'],
    },
    {
      level: 2, title: 'Sessions and statelessness',
      text: [
        'If server 1 keeps your login **session** in its own memory, and your next request goes to server 2, server 2 does not know you. You appear logged out.',
        'One workaround is **sticky sessions** (always send a user to the same server), but it unbalances load and breaks when that server dies. The better design is **stateless** servers: keep sessions in a shared store like **Redis**, or in a signed token/cookie, so any server can handle any request.',
      ],
      words: [
        ['Session', 'Data that remembers a user between requests, such as “logged in as Ada”.'],
        ['Stateless server', 'A server that keeps no user data in its own memory between requests.'],
        ['Redis', 'A very fast in-memory data store, often used for sessions and caching.'],
        ['Sticky session', 'Pinning a user to one backend.'],
      ],
      example: 'Writing orders on a shared board instead of in one cashier’s head — any cashier can finish your order.',
      remember: 'Make servers stateless; put shared state in a shared store.',
      check: ['Why do sticky sessions make scaling down risky?', 'Users pinned to a removed server lose their sessions.'],
    },
    {
      level: 3, title: 'Layer 4 vs Layer 7',
      text: [
        'Networks are described in layers. A **Layer 4** load balancer works with TCP/UDP connections: it sees IP addresses and ports, not the content. It is very fast and works for any protocol.',
        'A **Layer 7** load balancer understands HTTP: it can read the path, headers and cookies, so it can route `/api/*` to one service and `/images/*` to another, terminate TLS, and add headers.',
      ],
      words: [
        ['OSI model', 'A 7-layer way of describing networking, from physical wires (1) to applications (7).'],
        ['TCP', 'The protocol that delivers a reliable stream of bytes between two computers.'],
        ['HTTP', 'The protocol of the web: requests with methods, paths and headers.'],
        ['TLS termination', 'Decrypting HTTPS at the load balancer so backends receive plain HTTP.'],
      ],
      example: 'A mail sorter who reads only the address on the envelope (L4) versus one who opens the letter and routes it by its subject (L7). AWS NLB is L4; AWS ALB is L7.',
      remember: 'L4 = fast, content-blind. L7 = smart routing by HTTP details.',
      check: ['You need to send `/api` and `/static` to different services. L4 or L7?', 'L7 — routing by URL path requires understanding HTTP.'],
    },
    {
      level: 3, title: 'Who balances the load balancer?',
      text: [
        'A single load balancer is a new **single point of failure (SPOF)**: if it dies, everything is unreachable.',
        'Fixes: run at least two in an **active-passive** pair sharing a floating IP (with tools like keepalived), or **active-active** behind DNS. Managed services like AWS ELB do this for you across multiple **availability zones**. For global traffic, DNS-based or anycast load balancing spreads users across regions.',
      ],
      words: [
        ['Single point of failure', 'One component whose failure takes down the whole system.'],
        ['Failover', 'Automatically switching to a backup when the main one fails.'],
        ['Availability zone', 'A separate data centre within a cloud region, with independent power and networking.'],
        ['Anycast', 'Many servers sharing one IP address; the network routes you to the nearest one.'],
      ],
      example: 'A building with two front doors and a doorman at each, so a jammed door never locks everyone out.',
      remember: 'Every layer needs redundancy, including the load balancer.',
      check: ['What is the risk of exactly one self-hosted NGINX in front of ten servers?', 'It is a single point of failure: if it dies, all ten servers are unreachable.'],
    },
  ],
};
