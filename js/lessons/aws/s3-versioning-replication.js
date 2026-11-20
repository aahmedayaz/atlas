import { n, e, f, z } from '../../engine/build.js';

export default {
  id: 's3-versioning-replication',
  title: 'S3 versioning, replication, Batch Replication and Batch Operations',
  level: 'Advanced',
  minutes: 45,
  tags: ['AWS', 'S3', 'Resilience', 'Replication', 'CDK'],
  summary: 'How versioning stores every write and turns deletes into delete markers, MFA Delete and Object Lock, how Cross- and Same-Region Replication work (requirements, what is and isn’t copied, KMS, RTC, two-way), why existing objects need Batch Replication, and running S3 Batch Operations jobs on billions of objects from the console, CLI and CDK.',
  learn: ['Versioning states, version IDs and the null version', 'Delete markers, restores and permanent deletes', 'MFA Delete and Object Lock (WORM)', 'CRR vs SRR: requirements and behaviour', 'Replicating KMS-encrypted objects, RTC and two-way replication', 'Batch Replication for existing objects', 'Batch Operations: manifests, operations, reports, job states'],
  steps: [
    {
      short: 'Versioning', title: 'Versioning: every write becomes a new version', tag: 'concept',
      scene: { nodes: [n('w', 120, 250, 'PUT config.json × 3', { kind: 'code' }), n('v3', 520, 110, 'v3 (current)', { kind: 'obj', sub: 'versionId 3Lg…', state: 'active' }), n('v2', 520, 250, 'v2 (noncurrent)', { kind: 'obj', sub: 'versionId 8Kd…' }), n('v1', 520, 390, 'v1 (noncurrent)', { kind: 'obj', sub: 'versionId null' }), n('get', 880, 250, 'GET config.json', { kind: 'cli', sub: 'returns v3 · ?versionId=8Kd… returns v2' })],
        edges: [e('w', 'v3'), e('v3', 'v2', '', { style: 'dashed' }), e('v2', 'v1', '', { style: 'dashed' }), e('v3', 'get')], flows: [f('w>v3', '', { kind: 'code', every: 2.6 })] },
      body: [
        'A bucket is in one of three [[versioning]] states: **unversioned** (default), **enabled**, or **suspended**. Once enabled it can never return to unversioned — only be suspended.',
        'With versioning enabled, every PUT of an existing key keeps the old data as a **noncurrent version** and adds a new **current version** with a unique version ID. GET returns the current one; `?versionId=` fetches any older one. Objects written before versioning was enabled have the version ID `null`.',
        'Every version is stored and billed in full. Pair versioning with a lifecycle rule that expires noncurrent versions after N days (or keeps only the newest N).',
      ],
      code: { file: 'versioning.sh', lang: 'bash', src: `
aws s3api put-bucket-versioning --bucket acme-data \\
  --versioning-configuration Status=Enabled
aws s3api list-object-versions --bucket acme-data --prefix config.json \\
  --query "Versions[].[VersionId,IsLatest,LastModified]" --output table
aws s3api get-object --bucket acme-data --key config.json \\
  --version-id 8KdEXAMPLE old.json`, hl: [1, 3, 5] },
    },
    {
      short: 'Delete markers', title: 'Deleting in a versioned bucket: delete markers', tag: 'internals',
      scene: { nodes: [n('d', 120, 250, 'DELETE config.json', { kind: 'cli', sub: 'no versionId' }), n('dm', 520, 100, 'Delete marker (current)', { kind: 'note', icon: false, state: 'bad' }), n('v3', 520, 250, 'v3 (now noncurrent)', { kind: 'obj', sub: 'data still there' }), n('get', 880, 100, 'GET → 404', { kind: 'note', icon: false }), n('undo', 880, 360, 'Delete the marker → v3 is back', { kind: 'cli', state: 'ok' })],
        edges: [e('d', 'dm', 'adds'), e('dm', 'v3', '', { style: 'dashed' }), e('dm', 'get'), e('undo', 'dm', 'DELETE ?versionId=<marker>')] },
      body: [
        'A normal DELETE on a versioned bucket removes nothing: it adds a **[[delete-marker|delete marker]]** as the new current version. GET now returns 404 and listings hide the key, but every version is still stored.',
        '**Undelete** = delete the delete marker (DELETE with its version ID). **Permanently delete** = DELETE with a specific version ID — that data is gone. In the console, toggle *Show versions* to see and remove markers or versions.',
        'This is why versioning protects against accidental deletes and overwrites — and why it costs more: “deleted” data keeps being billed until lifecycle expires noncurrent versions and expired delete markers.',
      ],
    },
    {
      short: 'MFA Delete & Lock', title: 'MFA Delete and Object Lock: making deletes hard or impossible', tag: 'concept',
      scene: { nodes: [n('root', 140, 150, 'Root user + MFA', { kind: 'root', sub: 'only root can enable MFA Delete' }), n('b', 500, 150, 'MFA Delete', { kind: 'mfa', sub: 'permanent deletes need MFA' }), n('ol', 500, 370, 'Object Lock', { kind: 'lock', sub: 'WORM retention', state: 'active' }), n('gov', 860, 290, 'Governance mode', { kind: 'iam', sub: 'special permission can bypass' }), n('comp', 860, 450, 'Compliance mode', { kind: 'lock', sub: 'nobody, not even root', state: 'bad' })],
        edges: [e('root', 'b', 'CLI only'), e('ol', 'gov'), e('ol', 'comp')], h: 520 },
      body: [
        '**MFA Delete** requires an MFA code to permanently delete a version or change the versioning state. Only the **root user** can enable it, and only via CLI/API (not the console).',
        '**Object Lock** gives write-once-read-many (WORM) storage and requires versioning. Each version can have a **retention period** in **governance mode** (users with `s3:BypassGovernanceRetention` can override) or **compliance mode** (no one — not even root — can delete or shorten it until it expires), plus an independent **legal hold** with no end date. Used for regulatory records and ransomware-proof backups. It can be enabled on existing buckets too.',
      ],
    },
    {
      short: 'Replication', title: 'Replication: CRR and SRR', tag: 'concept',
      scene: { zones: [z('r1', 40, 70, 360, 360, 'eu-west-1', 'aws'), z('r2', 640, 70, 360, 360, 'us-east-1 (or same region)', 'aws')], nodes: [n('src', 220, 250, 'Source bucket', { kind: 's3', sub: 'versioning ON' }), n('role', 520, 450, 'Replication role', { kind: 'iam', sub: 'assumed by s3.amazonaws.com' }), n('dst', 820, 250, 'Destination bucket', { kind: 's3', sub: 'versioning ON · status REPLICA' })],
        edges: [e('src', 'dst', 'async copy'), e('role', 'src', '', { style: 'dashed' }), e('role', 'dst', '', { style: 'dashed' })],
        flows: [f('src>dst', 'new object', { kind: 's3', every: 2.4 })], h: 520 },
      body: [
        '[[replication|S3 Replication]] copies objects **asynchronously** to one or more destination buckets: **Cross-Region Replication (CRR)** for disaster recovery, latency or compliance; **Same-Region Replication (SRR)** for log aggregation, prod→test copies or keeping a copy in another account.',
        'Requirements: **versioning enabled on source and destination**; an **IAM role** S3 assumes with permission to read the source and write replicas; for another account, a **destination bucket policy** allowing that role (and usually *owner override* so the destination account owns the replicas).',
        'Most objects replicate within seconds to minutes. Each source object shows `ReplicationStatus`: `PENDING`, `COMPLETED` or `FAILED`; replicas show `REPLICA`.',
      ],
    },
    {
      short: 'What replicates', title: 'What is replicated — and what is not', tag: 'internals',
      scene: { nodes: [n('y1', 200, 90, '✓ new objects after the rule', { kind: 'obj', state: 'ok' }), n('y2', 200, 200, '✓ metadata, tags, Object Lock info', { kind: 'obj', state: 'ok' }), n('y3', 200, 310, '✓ delete markers (if enabled)', { kind: 'obj', state: 'ok' }), n('n1', 700, 90, '✗ objects that existed before', { kind: 'obj', state: 'bad' }), n('n2', 700, 200, '✗ deletes of specific versions', { kind: 'obj', state: 'bad' }), n('n3', 700, 310, '✗ replicas of replicas (no chaining)', { kind: 'obj', state: 'bad' }), n('n4', 700, 420, '✗ lifecycle actions', { kind: 'obj', state: 'bad' })], h: 500 },
      body: [
        '<b>Replicated:</b> objects created *after* the rule exists, their metadata, tags and Object Lock settings; objects encrypted with SSE-S3, and SSE-KMS/DSSE-KMS when you opt in; **delete markers** only if *Delete marker replication* is enabled.',
        '<b>Not replicated:</b> objects that already existed (use **Batch Replication**); **DELETE of a specific version** (on purpose, so a malicious delete in the source doesn’t destroy the copy); objects that are themselves replicas (A→B→C does *not* move A’s objects to C); lifecycle actions; SSE-C objects only if you opt in.',
      ],
      callout: { kind: 'warn', title: 'Interview favourite', text: '“I enabled replication but my old files aren’t in the destination.” Replication only applies to new writes. Existing objects need S3 Batch Replication.' },
    },
    {
      short: 'Rule options', title: 'Replication rules: filters, KMS, RTC, two-way', tag: 'code',
      scene: { nodes: [n('rule', 160, 250, 'Replication rule', { kind: 'policy', sub: 'priority · filter · destination' }), n('kms', 520, 90, 'KMS objects', { kind: 'kms', sub: 'SseKmsEncryptedObjects + replica key' }), n('rtc', 520, 250, 'RTC', { kind: 'clock', sub: '99.99% within 15 min + metrics' }), n('two', 520, 410, 'Replica modification sync', { kind: 'layers', sub: 'two-way / active-active' }), n('dst', 860, 250, 'Destination', { kind: 's3', sub: 'storage class: Standard-IA' })],
        edges: [e('rule', 'kms'), e('rule', 'rtc'), e('rule', 'two'), e('rtc', 'dst')] },
      body: [
        'A rule has a **priority**, a **filter** (prefix and/or tags), a **destination** (bucket, optional different storage class, optional owner override to the destination account) and options:',
        '<ul><li><b>KMS:</b> tick *Replicate objects encrypted with AWS KMS* and choose a key in the destination region; the role needs `kms:Decrypt` on the source key and `kms:Encrypt` on the destination key.</li><li><b>Replication Time Control (RTC):</b> an SLA that 99.99% of objects replicate within 15 minutes, plus replication metrics and events — for compliance-driven DR.</li><li><b>Replica modification sync:</b> with rules in both directions, metadata changes on replicas sync back — the basis for active-active buckets behind a Multi-Region Access Point.</li></ul>',
      ],
      code: { file: 'replication.json', lang: 'json', src: `
{
  "Role": "arn:aws:iam::123456789012:role/s3-replication",
  "Rules": [{
    "ID": "dr-copy", "Priority": 1, "Status": "Enabled",
    "Filter": { "Prefix": "invoices/" },
    "DeleteMarkerReplication": { "Status": "Enabled" },
    "SourceSelectionCriteria": { "SseKmsEncryptedObjects": { "Status": "Enabled" } },
    "Destination": {
      "Bucket": "arn:aws:s3:::acme-data-dr",
      "StorageClass": "STANDARD_IA",
      "EncryptionConfiguration": { "ReplicaKmsKeyID": "arn:aws:kms:us-east-1:123456789012:key/…" },
      "ReplicationTime": { "Status": "Enabled", "Time": { "Minutes": 15 } },
      "Metrics": { "Status": "Enabled", "EventThreshold": { "Minutes": 15 } }
    }
  }]
}
// aws s3api put-bucket-replication --bucket acme-data --replication-configuration file://replication.json`, hl: [2, 5, 7, 13] },
    },
    {
      short: 'In CDK', title: 'Replication in CDK', tag: 'code',
      scene: { nodes: [n('code', 140, 250, 'stack.ts', { kind: 'code' }), n('role', 470, 110, 'Replication role', { kind: 'iam' }), n('src', 470, 380, 'Source bucket', { kind: 's3', sub: 'versioned' }), n('dst', 820, 250, 'Destination bucket', { kind: 's3', sub: 'versioned · other stack/region' })],
        edges: [e('code', 'role'), e('code', 'src'), e('src', 'dst', 'rule')] },
      body: [
        'Recent `aws-cdk-lib` versions accept `replicationRules` directly on `s3.Bucket`. The approach below works on any version: set the CloudFormation property on the L1 resource (an **escape hatch**) and grant the role what it needs. Destination buckets in another region live in another stack (with `crossRegionReferences` or a fixed name).',
      ],
      code: { file: 'lib/replication.ts', lang: 'ts', src: `
const dest = s3.Bucket.fromBucketName(this, 'Dest', 'acme-data-dr');   // versioned, in us-east-1

const role = new iam.Role(this, 'ReplRole', {
  assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
});
const src = new s3.Bucket(this, 'Data', { versioned: true });

role.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:GetReplicationConfiguration', 's3:ListBucket'], resources: [src.bucketArn] }));
role.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:GetObjectVersionForReplication', 's3:GetObjectVersionAcl', 's3:GetObjectVersionTagging'],
  resources: [src.arnForObjects('*')] }));
role.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:ReplicateObject', 's3:ReplicateDelete', 's3:ReplicateTags'],
  resources: [dest.arnForObjects('*')] }));

(src.node.defaultChild as s3.CfnBucket).replicationConfiguration = {
  role: role.roleArn,
  rules: [{ id: 'dr-copy', status: 'Enabled', priority: 1, filter: { prefix: 'invoices/' },
            deleteMarkerReplication: { status: 'Enabled' },
            destination: { bucket: dest.bucketArn, storageClass: 'STANDARD_IA' } }],
};`, hl: [4, 6, 18, 19] },
    },
    {
      short: 'Batch Replication', title: 'Batch Replication: copying the objects that already existed', tag: 'concept',
      scene: { nodes: [n('old', 140, 250, '40 M existing objects', { kind: 'obj', sub: 'before the rule' }), n('man', 450, 110, 'Manifest', { kind: 'file', sub: 'S3-generated or Inventory' }), n('job', 450, 380, 'Batch Operations job', { kind: 'layers', sub: 'operation: Replicate' }), n('dst', 830, 250, 'Destination', { kind: 's3', state: 'ok' }), n('rep', 830, 450, 'Completion report', { kind: 'file' })],
        edges: [e('old', 'man'), e('man', 'job'), e('job', 'dst', 'uses the replication rule'), e('job', 'rep')],
        flows: [f('job>dst', '', { kind: 'layers', every: 0.6 })], h: 520 },
      body: [
        '**S3 Batch Replication** is a Batch Operations job that replicates objects using your existing replication configuration: objects that existed before the rule, objects whose status is `FAILED`, objects already replicated that you want sent to a **new** destination, or replicas you want to copy onward.',
        'The console offers it right after you create a rule (*Replicate existing objects?* → *Yes*). The manifest can be **generated by S3** with filters (creation date, replication status) or come from an Inventory report. A completion report lists every success and failure.',
      ],
    },
    {
      short: 'Batch Operations', title: 'S3 Batch Operations: one operation, billions of objects', tag: 'internals',
      scene: { nodes: [n('man', 120, 250, 'Manifest', { kind: 'file', sub: 'CSV · Inventory · S3-generated' }), n('job', 430, 250, 'Job', { kind: 'layers', sub: 'operation + role + priority', state: 'active' }),
        n('o1', 780, 70, 'Copy / Replicate', { kind: 's3' }), n('o2', 780, 160, 'Put / Delete tags', { kind: 's3' }), n('o3', 780, 250, 'Restore from Glacier', { kind: 's3' }), n('o4', 780, 340, 'Object Lock retention / legal hold', { kind: 'lock' }), n('o5', 780, 430, 'Invoke Lambda · compute checksum', { kind: 'lambda' })],
        edges: [e('man', 'job'), e('job', 'o1'), e('job', 'o2'), e('job', 'o3'), e('job', 'o4'), e('job', 'o5')], h: 500 },
      body: [
        '[[batch-ops|Batch Operations]] runs **one operation over a list of objects** with retries, progress tracking and a report — instead of you writing a crawler. A job has: a **manifest** (CSV of bucket,key[,version], an S3 Inventory report, or a manifest S3 generates from filters), an **operation**, an **IAM role** that Batch Operations assumes, a **priority** and a **completion report** location.',
        'Operations: Copy (change storage class, encryption, metadata, move between buckets), Replicate, Put/Delete object tagging, Replace ACL, Restore (Glacier), Object Lock retention / legal hold, **Invoke Lambda** (anything custom), and compute checksums.',
        'Job states: `New` → `Preparing` (reading the manifest) → `Suspended` (waiting for you to *confirm* if you asked) → `Ready` → `Active` → `Completing` → `Complete` / `Failed` / `Cancelled`. You pay per job plus per object processed (plus the underlying requests).',
      ],
      code: { file: 'batch-job.sh', lang: 'bash', src: `
aws s3control create-job --account-id 123456789012 \\
  --operation '{"S3PutObjectTagging": {"TagSet": [{"Key": "retention", "Value": "7y"}]}}' \\
  --manifest '{"Spec": {"Format": "S3BatchOperations_CSV_20180820", "Fields": ["Bucket","Key"]},
               "Location": {"ObjectArn": "arn:aws:s3:::acme-ops/manifests/tag.csv",
                            "ETag": "60e460c9d1046e73f7dde5043ac3ae85"}}' \\
  --report '{"Bucket": "arn:aws:s3:::acme-ops", "Prefix": "reports", "Format": "Report_CSV_20180820",
             "Enabled": true, "ReportScope": "FailedTasksOnly"}' \\
  --priority 10 --role-arn arn:aws:iam::123456789012:role/batch-ops --confirmation-required
aws s3control update-job-status --account-id 123456789012 --job-id <id> --requested-job-status Ready
aws s3control describe-job --account-id 123456789012 --job-id <id> --query Job.ProgressSummary`, hl: [1, 2, 3, 9, 10] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What happens when you delete an object in a versioned bucket?', a: ['A delete marker becomes the current version; the data remains as noncurrent versions. Removing the delete marker restores the object; deleting a specific version ID removes that version permanently.'] },
    { lvl: 'J', q: 'Can you turn versioning off?', a: ['No, only suspend it. Existing versions remain; new writes get version ID null.'] },
    { lvl: 'M', q: 'What are the prerequisites for S3 replication?', a: ['Versioning on source and destination, an IAM role S3 can assume with read/replicate permissions, destination bucket policy for cross-account, and KMS permissions/replica key for encrypted objects.'] },
    { lvl: 'M', q: 'Why are version deletes not replicated?', a: ['To protect the replica: if someone maliciously or accidentally deletes versions in the source, the destination still has them. Delete markers can be replicated optionally.'] },
    { lvl: 'M', q: 'Governance vs compliance mode?', a: ['Governance: protected unless a user has s3:BypassGovernanceRetention and asks to bypass. Compliance: nobody, including root, can delete or shorten retention until it expires.'] },
    { lvl: 'S', q: 'Design ransomware-resilient storage for backups.', a: ['Versioned bucket with Object Lock in compliance mode and a default retention; replication (with RTC if required) to a bucket in a separate, locked-down account and region; no delete-marker replication or with Object Lock on the replica too; MFA Delete or SCPs preventing changes to lock/replication/BPA; KMS keys with restrictive key policies in the backup account; lifecycle to cheaper storage; regular restore tests.'], why: 'Tests versioning + Object Lock + cross-account replication together.' },
  ],
  history: {
    timeline: [
      { yr: '2010', title: 'Versioning and MFA Delete', text: 'Keep every version of every object; require MFA for permanent deletes.' },
      { yr: '2011–2013', title: 'Lifecycle rules', text: 'Expire objects, archive to Glacier, then manage noncurrent versions automatically.' },
      { yr: '2015', title: 'Cross-Region Replication', text: 'Asynchronous copies to another region.' },
      { yr: '2018–2019', title: 'Object Lock; Batch Operations', text: 'WORM retention (2018) and managed bulk jobs (2019).', c: 'g' },
      { yr: '2019–2020', title: 'SRR, RTC, replica modification sync', text: 'Same-region copies and the 15-minute SLA (2019); two-way metadata sync (2020).' },
      { yr: '2022', title: 'S3 Batch Replication', text: 'Replicate existing and failed objects.', c: 'g' },
    ],
    alts: { cols: ['Goal', 'Use', 'Note'], rows: [['Undo accidental deletes/overwrites', 'Versioning (+ lifecycle)', 'cheap safety net'], ['Can’t be deleted for N years', 'Object Lock compliance mode', 'not even root'], ['Copy to another region/account', 'CRR / SRR', 'new objects only'], ['Copy what already exists', 'Batch Replication', 'Batch Operations job'], ['One-off bulk change', 'Batch Operations', 'copy, tag, restore, Lambda…'], ['Simple one-off copy', 'aws s3 sync / DataSync', 'no replication rule needed']] },
  },
  quiz: [
    { q: 'You enable replication on a bucket with 10 M existing objects. What gets copied?', o: ['All 10 M', 'Only new objects', 'Nothing until you restart', 'Only tagged objects'], a: 1, why: 'Use Batch Replication for existing ones.' },
    { q: 'GET on a key whose current version is a delete marker returns…', o: ['the previous version', '404 Not Found', '403', 'an empty object'], a: 1, why: 'The marker hides the object.' },
    { q: 'Who can enable MFA Delete?', o: ['Any admin', 'The root user', 'S3 service', 'Bucket policy'], a: 1, why: 'Root only, via CLI/API.' },
    { q: 'Versioning must be enabled on…', o: ['source only', 'destination only', 'both', 'neither'], a: 2, why: 'Both buckets.' },
    { q: 'Which Batch Operations input can S3 build for you from filters?', o: ['Completion report', 'Generated manifest', 'Replication rule', 'IAM role'], a: 1, why: 'Or use a CSV / Inventory report.' },
  ],
  cheat: `<h3>Versioning</h3><ul><li>States: unversioned → enabled ⇄ suspended</li><li>DELETE → delete marker · DELETE ?versionId → permanent</li><li>Lifecycle: NoncurrentVersionExpiration, ExpiredObjectDeleteMarker</li><li>MFA Delete (root, CLI) · Object Lock: governance / compliance / legal hold</li></ul>
  <h3>Replication</h3><ul><li>Versioning both sides · IAM role (s3.amazonaws.com) · dest policy if cross-account</li><li>New objects only → Batch Replication for existing/failed</li><li>Delete markers optional · version deletes never · no chaining</li><li>KMS: SseKmsEncryptedObjects + ReplicaKmsKeyID · RTC: 99.99% ≤ 15 min</li></ul>
  <h3>Batch Operations</h3><pre>manifest (CSV | Inventory | generated) + operation + role + report
New → Preparing → Suspended → Ready → Active → Complete
aws s3control create-job / update-job-status / describe-job</pre>`,
};
