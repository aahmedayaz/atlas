import { n, e, f, z } from '../../engine/build.js';

export default {
  id: 's3-code',
  title: 'S3 in code: streaming, multipart, retries, listing and presigned URLs',
  level: 'Intermediate',
  minutes: 45,
  tags: ['AWS', 'S3', 'Node.js', 'TypeScript', 'Performance'],
  summary: 'Production patterns for S3 in TypeScript: stream big downloads and uploads with constant memory, how multipart upload really works, retry modes and backoff, timeouts and connection reuse, listing and crawling buckets with pagination, Inventory and Glue crawlers, presigned URLs for browsers, server-side copies, and the error codes that confuse everyone.',
  learn: ['Streaming GetObject and range requests', '`Upload` from lib-storage and the multipart protocol', 'Retries: standard vs adaptive, backoff, idempotency', 'Timeouts, keep-alive and client reuse', 'Listing millions of keys: paginators, parallel prefixes, Inventory, Metadata, Glue crawlers', 'Presigned GET/PUT URLs for browsers', 'CopyObject vs UploadPartCopy', 'NoSuchKey vs 403, 301 redirects, 412 and 503 SlowDown'],
  steps: [
    {
      short: 'Stream downloads', title: 'Streaming downloads: never load 3 GB into memory', tag: 'code',
      scene: { nodes: [n('s3', 140, 250, 's3://logs/big.gz', { kind: 's3', sub: '3 GB' }), n('node', 480, 250, 'Node process', { kind: 'code', sub: 'Body = Readable stream · ~64 KB chunks' }), n('out', 820, 150, 'file / HTTP response', { kind: 'file' }), n('rng', 820, 360, 'Range: bytes=0-1048575', { kind: 'cli', sub: 'just the first MiB' })],
        edges: [e('s3', 'node', 'GetObject'), e('node', 'out', 'pipeline()'), e('s3', 'rng', 'partial', { style: 'dashed' })],
        flows: [f('s3>node', '', { kind: 's3', every: 0.5 }), f('node>out', '', { kind: 'code', every: 0.5, delay: 0.25 })] },
      body: [
        'In SDK v3 for Node, `GetObject` returns `Body` as a **Readable stream**. Pipe it to a file, an HTTP response or a gunzip/CSV parser and memory stays flat no matter how big the object is. Only call `transformToString()` on small objects.',
        '**Range requests** fetch part of an object: `Range: \'bytes=0-1048575\'`. Use them to read a file header, resume a broken download, or download a huge object in parallel chunks (the way `aws s3 cp` and the CRT client go fast).',
      ],
      code: { file: 'download.ts', lang: 'ts', src: `
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

const s3 = new S3Client({ region: 'eu-west-1' });

const { Body } = await s3.send(new GetObjectCommand({ Bucket: 'logs', Key: 'big.gz' }));
await pipeline(Body as Readable, createGunzip(), createWriteStream('/tmp/big.log'));

// just the first 1 MiB
const head = await s3.send(new GetObjectCommand({ Bucket: 'logs', Key: 'big.gz',
  Range: 'bytes=0-1048575' }));            // 206 Partial Content`, hl: [9, 10, 14] },
    },
    {
      short: 'Stream uploads', title: 'Streaming uploads with `Upload` (lib-storage)', tag: 'code',
      scene: { nodes: [n('src', 130, 250, 'Readable stream', { kind: 'code', sub: 'unknown length' }), n('up', 430, 250, 'Upload (lib-storage)', { kind: 'layers', sub: 'partSize 8 MiB · queueSize 4' }), n('p1', 760, 110, 'part 1', { kind: 'obj' }), n('p2', 760, 250, 'part 2', { kind: 'obj' }), n('p3', 760, 390, 'part 3 …', { kind: 'obj' }), n('done', 1010, 250, 'one object', { kind: 's3', state: 'ok' })],
        edges: [e('src', 'up'), e('up', 'p1'), e('up', 'p2'), e('up', 'p3'), e('p2', 'done', 'Complete')],
        flows: [f('src>up', '', { kind: 'code', every: 0.6 }), f('up>p1', '', { kind: 'layers', every: 1.2 }), f('up>p2', '', { kind: 'layers', every: 1.2, delay: 0.3 }), f('up>p3', '', { kind: 'layers', every: 1.2, delay: 0.6 })] },
      body: [
        '`PutObject` needs the whole body and its length up front and stops at 5 GB. `Upload` from `@aws-sdk/lib-storage` accepts a stream of unknown length, cuts it into parts, uploads several in parallel (`queueSize`), retries failed parts, reports progress, and falls back to a single PUT for small bodies.',
        'If it fails or you call `abort()`, it aborts the multipart upload so you don’t pay for orphaned parts.',
      ],
      code: { file: 'upload.ts', lang: 'ts', src: `
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'node:fs';

const upload = new Upload({
  client: s3,
  params: { Bucket: 'acme-uploads', Key: 'videos/talk.mp4',
            Body: createReadStream('./talk.mp4'), ContentType: 'video/mp4' },
  partSize: 8 * 1024 * 1024,     // ≥ 5 MiB; bigger parts = fewer requests
  queueSize: 4,                  // parts in flight at once
  leavePartsOnError: false,      // abort on failure
});
upload.on('httpUploadProgress', (p) => console.log(p.loaded, '/', p.total));
await upload.done();`, hl: [4, 8, 9, 12] },
    },
    {
      short: 'Multipart protocol', title: 'Multipart upload, under the hood', tag: 'internals',
      scene: { nodes: [n('c', 120, 250, 'Client', { kind: 'code' }), n('s1', 440, 90, '1 · CreateMultipartUpload', { kind: 's3', sub: '→ UploadId' }), n('s2', 440, 250, '2 · UploadPart × N (parallel)', { kind: 's3', sub: '→ ETag per part' }), n('s3', 440, 410, '3 · CompleteMultipartUpload', { kind: 's3', sub: '[{PartNumber, ETag}…]' }), n('obj', 820, 250, 'Object appears', { kind: 'obj', sub: 'atomically', state: 'ok' })],
        edges: [e('c', 's1'), e('c', 's2'), e('c', 's3'), e('s3', 'obj')], flows: [f('c>s1', '', { kind: 'code', every: 3.5 }), f('c>s2', 'parts', { kind: 'code', every: 3.5, delay: 0.8 }), f('c>s3', '', { kind: 'code', every: 3.5, delay: 1.8 })] },
      body: [
        '<ol><li>`CreateMultipartUpload` → an `UploadId`.</li><li>`UploadPart` for each part number 1–10,000 (5 MiB–5 GiB each, last one can be smaller), in any order, in parallel; each returns an ETag. Retry only the part that failed.</li><li>`CompleteMultipartUpload` with the list of part numbers + ETags. Only now does the object appear — all at once.</li></ol>',
        'Uploaded parts of an unfinished upload are **stored and billed but invisible** in normal listings. Always add a lifecycle rule **AbortIncompleteMultipartUpload after N days**, and list stragglers with `aws s3api list-multipart-uploads`.',
        'Integrity: modern SDKs and the CLI send a CRC checksum with uploads by default, and S3 verifies it. A multipart object’s ETag is not an MD5 of the file (it is a hash of part hashes plus `-N`).',
      ],
    },
    {
      short: 'Retries', title: 'Retries: what fails, and how the SDK retries', tag: 'internals',
      scene: { nodes: [n('c', 130, 250, 'SDK', { kind: 'code', sub: 'retryMode: standard' }), n('s3', 760, 250, 'S3', { kind: 's3', sub: '503 SlowDown / 500 / reset' }), n('w', 440, 110, 'wait 0.1 s · 0.2 s · 0.4 s…', { kind: 'clock', sub: 'exponential + jitter' }), n('q', 440, 390, 'retry quota', { kind: 'queue', sub: 'stops retry storms' })],
        edges: [e('c', 's3', 'attempt'), e('s3', 'w', 'transient error', { style: 'dashed' }), e('w', 'c', 'retry'), e('q', 'c', '', { style: 'dashed' })],
        flows: [f('c>s3', 'PUT', { kind: 'code', every: 2.2 }), f('c>s3', '', { kind: 'code', every: 2.2, delay: 1.1, fail: true })] },
      body: [
        'Transient failures are normal at scale: `500 InternalError`, `503 SlowDown` (S3 is scaling a prefix), throttling, timeouts and connection resets. The SDK retries them automatically with [[exp-backoff|exponential backoff and jitter]]; it does **not** retry 4xx errors like 403 or 404.',
        'SDK v3 retry modes: **standard** (default — 3 attempts total, backoff with jitter, plus a client-side *retry quota* so a failing service isn’t flooded) and **adaptive** (standard + client-side rate limiting when throttled — good for bulk jobs hitting one prefix). Raise `maxAttempts` for batch workers. The CLI reads `AWS_RETRY_MODE` / `AWS_MAX_ATTEMPTS` or `retry_mode` / `max_attempts` in the profile.',
        'Retries are safe because PUT and DELETE of the same key are [[idempotent]]. Your own non-idempotent side effects (charging a card after an upload) are not — guard those.',
      ],
      code: { file: 'client.ts', lang: 'ts', src: `
import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'node:https';

export const s3 = new S3Client({          // create ONCE, reuse everywhere
  region: 'eu-west-1',
  retryMode: 'adaptive',                  // or 'standard' (default)
  maxAttempts: 6,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 3_000,             // ms to open a socket
    requestTimeout: 60_000,               // ms of socket inactivity
    httpsAgent: new Agent({ keepAlive: true, maxSockets: 200 }),
  }),
});`, hl: [6, 8, 9, 13] },
    },
    {
      short: 'Listing', title: 'Listing a bucket: pagination and parallel prefixes', tag: 'code',
      scene: { nodes: [n('c', 130, 250, 'paginateListObjectsV2', { kind: 'code' }), n('p1', 470, 110, 'page 1 (1,000 keys)', { kind: 'file', sub: 'NextContinuationToken' }), n('p2', 470, 250, 'page 2 (1,000 keys)', { kind: 'file' }), n('p3', 470, 390, 'page N', { kind: 'file', sub: 'IsTruncated: false' }), n('par', 830, 250, 'Parallel by prefix', { kind: 'layers', sub: 'a/, b/, c/ … at once' })],
        edges: [e('c', 'p1'), e('p1', 'p2', 'token'), e('p2', 'p3', 'token'), e('c', 'par', '', { style: 'dashed' })],
        flows: [f('c>p1', '', { kind: 'code', every: 3 }), f('p1>p2', '', { kind: 'file', every: 3, delay: 0.8 }), f('p2>p3', '', { kind: 'file', every: 3, delay: 1.6 })] },
      body: [
        '`ListObjectsV2` returns at most **1,000 keys per call**, in UTF-8 binary order, plus `NextContinuationToken` when there are more. Use the SDK **paginator** so you never forget the loop. `StartAfter` begins after a given key; `Prefix` + `Delimiter` lets you walk one “folder” level at a time.',
        'Listing 100 million keys page by page takes 100,000 sequential requests. Split the key space into prefixes and list them **in parallel** — another reason to design keys with a predictable prefix (dates, tenant IDs, hash shards). LIST requests are billed at the higher PUT/COPY/POST/LIST rate.',
      ],
      code: { file: 'list.ts', lang: 'ts', src: `
import { paginateListObjectsV2, ListObjectsV2Command } from '@aws-sdk/client-s3';

let count = 0, bytes = 0;
for await (const page of paginateListObjectsV2({ client: s3, pageSize: 1000 },
                                               { Bucket: 'logs', Prefix: '2026/11/' })) {
  for (const o of page.Contents ?? []) { count++; bytes += o.Size ?? 0; }
}

// one "folder" level only
const top = await s3.send(new ListObjectsV2Command({ Bucket: 'logs', Delimiter: '/' }));
console.log(top.CommonPrefixes?.map((p) => p.Prefix));   // ['2025/', '2026/']

// crawl prefixes in parallel
const shards = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
await Promise.all(shards.map((p) => listAll('uploads', \`\${p}/\`)));`, hl: [4, 10, 15] },
    },
    {
      short: 'Crawling at scale', title: 'Crawling billions of objects: Inventory, Metadata and Glue', tag: 'concept',
      scene: { nodes: [n('b', 140, 250, 'Huge bucket', { kind: 's3', sub: '2 billion objects' }), n('inv', 500, 110, 'S3 Inventory', { kind: 'file', sub: 'daily/weekly CSV · ORC · Parquet' }), n('meta', 500, 250, 'S3 Metadata', { kind: 'layers', sub: 'live Iceberg tables' }), n('glue', 500, 390, 'Glue crawler', { kind: 'search', sub: 'infers schema → Data Catalog' }), n('ath', 860, 250, 'Athena SQL', { kind: 'db', sub: 'query, filter, feed Batch Ops' })],
        edges: [e('b', 'inv', 'scheduled report'), e('b', 'meta', 'continuous'), e('b', 'glue', 'scan data files'), e('inv', 'ath'), e('meta', 'ath'), e('glue', 'ath')] },
      body: [
        'For very large buckets, don’t LIST — let S3 report:',
        '<ul><li><b>S3 Inventory</b>: a **scheduled** (daily or weekly) list of every object with size, storage class, encryption, replication status, etc., delivered to another bucket as CSV, ORC or Parquet. Cheap, perfect input for Batch Operations and audits.</li><li><b>S3 Metadata</b>: **continuously** updated metadata tables (Apache Iceberg) you can query with Athena — near-real-time “what changed”.</li><li><b>AWS Glue crawler</b>: a different kind of crawling — it reads your *data files* (CSV, JSON, Parquet) under a prefix, infers a table schema and partitions, and registers it in the Glue Data Catalog, so Athena/Redshift can query the data with SQL. It can run on a schedule.</li></ul>',
      ],
    },
    {
      short: 'Presigned URLs', title: 'Presigned URLs: let a browser upload or download directly', tag: 'code',
      scene: { nodes: [n('br', 120, 250, 'Browser', { kind: 'browser' }), n('api', 450, 110, 'Your API (Lambda)', { kind: 'lambda', sub: 'checks user, signs URL' }), n('s3', 800, 250, 'S3', { kind: 's3', sub: 'verifies signature + expiry' })],
        edges: [e('br', 'api', '1 ask for URL'), e('api', 'br', '2 URL (5 min)', { style: 'dashed' }), e('br', 's3', '3 PUT file directly')],
        flows: [f('br>api', '', { kind: 'browser', every: 3.2 }), f('br>s3', '25 MB', { kind: 'browser', every: 3.2, delay: 1.4 })] },
      body: [
        'A [[presigned-url|presigned URL]] is a normal S3 URL plus query parameters containing a SigV4 signature made with *your* credentials. Whoever holds it can perform exactly that one operation (GET or PUT of that key) until it expires — no AWS credentials in the browser, and big files never pass through your server.',
        'Expiry: up to **7 days** with SigV4, but never longer than the credentials that signed it (a URL signed by a Lambda role expires when that session does). For uploads, a **presigned POST** can also enforce content-type and a maximum size with policy conditions.',
      ],
      code: { file: 'presign.ts', lang: 'ts', src: `
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const putUrl = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: 'acme-uploads', Key: \`users/\${userId}/avatar.png\`, ContentType: 'image/png',
}), { expiresIn: 300 });                         // seconds

const getUrl = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: 'acme-uploads', Key: 'invoices/inv-42.pdf',
  ResponseContentDisposition: 'attachment; filename="invoice.pdf"',
}), { expiresIn: 600 });

const post = await createPresignedPost(s3, { Bucket: 'acme-uploads', Key: 'in/\${filename}',
  Conditions: [['content-length-range', 0, 10_000_000]], Expires: 300 });`, hl: [6, 8, 15] },
    },
    {
      short: 'Copies', title: 'Server-side copies: CopyObject and UploadPartCopy', tag: 'code',
      scene: { nodes: [n('c', 130, 250, 'Your code', { kind: 'code', sub: 'no bytes download' }), n('a', 480, 150, 'bucket A / key', { kind: 's3' }), n('b', 820, 150, 'bucket B / key', { kind: 's3', sub: 'can be another region' }), n('big', 650, 380, '> 5 GB: UploadPartCopy', { kind: 'layers', sub: 'multipart, byte ranges' })],
        edges: [e('c', 'a', 'CopyObject'), e('a', 'b', 'S3 copies internally'), e('a', 'big', '', { style: 'dashed' })], flows: [f('a>b', '', { kind: 's3', every: 2.4 })] },
      body: [
        '`CopyObject` copies inside S3 — your machine never downloads the data. It works up to **5 GB**; above that, use multipart with `UploadPartCopy` (each part copies a byte range of the source). `aws s3 cp s3://a/x s3://b/x` and lib-storage handle this for you.',
        'Copying an object onto itself with `MetadataDirective: REPLACE` is how you change metadata, content-type or encryption of existing objects. For millions of objects, use **Batch Operations** (S3 lesson 4).',
      ],
    },
    {
      short: 'Error codes', title: 'Error codes that confuse everyone', tag: 'scenario',
      scene: { nodes: [n('a', 180, 90, '403 instead of 404', { kind: 'note', icon: false, state: 'bad' }), n('b', 180, 210, '301 PermanentRedirect', { kind: 'note', icon: false }), n('c', 180, 330, '412 PreconditionFailed', { kind: 'note', icon: false }), n('d', 180, 450, '503 SlowDown', { kind: 'note', icon: false }), n('s3', 700, 270, 'S3', { kind: 's3' })],
        edges: [e('a', 's3', '', { style: 'dashed' }), e('b', 's3', '', { style: 'dashed' }), e('c', 's3', '', { style: 'dashed' }), e('d', 's3', '', { style: 'dashed' })], h: 520 },
      body: [
        '<ul><li><b>403 AccessDenied for a missing key</b> — if you lack `s3:ListBucket` on the bucket, S3 returns 403 instead of 404 for keys that don’t exist, so it doesn’t leak which keys exist. Grant ListBucket to get a proper `404 NoSuchKey`.</li><li><b>301 PermanentRedirect / AuthorizationHeaderMalformed</b> — the client’s region differs from the bucket’s region. Fix the client region.</li><li><b>412 PreconditionFailed</b> — your `If-Match` / `If-None-Match` condition failed: someone else wrote first. Re-read and retry.</li><li><b>503 SlowDown</b> — request rate on a prefix is climbing faster than S3 has scaled. Backoff (SDK does) and spread keys across prefixes.</li><li><b>400 EntityTooLarge</b> — single PUT over 5 GB; use multipart.</li></ul>',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'How do you download a 10 GB object in Node without running out of memory?', a: ['Stream it: GetObject returns Body as a Readable; pipe it with stream.pipeline to a file or response. For speed, download byte ranges in parallel.'] },
    { lvl: 'M', q: 'Walk through a multipart upload.', a: ['CreateMultipartUpload returns an UploadId; UploadPart for each part (5 MiB–5 GiB, up to 10,000, parallel, each returns an ETag); CompleteMultipartUpload with the part list makes the object visible atomically. AbortMultipartUpload cleans up; a lifecycle rule should abort incomplete uploads.'] },
    { lvl: 'M', q: 'Why might GetObject return 403 for an object that does not exist?', a: ['Without s3:ListBucket permission, S3 hides existence and returns AccessDenied for missing keys instead of NoSuchKey.'] },
    { lvl: 'M', q: 'How do browsers upload directly to a private bucket?', a: ['The backend authenticates the user and returns a short-lived presigned PUT URL or presigned POST (with size/type conditions). The browser sends the file straight to S3; the backend never handles the bytes or exposes credentials.'] },
    { lvl: 'S', q: 'You must re-encrypt and tag 800 million existing objects. How?', a: ['Use S3 Inventory (or S3 Metadata + Athena) to build a manifest, then S3 Batch Operations with a Copy operation (changing encryption) and a Put Object Tagging job, with completion reports. Avoid custom LIST-and-copy scripts: Batch Ops handles retries, scale and auditing.'], why: 'Tests knowing the managed bulk tools instead of hand-rolled crawlers.' },
  ],
  history: {
    timeline: [
      { yr: '2010', title: 'Multipart upload', text: 'Parallel, resumable uploads; objects up to 5 TB.' },
      { yr: '2016–2020', title: 'S3 Inventory and Batch Operations', text: 'Scheduled object listings (2016) and managed bulk jobs (2019).' },
      { yr: '2020', title: 'AWS SDK for JavaScript v3', text: 'Modular clients, middleware stack, streaming bodies, lib-storage Upload.', c: 'g' },
      { yr: '2024', title: 'Conditional writes', text: 'If-None-Match and If-Match on PutObject/CompleteMultipartUpload.' },
      { yr: 'Dec 2024–2025', title: 'Default checksums; S3 Metadata; 50 TB objects', text: 'SDKs add integrity checksums by default; live metadata tables; bigger objects.', c: 'g' },
    ],
    alts: { cols: ['Need', 'Use', 'Avoid'], rows: [['Big upload', 'lib-storage Upload / aws s3 cp', 'single PutObject over 5 GB'], ['Big download', 'stream + parallel ranges', 'transformToString on GBs'], ['List a few thousand keys', 'paginator', 'unpaginated loops'], ['Inventory of billions', 'S3 Inventory / S3 Metadata', 'LIST crawls'], ['Schema for SQL', 'Glue crawler + Athena', 'hand-written DDL for every file'], ['Browser upload', 'presigned PUT/POST', 'proxying files through your API']] },
  },
  quiz: [
    { q: 'Max keys returned by one ListObjectsV2 call?', o: ['100', '1,000', '10,000', 'unlimited'], a: 1, why: 'Paginate with ContinuationToken.' },
    { q: 'Default SDK v3 retry mode?', o: ['legacy', 'standard', 'adaptive', 'none'], a: 1, why: 'Standard: 3 attempts with backoff and jitter.' },
    { q: 'CopyObject single-call limit?', o: ['5 MB', '5 GB', '50 TB', 'none'], a: 1, why: 'Use UploadPartCopy above 5 GB.' },
    { q: 'Which gives a scheduled CSV/Parquet list of every object?', o: ['S3 Inventory', 'CloudTrail', 'Glue crawler', 'ListObjectsV2'], a: 0, why: 'Daily or weekly reports.' },
    { q: 'A presigned URL signed by a Lambda role with 1 h left, expiresIn 7 days. It works for…', o: ['7 days', 'about 1 hour', 'forever', '15 minutes'], a: 1, why: 'Never longer than the signing credentials.' },
  ],
  cheat: `<h3>Patterns (SDK v3)</h3><pre>GetObject → Body (Readable) → pipeline(...)         Range: 'bytes=0-1048575'
new Upload({ client, params, partSize, queueSize }).done()
paginateListObjectsV2({ client }, { Bucket, Prefix })
getSignedUrl(s3, new PutObjectCommand(...), { expiresIn })
new S3Client({ retryMode: 'adaptive', maxAttempts: 6, requestHandler })</pre>
  <h3>Multipart</h3><ul><li>Create → UploadPart ×≤10,000 (5 MiB–5 GiB) → Complete · Abort</li><li>Lifecycle: AbortIncompleteMultipartUpload</li></ul>
  <h3>Errors</h3><table class="t"><tr><td>403 on missing key</td><td>no s3:ListBucket</td></tr><tr><td>301 / malformed auth</td><td>wrong region</td></tr><tr><td>412</td><td>condition failed</td></tr><tr><td>503 SlowDown</td><td>backoff + more prefixes</td></tr><tr><td>EntityTooLarge</td><td>&gt; 5 GB single PUT</td></tr></table>
  <h3>At scale</h3><p>S3 Inventory · S3 Metadata · Glue crawler → Athena · Batch Operations</p>`,
};
