export default {
  title: 'Working with S3 in code',
  intro: 'Once you move beyond a few files, how you talk to S3 matters: big files must be streamed, uploads split into parts, failures retried, millions of keys listed efficiently and browsers given safe upload links. This book explains each pattern from first principles.',
  chapters: [
    {
      level: 1, title: 'The SDK and the client',
      text: [
        'An **SDK** is a library that makes AWS API calls for you. In JavaScript/TypeScript you install `@aws-sdk/client-s3`, create one **S3Client** for a region, and `send()` command objects like `PutObjectCommand`.',
        'Create the client **once** and reuse it — it keeps network connections open, which makes every call faster. Credentials are found automatically through the provider chain.',
      ],
      words: [
        ['SDK', 'Software Development Kit — a library for calling a service from code.'],
        ['Client', 'The object that sends requests and holds settings and connections.'],
        ['Command', 'An object describing one API call and its parameters.'],
      ],
      example: 'Keeping a phone line open to the warehouse instead of redialling for every question.',
      remember: 'One client, many sends.',
      check: ['Why not create a new S3Client for every request?', 'You lose connection reuse and add latency and overhead.'],
    },
    {
      level: 1, title: 'Streams: handling data piece by piece',
      text: [
        'A **stream** delivers data in small chunks over time instead of all at once. `GetObject` gives you the body as a stream, so you can pipe a 3 GB file into a file or parser using only a little memory.',
        'Reading the whole body into a string (`transformToString`) is fine for small JSON, dangerous for large files.',
      ],
      words: [
        ['Stream', 'Data that flows in chunks, processed as it arrives.'],
        ['Pipe / pipeline', 'Connecting a stream’s output to another stream’s input.'],
        ['Memory', 'The working space (RAM) a program uses.'],
      ],
      example: 'Drinking from a tap instead of trying to carry the entire water tank.',
      remember: 'Big objects: stream. Small objects: read fully.',
      check: ['A 512 MB Lambda reads a 1 GB file with transformToString. What happens?', 'It runs out of memory; streaming would work.'],
    },
    {
      level: 1, title: 'Range requests',
      text: [
        'You can ask for just part of an object with a **Range** header, e.g. bytes 0 to 1,048,575 (the first MiB). S3 answers with status 206 (Partial Content).',
        'Uses: read a file header, resume a broken download, or download a huge object faster by fetching several ranges in parallel.',
      ],
      words: [
        ['Byte range', 'A start and end position inside the data.'],
        ['206 Partial Content', 'HTTP status for a successful partial response.'],
      ],
      example: 'Reading only chapter three of a book instead of the whole thing.',
      remember: 'Range = partial, resumable, parallel downloads.',
      check: ['How do download tools go faster on huge objects?', 'They fetch multiple byte ranges in parallel.'],
    },
    {
      level: 2, title: 'Multipart upload, step by step',
      text: [
        '1) **CreateMultipartUpload** returns an UploadId. 2) **UploadPart** sends parts (5 MiB–5 GiB, up to 10,000) — in any order, in parallel — each returning an ETag. 3) **CompleteMultipartUpload** lists the parts; the object appears all at once.',
        'If you never complete or abort, the parts stay stored and **billed** but invisible. Add a lifecycle rule to abort incomplete uploads after a few days. The `Upload` helper from `@aws-sdk/lib-storage` does all of this for you.',
      ],
      words: [
        ['UploadId', 'The identifier of one multipart upload session.'],
        ['Part', 'One numbered piece of a multipart upload.'],
        ['Abort', 'Cancel a multipart upload and delete its parts.'],
      ],
      example: 'Shipping a wardrobe in numbered boxes; if box 7 is lost, only box 7 is re-sent; assembly happens when all boxes arrive.',
      remember: 'Create → parts → complete (or abort).',
      check: ['Why can an “empty” bucket still cost money?', 'Unfinished multipart uploads (or old versions) are stored and billed.'],
    },
    {
      level: 2, title: 'Retries and backoff',
      text: [
        'At scale some requests fail temporarily: server errors (500), **503 SlowDown** while S3 scales a busy prefix, timeouts, reset connections. The SDK retries these automatically using **exponential backoff with jitter** — waiting a little longer, plus a random amount, after each failure.',
        'Retry modes: **standard** (default) and **adaptive** (also slows itself when throttled). Retries are safe because writing or deleting the same key again gives the same result — the operations are **idempotent**.',
      ],
      words: [
        ['Exponential backoff', 'Waiting longer after each failure (e.g. 0.1 s, 0.2 s, 0.4 s…).'],
        ['Jitter', 'Random variation added so many clients don’t retry at the same moment.'],
        ['Throttling', 'A service deliberately slowing or rejecting requests when overloaded.'],
        ['Idempotent', 'Safe to repeat with the same result.'],
      ],
      example: 'Knocking again on a busy door, waiting a bit longer each time instead of hammering continuously.',
      remember: 'Never retry in a tight loop.',
      check: ['Does the SDK retry a 403 AccessDenied?', 'No — permission errors won’t fix themselves; only transient errors are retried.'],
    },
    {
      level: 2, title: 'Listing many objects',
      text: [
        'ListObjectsV2 returns up to **1,000 keys per page** with a token for the next page. Use the SDK’s **paginator** to loop through all pages. Use `Prefix` to list one part of the bucket and `Delimiter` to walk one “folder” level at a time.',
        'For millions of keys, list several prefixes **in parallel**. For billions, don’t list at all — use **S3 Inventory** (scheduled reports) or **S3 Metadata** (live tables you query with SQL).',
      ],
      words: [
        ['Paginator', 'A helper that fetches every page of a list for you.'],
        ['Continuation token', 'A marker telling S3 where the next page starts.'],
        ['S3 Inventory', 'Daily or weekly reports listing every object and its properties.'],
      ],
      example: 'Reading a phone book page by page versus asking the phone company for the full list as a spreadsheet.',
      remember: 'Small: paginate. Large: parallel prefixes. Huge: Inventory.',
      check: ['How many keys can one ListObjectsV2 call return?', 'Up to 1,000.'],
    },
    {
      level: 2, title: '“Crawling” data with Glue',
      text: [
        'An **AWS Glue crawler** looks at data files under a prefix (CSV, JSON, Parquet), works out their columns and partitions, and creates a table in the **Glue Data Catalog**. Then **Athena** can run SQL on your files directly. Crawlers can run on a schedule to pick up new partitions.',
      ],
      words: [
        ['Glue crawler', 'A job that scans data files and records their structure as tables.'],
        ['Data Catalog', 'A central list of table definitions for data stored in S3.'],
        ['Athena', 'A service that runs SQL queries directly on files in S3.'],
      ],
      example: 'A librarian who reads the spines of new books every night and updates the catalogue so visitors can search.',
      remember: 'Crawler → table → SQL with Athena.',
      check: ['Does a Glue crawler copy your data?', 'No, it only records the schema/location; data stays in S3.'],
    },
    {
      level: 3, title: 'Presigned URLs',
      text: [
        'A **presigned URL** is an S3 link with a signature attached, made with your credentials. Anyone holding it can do exactly that one action (download or upload that key) until it expires — without AWS credentials.',
        'Typical flow: the browser asks your API; the API checks the user and returns a short-lived upload URL; the browser uploads straight to S3. A URL can’t outlive the credentials that signed it, and lasts at most 7 days.',
      ],
      words: [
        ['Presigned URL', 'A time-limited signed link for one S3 operation.'],
        ['Expiry', 'When the URL stops working.'],
      ],
      example: 'A signed delivery slip that lets a courier drop off one parcel at your warehouse before 5 p.m.',
      remember: 'Sign on the server, upload from the browser.',
      check: ['Why does a presigned URL from a Lambda stop working early?', 'It can’t outlive the Lambda role’s temporary credentials that signed it.'],
    },
    {
      level: 3, title: 'Reading error codes correctly',
      text: [
        '**403 for a missing key**: without `s3:ListBucket`, S3 won’t reveal whether a key exists. **301 / malformed authorization**: your client is talking to the wrong region. **412**: a conditional write failed. **503 SlowDown**: slow down and spread keys across prefixes. **EntityTooLarge**: a single PUT over 5 GB.',
      ],
      words: [
        ['Status code', 'A three-digit number summarising an HTTP response.'],
        ['NoSuchKey', 'The 404 error for a key that doesn’t exist (when you may list).'],
      ],
      example: 'A receptionist who won’t say whether a person works there unless you’re on the staff list.',
      remember: '403 isn’t always “forbidden file” — check ListBucket.',
      check: ['How do you get proper 404s for missing keys?', 'Grant s3:ListBucket on the bucket.'],
    },
  ],
};
