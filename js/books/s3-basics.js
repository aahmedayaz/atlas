export default {
  title: 'Amazon S3 from zero: buckets, objects and keys',
  intro: 'S3 stores more data than almost anything on Earth, yet its model is simple: put bytes under a name, get them back by name. This book builds that model step by step — buckets, keys, “folders”, limits, everyday operations and the rules that surprise people.',
  chapters: [
    {
      level: 1, title: 'Files vs objects',
      text: [
        'Your laptop stores **files** in **folders** on a **file system**: you can rename, append, edit in place. **Object storage** is different: you store whole **objects** under a name and replace them whole; there are no real folders and no editing in the middle.',
        'In exchange, object storage scales almost infinitely, is reachable from anywhere over HTTPS, and is extremely durable.',
      ],
      words: [
        ['File system', 'How an operating system organises files in folders on a disk.'],
        ['Object storage', 'Storage where each item is a whole object fetched by name over an API.'],
        ['Durability', 'How unlikely it is that stored data is ever lost.'],
      ],
      example: 'A coat check: you hand over the whole coat and get a ticket; you can’t sew a new button on while it’s on the rack.',
      remember: 'Objects are replaced, not edited.',
      check: ['Can you append a line to an existing S3 object in a general purpose bucket?', 'No — you upload a new version of the whole object.'],
    },
    {
      level: 1, title: 'Buckets',
      text: [
        'A **bucket** is a container for objects, created in one **region**. By default its name must be **globally unique** among all AWS customers, 3–63 characters, lowercase letters, numbers and hyphens. Since 2026 you can also create buckets in your own **account regional namespace**, so predictable names can’t be taken by others.',
        'New buckets are private and encrypted by default. An account can have 10,000 buckets by default (more on request).',
      ],
      words: [
        ['Bucket', 'A named container for objects in one region.'],
        ['Globally unique', 'No other bucket anywhere may have the same name.'],
        ['Namespace', 'A space of names where each must be unique.'],
      ],
      example: 'A numbered warehouse in one city; the number on the gate can’t be used by any other warehouse in the world.',
      remember: 'Bucket = region + unique name + secure defaults.',
      check: ['Can two customers each have a bucket called `photos`?', 'Not in the shared global namespace; only one can own that name.'],
    },
    {
      level: 1, title: 'Objects and keys',
      text: [
        'An **object** is the data (0 bytes to 50 TB) plus information about it. Its name is the **key**, e.g. `invoices/2026/11/inv-42.pdf` — up to 1,024 bytes. **Metadata** describes it (`Content-Type`, your own `x-amz-meta-*` values); **tags** are editable labels (up to 10); the **ETag** is a fingerprint of the content; a **version ID** exists when versioning is on.',
      ],
      words: [
        ['Key', 'The full name of an object inside a bucket.'],
        ['Metadata', 'Information about an object, stored with it.'],
        ['Tag', 'A key/value label you can change later.'],
        ['ETag', 'An identifier of the object’s content.'],
      ],
      example: 'A parcel: address label (key), contents (data), packing slip (metadata), coloured stickers (tags).',
      remember: 'Key + data + metadata (+ tags, ETag, version).',
      check: ['Can you change user metadata without re-uploading?', 'Only by copying the object onto itself with new metadata; tags can be changed directly.'],
    },
    {
      level: 2, title: 'The folder illusion and prefixes',
      text: [
        'The console shows folders, but S3 has none. Keys simply contain slashes. A **prefix** is the start of a key (`invoices/2026/`). When you list with a **delimiter** `/`, S3 groups keys into “common prefixes”, which the console draws as folders. *Create folder* just writes an empty object ending in `/`.',
        'Prefixes matter for speed too: S3 handles at least 3,500 writes and 5,500 reads per second **per prefix**, and splits busy prefixes automatically.',
      ],
      words: [
        ['Prefix', 'The beginning of a key, used like a folder path.'],
        ['Delimiter', 'A character (usually `/`) used to group keys when listing.'],
        ['Partition', 'An internal slice of S3’s index that serves a range of keys.'],
      ],
      example: 'Labels on boxes that start with “Kitchen/…” — the boxes aren’t in a separate room, they just share a label start.',
      remember: 'Folders are prefixes; design them for listing and load.',
      check: ['What does “rename a folder” mean in S3?', 'Copy every object to new keys and delete the old ones.'],
    },
    {
      level: 2, title: 'Size limits',
      text: [
        'Objects: up to **50 TB** (since December 2025). A single upload request (PUT): up to **5 GB**. Bigger objects use **multipart upload**: up to 10,000 parts of 5 MiB–5 GiB each, uploaded in parallel. AWS suggests multipart from about 100 MB.',
        'Other limits: console uploads up to 160 GB; user metadata 2 KB; 10 tags; delete up to 1,000 keys in one request; listings return 1,000 keys per page.',
      ],
      words: [
        ['Multipart upload', 'Uploading one object in many parts, then joining them.'],
        ['MiB / GiB', 'Binary megabyte/gigabyte (1,048,576 / 1,073,741,824 bytes).'],
      ],
      example: 'Posting a sofa: it travels in numbered flat-pack boxes and is assembled at the destination.',
      remember: '5 GB per PUT, 50 TB per object.',
      check: ['How do you upload a 20 GB file?', 'With multipart upload (the CLI `aws s3 cp` and SDK `Upload` do it automatically).'],
    },
    {
      level: 2, title: 'Everyday operations',
      text: [
        'Create/update = **PutObject** (same key overwrites). Read = **GetObject** (or **HeadObject** for metadata only). Delete = **DeleteObject** / **DeleteObjects**. Copy/move = **CopyObject** (+ delete).',
        'You can do these in the console, with the CLI (`aws s3 cp`, `aws s3 rm`, `aws s3 sync`, or `aws s3api …`), with the SDK in code, and you create buckets themselves with CDK.',
      ],
      words: [
        ['PutObject / GetObject', 'The upload and download API actions.'],
        ['HeadObject', 'Get an object’s metadata without its data.'],
        ['sync', 'CLI command that copies only new or changed files.'],
      ],
      example: 'Put = drop a parcel, Get = pick it up, Head = read the label without opening, Delete = throw it away.',
      remember: 'Same key + PUT = overwrite.',
      check: ['Which CLI command copies only changed files to a bucket?', '`aws s3 sync`.'],
    },
    {
      level: 3, title: 'Consistency and lost updates',
      text: [
        'S3 is **strongly consistent**: after a successful write or delete, every read and list sees it. But if two clients write the same key at the same time, the **last writer wins** and the other change is lost.',
        '**Conditional writes** fix that: `If-None-Match: *` writes only if the key doesn’t exist yet; `If-Match: <etag>` writes only if nobody changed the object since you read it. Otherwise S3 answers `412 Precondition Failed` and you retry.',
      ],
      words: [
        ['Strong consistency', 'Reads always reflect the latest successful write.'],
        ['Last writer wins', 'With simultaneous writes, the final one replaces the others.'],
        ['Conditional write', 'A write that happens only if a condition about the current object holds.'],
      ],
      example: 'Two people editing the same printed form: whoever hands it in last wins — unless the clerk checks the form version first.',
      remember: 'Use If-Match / If-None-Match for shared files.',
      check: ['What status code means your If-Match failed?', '412 Precondition Failed.'],
    },
    {
      level: 3, title: 'Storage classes and cost',
      text: [
        'You pay for stored GB per month, for requests, and for data leaving AWS. **Storage classes** trade price for access speed: Standard (hot), Intelligent-Tiering (moves data automatically), Standard-IA and One Zone-IA (infrequent), Glacier Instant Retrieval, Glacier Flexible Retrieval and Deep Archive (archives, hours to restore).',
        'Colder classes add retrieval fees, minimum storage durations and minimum billable sizes. Lifecycle rules move data between classes automatically.',
      ],
      words: [
        ['Storage class', 'A pricing/performance tier for objects.'],
        ['Egress', 'Data transferred out of AWS — usually charged.'],
        ['Retrieval fee', 'Extra charge to read data from cold classes.'],
      ],
      example: 'Front shelf, back room, basement archive: the further away, the cheaper to store and the slower to fetch.',
      remember: 'Unknown access pattern → Intelligent-Tiering.',
      check: ['Which class for compliance archives read once a year?', 'Glacier Deep Archive.'],
    },
  ],
};
