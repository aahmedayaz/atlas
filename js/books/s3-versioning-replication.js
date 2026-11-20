export default {
  title: 'Versioning, replication and bulk operations',
  intro: 'Data must survive mistakes, attacks and even a region going offline. This book explains how S3 keeps old versions, makes deletes reversible or impossible, copies data to other buckets automatically, and applies one change to billions of objects.',
  chapters: [
    {
      level: 1, title: 'Versioning',
      text: [
        'With **versioning** on, a bucket keeps every version of every object. Uploading to an existing key adds a new **current version** and keeps the old as **noncurrent**. Each version has a **version ID**.',
        'States: unversioned (default) → enabled → suspended. You can’t go back to unversioned.',
      ],
      words: [
        ['Versioning', 'Keeping all versions of every object in a bucket.'],
        ['Current version', 'The version returned by a normal GET.'],
        ['Noncurrent version', 'An older version kept after being replaced.'],
      ],
      example: 'Track changes in a document: every save is kept, and you can open any earlier draft.',
      remember: 'Versioning turns overwrites into history.',
      check: ['Can you turn versioning off completely?', 'No — only suspend it.'],
    },
    {
      level: 1, title: 'Deleting with versioning',
      text: [
        'A normal delete in a versioned bucket only adds a **delete marker** — the object looks deleted, but every version remains. Removing the marker brings it back. Deleting a specific **version ID** removes that version for good.',
        'Old versions and markers keep costing money, so use lifecycle rules to clean them up after a while.',
      ],
      words: [
        ['Delete marker', 'A placeholder version that hides an object.'],
        ['Permanent delete', 'Deleting a specific version ID.'],
      ],
      example: 'Putting a “removed” sticky note on a folder; the papers are still inside until someone shreds them one by one.',
      remember: 'Plain delete = reversible. Delete by version ID = permanent.',
      check: ['How do you undelete an object?', 'Delete its delete marker.'],
    },
    {
      level: 2, title: 'MFA Delete and Object Lock',
      text: [
        '**MFA Delete** requires an MFA code to permanently delete versions or change versioning; only root can enable it. **Object Lock** stores versions as **WORM** (write once, read many) for a retention period: **governance mode** (special permission can bypass) or **compliance mode** (nobody, not even root, can delete early). A **legal hold** blocks deletion with no end date.',
      ],
      words: [
        ['WORM', 'Write once, read many — data can’t be changed or deleted.'],
        ['Retention period', 'How long an object version must be kept.'],
        ['Legal hold', 'An indefinite lock until removed, often for lawsuits.'],
      ],
      example: 'A time-locked safe at a bank: once closed, it opens only on the set date, whoever asks.',
      remember: 'Compliance mode = truly undeletable until expiry.',
      check: ['Which mode can a privileged admin bypass?', 'Governance mode (with s3:BypassGovernanceRetention).'],
    },
    {
      level: 2, title: 'Replication basics',
      text: [
        '**Replication** automatically copies new objects from a source bucket to destination buckets: **CRR** to another region, **SRR** within the same region (another account, or for aggregation). Both buckets need **versioning**, and S3 uses an **IAM role** you provide to copy. Copies usually arrive within seconds to minutes.',
      ],
      words: [
        ['CRR', 'Cross-Region Replication.'],
        ['SRR', 'Same-Region Replication.'],
        ['Asynchronous', 'Happening shortly after, not as part of the original request.'],
      ],
      example: 'A photocopier that automatically sends a copy of every new document to the branch office.',
      remember: 'Versioning on both sides + a role.',
      check: ['Why replicate to another region?', 'Disaster recovery, lower latency for distant users, or compliance.'],
    },
    {
      level: 2, title: 'What replication does and doesn’t copy',
      text: [
        'Copied: objects written **after** the rule, with metadata, tags and lock settings; KMS-encrypted objects if you opt in; delete markers if you enable it. **Not** copied: objects that existed before the rule, deletions of specific versions (protecting the copy), replicas of replicas (no chaining) and lifecycle actions.',
      ],
      words: [
        ['Replica', 'The copy in the destination bucket.'],
        ['Replication status', 'PENDING, COMPLETED, FAILED or REPLICA on an object.'],
      ],
      example: 'The photocopier only copies new letters, and it never shreds the branch’s copy when you shred yours.',
      remember: 'Existing objects need Batch Replication.',
      check: ['A ransomware script deletes versions in the source. Are replicas affected?', 'No — version deletions aren’t replicated.'],
    },
    {
      level: 2, title: 'Encrypted objects, speed guarantees and two-way sync',
      text: [
        'For KMS-encrypted objects, enable KMS replication, choose a key in the destination region, and give the role permission to decrypt with the source key and encrypt with the destination key. **Replication Time Control (RTC)** adds an SLA: 99.99% of objects within 15 minutes, with metrics. **Replica modification sync** keeps changes flowing both ways for active-active setups.',
      ],
      words: [
        ['RTC', 'Replication Time Control — a 15-minute replication guarantee.'],
        ['SLA', 'Service Level Agreement — a promised performance level.'],
        ['Active-active', 'Two sites both serving traffic at the same time.'],
      ],
      example: 'Express courier with a guaranteed delivery window, versus normal post.',
      remember: 'KMS replication needs keys and permissions on both ends.',
      check: ['What does RTC guarantee?', '99.99% of objects replicated within 15 minutes.'],
    },
    {
      level: 3, title: 'Batch Replication',
      text: [
        '**Batch Replication** is a Batch Operations job that replicates objects using your existing rule: objects that existed before it, objects whose replication FAILED, or objects you want sent to a newly added destination. S3 can build the list (manifest) for you with filters, and writes a completion report.',
      ],
      words: [
        ['Manifest', 'The list of objects a batch job will process.'],
        ['Completion report', 'A file listing which objects succeeded or failed.'],
      ],
      example: 'Hiring a team to photocopy the old archive that existed before the automatic copier was installed.',
      remember: 'Old/failed objects → Batch Replication.',
      check: ['Who can generate the manifest?', 'S3 itself (with filters), or you via an Inventory report/CSV.'],
    },
    {
      level: 3, title: 'S3 Batch Operations',
      text: [
        '**Batch Operations** runs one action on a list of objects — up to billions — with retries, progress and a report. You give it a **manifest**, an **operation** (copy, tag, restore from Glacier, set Object Lock retention, replicate, invoke a Lambda for anything custom…), an **IAM role**, a **priority** and where to write the report.',
        'A job moves through states: New → Preparing → (Suspended, waiting for your confirmation) → Ready → Active → Complete or Failed. You pay per job and per object.',
      ],
      words: [
        ['Batch Operations', 'An S3 feature for running one operation over many objects.'],
        ['Job', 'One batch run with its manifest, operation and settings.'],
        ['Priority', 'Which job runs first when several are queued.'],
      ],
      example: 'Instead of relabelling every box yourself, hand a moving company the list and the instruction, and get a report when they’re done.',
      remember: 'Manifest + operation + role + report.',
      check: ['How would you tag 500 million objects?', 'Inventory (or Athena) → manifest → Batch Operations PutObjectTagging job.'],
    },
  ],
};
