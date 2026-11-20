import { n, e, f, z } from '../../engine/build.js';

const app = (o = {}) => n('app', 120, 250, 'Your app / CLI', { kind: 'cli', sub: o.sub || 'HTTPS requests', ...o });

export default {
  id: 's3-basics',
  title: 'S3 buckets, objects and keys: CRUD from console, CLI, SDK and CDK',
  level: 'Beginner',
  minutes: 40,
  tags: ['AWS', 'S3', 'Storage', 'CDK', 'CLI'],
  summary: 'What object storage is, bucket rules and defaults, keys, prefixes and the folder illusion, every size limit (now 50 TB objects), create/read/update/delete in the console, CLI, TypeScript SDK and CDK, S3’s consistency model and conditional writes, and storage classes.',
  learn: ['Object storage vs a file system', 'Bucket naming, regions, quotas, defaults and the new account regional namespace', 'Keys, metadata, tags, ETags and version IDs', 'Prefixes, delimiters and request-rate scaling', 'All the size limits', 'CRUD in console, CLI (`s3` vs `s3api`), SDK v3 and CDK', 'Strong consistency, last-writer-wins and conditional writes', 'Storage classes and what you pay for'],
  steps: [
    {
      short: 'Object storage', title: 'Object storage: a giant key → bytes map over HTTPS', tag: 'concept',
      scene: { zones: [z('b', 330, 60, 600, 380, 'Bucket: acme-uploads (eu-west-1)', 's3')], nodes: [app(), n('o1', 480, 150, 'avatars/ada.png', { kind: 'obj', sub: '412 KB · image/png' }), n('o2', 480, 270, 'invoices/2026/11/inv-42.pdf', { kind: 'obj', sub: '88 KB' }), n('o3', 480, 390, 'logs/app-2026-11-20.gz', { kind: 'obj', sub: '3.1 GB' }), n('note', 800, 250, 'no real folders,\nno partial edits', { kind: 'note', icon: false })],
        edges: [e('app', 'o1', 'PUT / GET by key')], flows: [f('app>o1', 'PUT', { kind: 'cli', every: 2.6 }), f('app>o1', 'bytes', { kind: 's3', every: 2.6, delay: 1.3, back: true })] },
      body: [
        '[[s3|Amazon S3]] stores **objects** inside **buckets**. Think of a bucket as a huge dictionary: the **key** is a string like `invoices/2026/11/inv-42.pdf` and the value is the object’s bytes plus metadata. You talk to it with HTTPS API calls — `PutObject`, `GetObject`, `DeleteObject`, `ListObjectsV2`.',
        'It is **not a file system**: there are no real directories, no `rename` or `append` for general purpose buckets, and you cannot edit bytes in the middle of an object — you replace the whole object. In exchange you get practically unlimited capacity and 11 nines (99.999999999%) of durability by storing data across multiple Availability Zones.',
      ],
    },
    {
      short: 'Buckets', title: 'Buckets: names, regions, quotas and secure defaults', tag: 'concept',
      scene: { nodes: [n('con', 140, 250, 'S3 console', { kind: 's3', sub: 'Create bucket' }), n('name', 470, 90, 'Name: acme-uploads', { kind: 'file', sub: 'globally unique · 3–63 chars' }), n('reg', 470, 200, 'Region: eu-west-1', { kind: 'aws', sub: 'data stays here' }), n('own', 470, 310, 'ACLs disabled', { kind: 'lock', sub: 'Bucket owner enforced' }), n('bpa', 470, 420, 'Block Public Access: ON', { kind: 'iam', sub: 'all 4 settings' }), n('b', 860, 250, 'Bucket', { kind: 's3', sub: 'SSE-S3 encrypted by default', state: 'ok' })],
        edges: [e('con', 'name'), e('con', 'reg'), e('con', 'own'), e('con', 'bpa'), e('reg', 'b')], h: 500 },
      body: [
        'A [[bucket]] lives in one [[region]] (objects never leave it unless you copy or replicate them). Names are **3–63 characters**: lowercase letters, numbers, hyphens (and dots, which break virtual-hosted HTTPS — avoid them), must start and end with a letter or number, and by default must be **globally unique** across all AWS customers.',
        'Since March 2026 you can instead create buckets in your **account regional namespace**: names carrying your account-and-region suffix that no other account can take — handy for bucket-per-customer designs.',
        'Default quota: **10,000 general purpose buckets per account** (raise to 1 million). Buckets created today are secure by default: **Block Public Access on**, **ACLs disabled** (*Bucket owner enforced*), **SSE-S3 encryption** for every new object, and **SSE-C blocked** (since April 2026). Versioning is off until you enable it. Other bucket types exist for special jobs: directory buckets (S3 Express One Zone), table buckets (Apache Iceberg) and vector buckets.',
      ],
      code: { file: 'make-bucket.sh', lang: 'bash', src: `
aws s3api create-bucket --bucket acme-uploads-7f3k \\
  --region eu-west-1 \\
  --create-bucket-configuration LocationConstraint=eu-west-1   # omit only for us-east-1
aws s3api get-public-access-block --bucket acme-uploads-7f3k
aws s3api get-bucket-encryption --bucket acme-uploads-7f3k
aws s3api get-bucket-ownership-controls --bucket acme-uploads-7f3k`, hl: [1, 3] },
      callout: { kind: 'warn', title: 'us-east-1 quirk', text: 'For us-east-1 you must NOT pass `LocationConstraint`; for every other region you must. A favourite source of `IllegalLocationConstraintException`.' },
    },
    {
      short: 'Objects & keys', title: 'An object: key, data, metadata, tags, ETag, version', tag: 'concept',
      scene: { nodes: [n('obj', 480, 250, 'invoices/2026/11/inv-42.pdf', { kind: 'obj', sub: 'one object', state: 'active' }), n('k', 150, 110, 'Key (≤ 1,024 bytes)', { kind: 'file' }), n('d', 150, 250, 'Data: 0 B – 50 TB', { kind: 'file' }), n('m', 150, 390, 'Metadata', { kind: 'file', sub: 'Content-Type · x-amz-meta-*' }), n('t', 820, 110, 'Tags (≤ 10)', { kind: 'file', sub: 'for lifecycle, IAM, cost' }), n('et', 820, 250, 'ETag', { kind: 'kms', sub: 'content fingerprint' }), n('v', 820, 390, 'Version ID', { kind: 'clock', sub: 'null unless versioning' })],
        edges: [e('k', 'obj'), e('d', 'obj'), e('m', 'obj'), e('t', 'obj'), e('et', 'obj'), e('v', 'obj')] },
      body: [
        'Each [[s3-object|object]] has: the **[[s3-key|key]]** (up to 1,024 bytes of UTF-8), the **data**, **system metadata** (`Content-Type`, `Content-Length`, `Last-Modified`, storage class, encryption) and **user metadata** (`x-amz-meta-*` headers, max 2 KB, fixed at upload — changing it means copying the object onto itself).',
        '**Tags** (up to 10 key/value pairs) *can* be changed later and drive lifecycle rules, IAM conditions and cost reports. The **[[etag|ETag]]** identifies the content (MD5 for simple uploads; not an MD5 for multipart/KMS). With versioning, each write gets a **version ID**.',
      ],
    },
    {
      short: 'Prefixes', title: 'Prefixes, delimiters and the folder illusion', tag: 'internals',
      scene: { nodes: [n('list', 140, 250, 'ListObjectsV2', { kind: 'cli', sub: 'Prefix=invoices/2026/  Delimiter=/' }), n('cp1', 520, 140, 'CommonPrefixes', { kind: 'file', sub: 'invoices/2026/10/ · invoices/2026/11/' }), n('ct', 520, 360, 'Contents', { kind: 'obj', sub: 'invoices/2026/summary.csv' }), n('ui', 880, 250, 'Console shows “folders”', { kind: 'browser', sub: 'just grouped prefixes' })],
        edges: [e('list', 'cp1'), e('list', 'ct'), e('cp1', 'ui', '', { style: 'dashed' })], flows: [f('list>cp1', '', { kind: 'cli', every: 2.8 }), f('list>ct', '', { kind: 'cli', every: 2.8, delay: 0.5 })] },
      body: [
        'A [[prefix]] is just the start of a key. `ListObjectsV2` with `Prefix=invoices/2026/` returns keys starting with that; add `Delimiter=/` and S3 **groups** deeper keys into `CommonPrefixes` — that is exactly how the console draws “folders”. *Create folder* in the console just writes a zero-byte object whose key ends in `/`.',
        'Prefixes matter for **performance**: S3 supports at least **3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per partitioned prefix**, and partitions automatically as traffic grows. Spreading hot traffic across several prefixes (e.g. `shard-0/`, `shard-1/`) raises the ceiling; sudden spikes can see `503 SlowDown` while S3 scales.',
        'Prefixes are also the unit for IAM conditions (`s3:prefix`), lifecycle rules, replication filters and event filters.',
      ],
    },
    {
      short: 'Size limits', title: 'Every size limit you will be asked about', tag: 'concept',
      scene: { nodes: [n('a', 160, 100, 'Object: 0 B – 50 TB', { kind: 'obj', sub: 'was 5 TB until Dec 2025', state: 'active' }), n('b', 160, 230, 'Single PUT: ≤ 5 GB', { kind: 'cli' }), n('c', 160, 360, 'Multipart: ≤ 10,000 parts', { kind: 'layers', sub: '5 MiB – 5 GiB per part' }), n('d', 620, 100, 'Console upload: ≤ 160 GB', { kind: 'browser' }), n('e2', 620, 230, 'User metadata: 2 KB', { kind: 'file' }), n('f2', 620, 360, 'DeleteObjects: 1,000 keys', { kind: 'cli', sub: 'per request' })], h: 460 },
      body: [
        '<ul><li><b>Object size:</b> 0 bytes to **50 TB** (raised from 5 TB in December 2025). The practical ceiling is set by multipart: 10,000 parts × 5 GiB.</li><li><b>Single `PutObject`:</b> up to **5 GB**. AWS recommends [[multipart|multipart upload]] from about **100 MB**.</li><li><b>Multipart:</b> up to **10,000 parts**, each **5 MiB–5 GiB** (the last part may be smaller).</li><li><b>Console upload:</b> up to **160 GB** per file — use the CLI/SDK for bigger.</li><li><b>Key:</b> 1,024 bytes · <b>user metadata:</b> 2 KB · <b>tags:</b> 10 per object.</li><li><b>`DeleteObjects`:</b> up to 1,000 keys per request · <b>`ListObjectsV2`:</b> up to 1,000 keys per page.</li></ul>',
      ],
    },
    {
      short: 'Console CRUD', title: 'Create, read, update, delete — in the console', tag: 'concept',
      scene: { nodes: [n('up', 140, 120, 'Upload', { kind: 'browser', sub: 'drag & drop · properties' }), n('open', 140, 380, 'Open / Download', { kind: 'browser', sub: 'presigned link behind the scenes' }), n('b', 500, 250, 'acme-uploads', { kind: 's3' }), n('act', 860, 120, 'Actions ▾', { kind: 'browser', sub: 'copy · move · edit metadata/tags' }), n('del', 860, 380, 'Delete', { kind: 'browser', sub: 'type “permanently delete”', state: 'bad' })],
        edges: [e('up', 'b', 'PUT'), e('b', 'open', 'GET'), e('act', 'b', 'COPY'), e('del', 'b', 'DELETE')], flows: [f('up>b', '', { kind: 'browser', every: 3 }), f('b>open', '', { kind: 's3', every: 3, delay: 1 })] },
      body: [
        '<b>Create/upload:</b> bucket → *Upload* → *Add files* / *Add folder* → optional *Properties* (storage class, encryption, tags, metadata) → *Upload*. <b>Read:</b> select the object → *Open* or *Download*; the *Object URL* only works if the object is public (it normally isn’t). <b>Update:</b> upload again with the same key (overwrite), or *Actions → Edit metadata / Edit tags / Edit storage class* (metadata edits copy the object). <b>Rename/move:</b> *Actions → Copy / Move* — S3 copies to the new key and deletes the old one.',
        '<b>Delete:</b> select → *Delete* → type the confirmation. With versioning on, this adds a delete marker; *Show versions* lets you delete specific versions permanently. Deleting a bucket requires it to be empty first (*Empty* button).',
      ],
    },
    {
      short: 'CLI CRUD', title: 'CRUD with the CLI: `aws s3` vs `aws s3api`', tag: 'code',
      scene: { nodes: [n('hi', 150, 150, 'aws s3 (high-level)', { kind: 'cli', sub: 'cp · mv · rm · sync · ls' }), n('lo', 150, 350, 'aws s3api (low-level)', { kind: 'cli', sub: '1 command = 1 API call' }), n('b', 620, 250, 'acme-uploads', { kind: 's3' })],
        edges: [e('hi', 'b', 'auto multipart, parallel'), e('lo', 'b', 'exact control')], flows: [f('hi>b', '', { kind: 'cli', every: 2.6 }), f('lo>b', '', { kind: 'cli', every: 2.6, delay: 1.3 })] },
      body: [
        '`aws s3` is convenient: recursive copies, `sync`, wildcards via `--exclude/--include`, and **automatic multipart and parallel transfers** for large files. `aws s3api` maps one-to-one to API operations — use it for headers, metadata, conditional requests and anything bucket-configuration related.',
      ],
      code: { file: 'crud.sh', lang: 'bash', src: `
aws s3 cp report.pdf s3://acme-uploads/reports/2026/report.pdf      # create/overwrite
aws s3 cp s3://acme-uploads/reports/2026/report.pdf ./              # read
aws s3 ls s3://acme-uploads/reports/ --recursive --human-readable
aws s3 mv s3://acme-uploads/tmp/a.csv s3://acme-uploads/done/a.csv  # copy + delete
aws s3 sync ./site s3://acme-site --delete --exclude "*.map"
aws s3 rm s3://acme-uploads/tmp/ --recursive

aws s3api put-object --bucket acme-uploads --key notes/a.txt --body a.txt \\
  --content-type text/plain --metadata owner=ada --tagging "team=web"
aws s3api head-object --bucket acme-uploads --key notes/a.txt   # metadata only
aws s3api get-object --bucket acme-uploads --key notes/a.txt out.txt
aws s3api delete-object --bucket acme-uploads --key notes/a.txt`, hl: [1, 5, 8, 10] },
    },
    {
      short: 'SDK CRUD', title: 'CRUD in TypeScript with AWS SDK v3', tag: 'code',
      scene: { nodes: [n('code', 140, 250, 'S3Client.send(cmd)', { kind: 'code', sub: '@aws-sdk/client-s3' }), n('b', 520, 250, 'acme-uploads', { kind: 's3' }), n('res', 860, 250, 'Response', { kind: 'file', sub: 'Body is a stream' })],
        edges: [e('code', 'b', 'PutObjectCommand…'), e('b', 'res')], flows: [f('code>b', '', { kind: 'code', every: 2.6 }), f('b>res', '', { kind: 's3', every: 2.6, delay: 0.9 })] },
      body: [
        'SDK v3 is modular: install only `@aws-sdk/client-s3`. Create one `S3Client` per region (reuse it — it pools connections) and `send()` command objects. Credentials come from the provider chain, so the same code works on your laptop (`aws login`) and in Lambda (execution role).',
        '`GetObject` returns `Body` as a **stream**; use `transformToString()` / `transformToByteArray()` for small objects, or pipe it for big ones (next lesson).',
      ],
      code: { file: 'crud.ts', lang: 'ts', src: `
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'eu-west-1' });
const Bucket = 'acme-uploads';

await s3.send(new PutObjectCommand({ Bucket, Key: 'notes/a.json',
  Body: JSON.stringify({ hi: 1 }), ContentType: 'application/json',
  Metadata: { owner: 'ada' } }));                                   // Create / Update

const obj = await s3.send(new GetObjectCommand({ Bucket, Key: 'notes/a.json' }));
const data = JSON.parse(await obj.Body!.transformToString());       // Read

const head = await s3.send(new HeadObjectCommand({ Bucket, Key: 'notes/a.json' }));
console.log(head.ContentLength, head.ETag, head.Metadata);

await s3.send(new CopyObjectCommand({ Bucket, Key: 'archive/a.json',
  CopySource: \`\${Bucket}/notes/a.json\` }));                          // "rename" = copy …
await s3.send(new DeleteObjectCommand({ Bucket, Key: 'notes/a.json' })); // … + delete
await s3.send(new DeleteObjectsCommand({ Bucket,
  Delete: { Objects: [{ Key: 'x' }, { Key: 'y' }] } }));            // ≤ 1,000 keys`, hl: [4, 7, 11, 17] },
    },
    {
      short: 'In CDK', title: 'Buckets in CDK (and uploading files at deploy time)', tag: 'code',
      scene: { nodes: [n('code', 140, 250, 'stack.ts', { kind: 'code', sub: 'new s3.Bucket(…)' }), n('cfn', 470, 250, 'CloudFormation', { kind: 'cfn' }), n('b', 790, 150, 'Bucket', { kind: 's3', sub: 'BPA · SSL only · versioned', state: 'ok' }), n('dep', 790, 360, 'BucketDeployment', { kind: 'lambda', sub: 'copies ./site at deploy' })],
        edges: [e('code', 'cfn', 'cdk deploy'), e('cfn', 'b'), e('cfn', 'dep'), e('dep', 'b', 'aws s3 sync')] },
      body: [
        'The L2 `s3.Bucket` gives secure defaults; be explicit anyway so reviewers see intent. `enforceSSL` adds the deny-non-TLS bucket policy; `removalPolicy` decides what `cdk destroy` does (RETAIN by default).',
        '`BucketDeployment` (from `aws-cdk-lib/aws-s3-deployment`) uploads local files during deploy — via a Lambda-backed custom resource — great for static sites and seed data.',
      ],
      code: { file: 'lib/storage-stack.ts', lang: 'ts', src: `
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

const uploads = new s3.Bucket(this, 'Uploads', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  versioned: true,
  removalPolicy: RemovalPolicy.RETAIN,
});

new s3deploy.BucketDeployment(this, 'Seed', {
  sources: [s3deploy.Source.asset('./seed')],
  destinationBucket: uploads,
  destinationKeyPrefix: 'seed/',
});`, hl: [5, 8, 9, 13] },
    },
    {
      short: 'Consistency', title: 'Consistency, overwrites and conditional writes', tag: 'internals',
      scene: { nodes: [n('w1', 140, 140, 'Writer A: PUT v1', { kind: 'code' }), n('w2', 140, 360, 'Writer B: PUT v2', { kind: 'code' }), n('b', 500, 250, 'key: config.json', { kind: 'obj', sub: 'last writer wins' }), n('r', 860, 250, 'Reader: GET', { kind: 'code', sub: 'always sees the latest' })],
        edges: [e('w1', 'b'), e('w2', 'b'), e('b', 'r', 'strong read-after-write')], flows: [f('w1>b', 'v1', { kind: 'code', every: 3 }), f('w2>b', 'v2', { kind: 'code', every: 3, delay: 0.3 }), f('b>r', 'v2', { kind: 's3', every: 3, delay: 1 })] },
      body: [
        'Since December 2020 S3 is **strongly consistent**: after a successful PUT or DELETE, every following GET, HEAD and LIST sees the change. No more “eventual consistency” workarounds.',
        'Two simultaneous PUTs to the same key → **last writer wins**; the other write is silently lost. To prevent that, use **conditional writes**: `If-None-Match: *` (create only if the key doesn’t exist — 2024) or `If-Match: <etag>` (overwrite only if unchanged since you read it). S3 answers `412 Precondition Failed` when the condition fails — a cheap optimistic lock with no database.',
      ],
      code: { file: 'conditional.ts', lang: 'ts', src: `
// create-only: fails with 412 if someone else already wrote this key
await s3.send(new PutObjectCommand({ Bucket, Key: 'locks/job-42', Body: 'mine',
  IfNoneMatch: '*' }));

// compare-and-swap: update only if nobody changed it since we read it
const cur = await s3.send(new GetObjectCommand({ Bucket, Key: 'config.json' }));
const next = edit(await cur.Body!.transformToString());
await s3.send(new PutObjectCommand({ Bucket, Key: 'config.json', Body: next,
  IfMatch: cur.ETag }));          // 412 → re-read and retry`, hl: [3, 9] },
    },
    {
      short: 'Storage classes', title: 'Storage classes and what you pay for', tag: 'concept',
      scene: { nodes: [n('std', 150, 130, 'Standard', { kind: 'obj', sub: 'hot · ms access' }), n('it', 450, 130, 'Intelligent-Tiering', { kind: 'obj', sub: 'auto moves by access' }), n('ia', 750, 130, 'Standard-IA / One Zone-IA', { kind: 'obj', sub: 'monthly access' }), n('gi', 750, 330, 'Glacier Instant', { kind: 'obj', sub: 'quarterly, ms' }), n('gd', 380, 330, 'Glacier Flexible / Deep Archive', { kind: 'obj', sub: 'restore: min → 48 h' })],
        edges: [e('std', 'it'), e('it', 'ia'), e('ia', 'gi'), e('gi', 'gd')] },
      body: [
        'You pay for **storage** (GB-month), **requests** (PUT/COPY/POST/LIST cost more than GET), **data transfer out** to the internet or other regions (in is free), and for cold classes **retrieval** fees, minimum storage durations (30/90/180 days) and minimum billable object sizes (128 KB for IA classes).',
        'Rules of thumb: unknown access pattern → **Intelligent-Tiering**; backups read rarely → **Standard-IA** or **Glacier Instant Retrieval**; compliance archives → **Deep Archive** (hours to restore). Move objects automatically with lifecycle rules (S3 lesson 5).',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'Does S3 have folders?', a: ['No. Keys are flat strings; “folders” are prefixes that the console groups using the `/` delimiter (and zero-byte `key/` objects when you click Create folder).'] },
    { lvl: 'J', q: 'Largest object and largest single PUT?', a: ['Objects up to 50 TB (since December 2025; 5 TB before). A single PutObject is limited to 5 GB; larger objects require multipart upload, recommended from about 100 MB.'] },
    { lvl: 'M', q: 'Is S3 eventually consistent?', a: ['Not since December 2020: it provides strong read-after-write consistency for PUTs and DELETEs, including LIST. Concurrent writes are last-writer-wins unless you use conditional writes (If-None-Match / If-Match).'] },
    { lvl: 'M', q: '`aws s3 cp` vs `aws s3api put-object`?', a: ['`s3 cp` is a high-level command with recursion, filters, and automatic multipart/parallel transfers. `s3api put-object` is a single API call with full control of headers but no multipart (5 GB limit).'] },
    { lvl: 'S', q: 'An upload service writes 20,000 small objects per second into one bucket and sees 503 SlowDown. What do you do?', a: ['Spread keys across many prefixes (hash/shard prefix) so S3 can partition — each partitioned prefix supports ~3,500 writes/s; use SDK retries with exponential backoff and jitter; batch tiny objects into larger ones if possible; ramp traffic gradually; consider S3 Express One Zone directory buckets for very high request rates.'], why: 'Tests the per-prefix scaling model and retry hygiene.' },
  ],
  history: {
    timeline: [
      { yr: 'Mar 2006', title: 'S3 launches', text: 'The first AWS service: simple PUT/GET object storage with 5 GB objects.' },
      { yr: '2010', title: 'Multipart upload; 5 TB objects', text: 'Large objects split into parallel parts.' },
      { yr: 'Dec 2020', title: 'Strong consistency', text: 'All S3 reads became strongly consistent at no extra cost.', c: 'g' },
      { yr: 'Jan–Apr 2023', title: 'Secure by default', text: 'SSE-S3 for all new objects; new buckets get Block Public Access and ACLs disabled.' },
      { yr: '2024', title: 'Conditional writes; 10,000-bucket default quota', text: 'If-None-Match / If-Match; up to 1 million buckets on request.' },
      { yr: '2025–2026', title: '50 TB objects; account regional namespaces; SSE-C off by default', text: 'Bigger objects (Dec 2025), reserved bucket names (Mar 2026), SSE-C blocked for new buckets (Apr 2026).', c: 'g' },
    ],
    alts: { cols: ['Storage', 'Model', 'Use when'], rows: [['S3 general purpose', 'objects over HTTPS', 'almost everything: uploads, data lakes, backups, static sites'], ['S3 Express One Zone', 'directory buckets, one AZ', 'very low latency, very high request rates'], ['EFS', 'shared POSIX file system', 'many servers need the same files with renames/appends'], ['EBS', 'block disk for one instance', 'databases and OS disks on EC2'], ['Cloudflare R2 / GCS / Azure Blob', 'S3-like object storage', 'other clouds; R2 has no egress fees']] },
  },
  quiz: [
    { q: 'Max size of a single PutObject request?', o: ['5 MB', '5 GB', '5 TB', '50 TB'], a: 1, why: 'Larger objects need multipart.' },
    { q: 'Max object size today?', o: ['5 GB', '5 TB', '50 TB', 'unlimited'], a: 2, why: 'Raised from 5 TB in December 2025.' },
    { q: 'Console “Create folder” creates…', o: ['a directory', 'a zero-byte object ending in /', 'a new bucket', 'nothing'], a: 1, why: 'Folders are a key-prefix illusion.' },
    { q: 'Two clients PUT the same key at the same time without conditions. Result?', o: ['Error', 'Both kept', 'Last writer wins', 'Merged'], a: 2, why: 'Use If-Match / If-None-Match to avoid lost updates.' },
    { q: 'Request-rate baseline per partitioned prefix?', o: ['100 GET/s', '3,500 writes and 5,500 reads per second', 'unlimited', '1,000 total'], a: 1, why: 'S3 partitions further as load grows.' },
  ],
  cheat: `<h3>Limits</h3><table class="t"><tr><td>Object</td><td>0 B – 50 TB</td></tr><tr><td>Single PUT</td><td>5 GB (multipart ≥ ~100 MB)</td></tr><tr><td>Multipart</td><td>10,000 parts · 5 MiB–5 GiB</td></tr><tr><td>Console upload</td><td>160 GB</td></tr><tr><td>Key / metadata / tags</td><td>1,024 B / 2 KB / 10</td></tr><tr><td>Buckets</td><td>10,000 default (→ 1M)</td></tr><tr><td>Per prefix</td><td>3,500 writes/s · 5,500 reads/s</td></tr></table>
  <h3>CLI</h3><pre>aws s3 cp|mv|rm|ls|sync|mb|rb
aws s3api create-bucket --bucket b --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-object|get-object|head-object|delete-object|copy-object|list-objects-v2</pre>
  <h3>Defaults (new buckets)</h3><ul><li>Block Public Access ON · ACLs disabled · SSE-S3 · SSE-C blocked · versioning off</li><li>Strong consistency · last writer wins · If-None-Match / If-Match for safety</li></ul>`,
};
