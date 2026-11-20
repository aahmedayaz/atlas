export default {
  title: 'Keeping S3 data private and encrypted',
  intro: 'Most famous cloud data leaks were S3 buckets left open. This book explains every lock on an S3 bucket — who can reach it, how public access is blocked, and how encryption with keys works, including why S3 Bucket Keys save money.',
  chapters: [
    {
      level: 1, title: 'Private by default',
      text: [
        'A new bucket is **private**: only your account’s identities with the right IAM permissions can use it. It is also **encrypted** at rest automatically and has **public access blocked**.',
        'Data becomes reachable by others only if someone deliberately adds a permission — so security is mostly about controlling who can add permissions and checking what exists.',
      ],
      words: [
        ['Private', 'Accessible only to identities explicitly allowed.'],
        ['At rest', 'While stored on disk (vs. “in transit” over the network).'],
      ],
      example: 'A new safe deposit box: locked, and only the owner holds a key until they hand out more.',
      remember: 'Leaks happen by adding permissions, not by default.',
      check: ['Is a brand-new bucket readable by the internet?', 'No — private, with Block Public Access on.'],
    },
    {
      level: 1, title: 'Bucket policies',
      text: [
        'A **bucket policy** is a resource-based policy on the bucket. It names **principals** (who), actions and conditions. Common uses: allow CloudFront to read a website bucket, allow another account to read a folder, deny anything not over HTTPS, allow only traffic from your private network (VPC endpoint).',
      ],
      words: [
        ['Bucket policy', 'A JSON policy attached to a bucket, up to 20 KB.'],
        ['VPC endpoint', 'A private connection from your network to S3 that avoids the public internet.'],
        ['CloudFront', 'AWS’s CDN, which can serve files from a private bucket.'],
      ],
      example: 'A sign on the warehouse gate: “Delivery vans from Company X may collect from Bay 3; nobody enters without ID.”',
      remember: 'Bucket policy = who may use this bucket and how.',
      check: ['How do you force HTTPS?', 'Deny all actions when `aws:SecureTransport` is false.'],
    },
    {
      level: 1, title: 'Block Public Access',
      text: [
        '**Block Public Access (BPA)** is a set of four switches (two for ACLs, two for policies) at account and bucket level. When on, they override anything that would make data public — even a policy that says “everyone”.',
        'To publish a website, keep BPA on and put **CloudFront with Origin Access Control** in front of the bucket.',
      ],
      words: [
        ['Block Public Access', 'Settings that prevent public access regardless of policies or ACLs.'],
        ['Origin Access Control (OAC)', 'CloudFront’s identity for reading private buckets.'],
      ],
      example: 'Disconnecting the shop’s street door entirely: customers come through the mall entrance (CloudFront) instead.',
      remember: 'Keep BPA on; publish via CloudFront.',
      check: ['A policy grants `Principal: "*"` but BPA is on. Is the bucket public?', 'No — BPA overrides it.'],
    },
    {
      level: 2, title: 'Object ownership and ACLs',
      text: [
        'Old S3 used per-object **ACLs** (access control lists), and objects uploaded by another account belonged to that account — confusing and error-prone. Today **Bucket owner enforced** is the default: ACLs are disabled, the bucket owner owns everything, and only policies decide access.',
      ],
      words: [
        ['ACL', 'Access control list — legacy per-object permission lists.'],
        ['Object ownership', 'The bucket setting that decides who owns uploaded objects.'],
      ],
      example: 'Whoever drops a parcel at your warehouse, it becomes your parcel to manage.',
      remember: 'ACLs off, policies only.',
      check: ['Why disable ACLs?', 'Simpler, predictable access: one model (policies) and the bucket owner owns all objects.'],
    },
    {
      level: 2, title: 'Encryption in transit and at rest',
      text: [
        '**In transit**: always use HTTPS (TLS); enforce it with a bucket policy. **At rest**: S3 encrypts every new object. Options: **SSE-S3** (default, S3 manages keys), **SSE-KMS** (keys in KMS that you control and audit), **DSSE-KMS** (two layers), **SSE-C** (you provide a key with every request — blocked by default for new buckets since April 2026), or **client-side** encryption before upload.',
      ],
      words: [
        ['TLS', 'The encryption behind HTTPS.'],
        ['SSE', 'Server-side encryption — S3 encrypts when storing.'],
        ['KMS', 'Key Management Service — creates and guards encryption keys.'],
      ],
      example: 'An armoured van on the road (in transit) and a locked safe in the warehouse (at rest).',
      remember: 'SSE-S3 by default; SSE-KMS when you need control and audit.',
      check: ['Which option lets you audit every decryption in CloudTrail?', 'SSE-KMS (and DSSE-KMS).'],
    },
    {
      level: 2, title: 'How SSE-KMS really works',
      text: [
        'This is **envelope encryption**. The KMS key never leaves KMS. For each upload S3 asks KMS for a **data key**, encrypts the object with it, stores an encrypted copy of the data key next to the object and discards the plain one. On download, S3 asks KMS to decrypt the data key, then decrypts the object.',
        'So users need KMS permissions too: **GenerateDataKey** to upload and **Decrypt** to download, allowed by the **key policy**.',
      ],
      words: [
        ['Envelope encryption', 'Encrypting data with a data key, and the data key with a master key.'],
        ['Data key', 'A key used to encrypt one object (or a batch).'],
        ['Key policy', 'The resource policy on a KMS key deciding who may use it.'],
      ],
      example: 'Each letter is locked in a small box; the small box’s key is locked in a vault that only the vault keeper can open.',
      remember: 'S3 permission + KMS permission are both needed.',
      check: ['A role can GetObject but gets AccessDenied on KMS-encrypted files. Missing?', 'kms:Decrypt on the key (and the key policy allowing it).'],
    },
    {
      level: 3, title: 'S3 Bucket Keys',
      text: [
        'Calling KMS for every object is slow and costly at scale, and can hit KMS limits. With an **S3 Bucket Key**, S3 gets a temporary **bucket-level key** from KMS and uses it to make per-object data keys itself. KMS is called far less — up to **99% fewer requests** — lowering cost and avoiding throttling.',
        'Trade-off: KMS logs show the bucket instead of each object as context. Bucket Keys work with SSE-KMS (not DSSE-KMS) and apply to new objects.',
      ],
      words: [
        ['Bucket Key', 'A bucket-level key derived from a KMS key to reduce KMS calls.'],
        ['Encryption context', 'Extra information bound to an encryption operation and recorded in logs.'],
      ],
      example: 'Instead of walking to the bank vault for every parcel, the clerk collects a day key each morning and works from the desk.',
      remember: 'SSE-KMS at scale → turn on Bucket Keys.',
      check: ['What two problems do Bucket Keys solve?', 'KMS cost and KMS request throttling.'],
    },
    {
      level: 3, title: 'Watching and proving access',
      text: [
        '**CloudTrail data events** record object-level actions (who downloaded what). **Server access logs** are cheaper request logs. **IAM Access Analyzer** finds buckets shared publicly or with other accounts. **Amazon Macie** scans objects for sensitive data such as card numbers. **Access points** give each application its own door with its own policy.',
      ],
      words: [
        ['Data events', 'CloudTrail records of object-level operations.'],
        ['Macie', 'A service that discovers sensitive data in S3.'],
        ['Access point', 'A named endpoint for a bucket with its own policy.'],
      ],
      example: 'CCTV at every door plus a guard who walks the aisles checking nothing valuable is left in the open.',
      remember: 'You can’t protect what you can’t see.',
      check: ['Which service finds credit card numbers inside objects?', 'Amazon Macie.'],
    },
  ],
};
