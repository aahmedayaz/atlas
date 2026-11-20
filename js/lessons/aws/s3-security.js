import { n, e, f, z } from '../../engine/build.js';

export default {
  id: 's3-security',
  title: 'S3 security: bucket policies, public access and encryption (incl. Bucket Keys)',
  level: 'Intermediate',
  minutes: 45,
  tags: ['AWS', 'S3', 'Security', 'KMS', 'CDK'],
  summary: 'Every layer that decides who can read a bucket — IAM, bucket policies, Block Public Access, Object Ownership, access points, VPC endpoints — then encryption in transit and at rest: SSE-S3, SSE-KMS, DSSE-KMS and SSE-C, how KMS envelope encryption works, why S3 Bucket Keys cut KMS cost by up to 99%, and building it all in the console and CDK.',
  learn: ['The layers of S3 access control and how they combine', 'Writing bucket policies: TLS-only, CloudFront OAC, VPC endpoint, cross-account', 'Block Public Access: the four switches at account and bucket level', 'Object Ownership and why ACLs are off', 'Encryption options and when to pick each', 'KMS envelope encryption and the permissions it needs', 'S3 Bucket Keys: what, why, trade-offs', 'Logging and auditing access'],
  steps: [
    {
      short: 'Layers', title: 'Who can read this bucket? Every layer gets a vote', tag: 'concept',
      scene: { nodes: [n('req', 100, 250, 'GetObject request', { kind: 'aws' }),
        n('l1', 380, 60, 'Org guardrails (SCP / RCP)', { kind: 'org' }), n('l2', 380, 150, 'IAM identity policy', { kind: 'iam' }), n('l3', 380, 240, 'Bucket policy / access point', { kind: 'policy' }), n('l4', 380, 330, 'Block Public Access', { kind: 'lock' }), n('l5', 380, 420, 'KMS key policy (if SSE-KMS)', { kind: 'kms' }),
        n('obj', 800, 250, 'Object', { kind: 'obj', sub: 'only if no layer says no' })],
        edges: [e('req', 'l1'), e('l1', 'l2'), e('l2', 'l3'), e('l3', 'l4'), e('l4', 'l5'), e('l5', 'obj')], flows: [f('req>l1', '', { kind: 'aws', every: 3 })], h: 500 },
      body: [
        'S3 access is decided by several layers at once. Explicit deny anywhere wins; then an allow is needed (identity policy or bucket policy in the same account; both cross-account):',
        '<ul><li><b>Organization guardrails</b> — SCPs (principals) and RCPs (resources).</li><li><b>IAM identity policies</b> on the caller.</li><li><b>Bucket policy</b> (resource policy) and **access point** policies.</li><li><b>Block Public Access</b> — overrides any policy or ACL that would make data public.</li><li><b>VPC endpoint policy</b> when the call goes through a gateway endpoint.</li><li><b>KMS key policy</b> — for SSE-KMS objects you also need permission to use the key.</li><li><b>ACLs</b> — legacy; disabled on modern buckets.</li></ul>',
      ],
    },
    {
      short: 'Bucket policies', title: 'Bucket policies you will actually write', tag: 'code',
      scene: { nodes: [n('cf', 150, 120, 'CloudFront (OAC)', { kind: 'cdn', sub: 'only this distribution' }), n('vpc', 150, 250, 'VPC endpoint vpce-1a2b', { kind: 'net', sub: 'private network only' }), n('xa', 150, 380, 'Account 4444… role', { kind: 'iam', sub: 'cross-account read' }), n('bp', 560, 250, 'Bucket policy', { kind: 'policy', sub: 'Allow + Deny statements' }), n('b', 880, 250, 'acme-site', { kind: 's3' })],
        edges: [e('cf', 'bp', 'Allow'), e('vpc', 'bp', 'Allow'), e('xa', 'bp', 'Allow'), e('bp', 'b')] },
      body: [
        'Common statements: **deny anything not over TLS** (`aws:SecureTransport`), **allow CloudFront** to read a private bucket using Origin Access Control (service principal + `AWS:SourceArn` of the distribution), **restrict to a VPC endpoint** (`aws:SourceVpce`), **cross-account read** for a role in another account, and **org-only access** (`aws:PrincipalOrgID`).',
        'Console: bucket → *Permissions* → *Bucket policy* → *Edit*. The editor validates JSON and Access Analyzer warns about public or cross-account grants. Bucket policies are limited to **20 KB**.',
      ],
      code: { file: 'bucket-policy.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "TLSOnly", "Effect": "Deny", "Principal": "*", "Action": "s3:*",
      "Resource": ["arn:aws:s3:::acme-site", "arn:aws:s3:::acme-site/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } } },
    { "Sid": "CloudFrontOAC", "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject", "Resource": "arn:aws:s3:::acme-site/*",
      "Condition": { "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/E2ABCDEF" } } }
  ]
}`, hl: [4, 7, 9, 12] },
    },
    {
      short: 'Block Public Access', title: 'Block Public Access: four switches that override everything', tag: 'concept',
      scene: { nodes: [n('acct', 160, 120, 'Account-level BPA', { kind: 'aws', sub: 'applies to every bucket' }), n('bkt', 160, 380, 'Bucket-level BPA', { kind: 's3', sub: 'per bucket' }),
        n('s1', 560, 70, 'BlockPublicAcls', { kind: 'lock', sub: 'reject new public ACLs' }), n('s2', 560, 190, 'IgnorePublicAcls', { kind: 'lock', sub: 'treat existing ones as private' }), n('s3', 560, 310, 'BlockPublicPolicy', { kind: 'lock', sub: 'reject public bucket policies' }), n('s4', 560, 430, 'RestrictPublicBuckets', { kind: 'lock', sub: 'only AWS principals & owner' }), n('out', 920, 250, 'Effective = most restrictive', { kind: 'iam', state: 'ok' })],
        edges: [e('acct', 's1'), e('bkt', 's4'), e('s2', 'out'), e('s3', 'out')], h: 500 },
      body: [
        '**Block Public Access (BPA)** has four settings — two for ACLs, two for policies — at the **account** level and per **bucket**; the most restrictive combination wins. With all four on (the default for new buckets), nothing can make data public, even an `"Principal": "*"` Allow.',
        'Need a public website? Don’t turn BPA off — keep the bucket private and serve it through **CloudFront with Origin Access Control**. Turn BPA off only for deliberate public datasets, and protect that decision with an SCP denying `s3:PutBucketPublicAccessBlock` / `s3:PutAccountPublicAccessBlock`.',
      ],
      code: { file: 'bpa.sh', lang: 'bash', src: `
aws s3control put-public-access-block --account-id 123456789012 \\
  --public-access-block-configuration \\
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api get-public-access-block --bucket acme-site
aws s3api get-bucket-policy-status --bucket acme-site   # IsPublic: false`, hl: [1, 4] },
    },
    {
      short: 'Ownership & ACLs', title: 'Object Ownership: why ACLs are switched off', tag: 'concept',
      scene: { nodes: [n('other', 140, 250, 'Partner account', { kind: 'aws', sub: 'uploads report.csv' }), n('b', 500, 250, 'Your bucket', { kind: 's3', sub: 'Bucket owner enforced' }), n('own', 860, 250, 'Owner: YOU', { kind: 'iam', sub: 'policies decide access', state: 'ok' })],
        edges: [e('other', 'b', 'PutObject'), e('b', 'own')], flows: [f('other>b', 'csv', { kind: 'aws', every: 2.6 })] },
      body: [
        'Originally each object was owned by the account that *uploaded* it, and access was controlled with per-object **ACLs**. That caused confusing cases: a partner uploads into your bucket and you can’t read the file.',
        '**Object Ownership = Bucket owner enforced** (default since April 2023) disables ACLs entirely: the bucket owner owns every object, and only policies control access. Keep it that way. Other settings (*Bucket owner preferred*, *Object writer*) exist only for legacy needs like S3 server access log delivery to old setups.',
      ],
    },
    {
      short: 'Access points', title: 'Access points: one door per application', tag: 'concept',
      scene: { nodes: [n('a1', 150, 120, 'analytics-ap', { kind: 'net', sub: 'read prefix data/' }), n('a2', 150, 250, 'ingest-ap', { kind: 'net', sub: 'write prefix in/ · VPC only' }), n('a3', 150, 380, 'partner-ap', { kind: 'net', sub: 'read shared/' }), n('b', 600, 250, 'data-lake bucket', { kind: 's3', sub: 'policy: delegate to access points' })],
        edges: [e('a1', 'b'), e('a2', 'b'), e('a3', 'b')] },
      body: [
        'One giant bucket policy shared by ten teams becomes unreadable (and hits the 20 KB limit). **S3 Access Points** give each application its own named endpoint with its own policy, optionally **restricted to a VPC**. The bucket policy simply delegates access control to access points owned by the account.',
        '**Multi-Region Access Points** add one global endpoint that routes to the nearest of several replicated buckets.',
      ],
    },
    {
      short: 'Encryption options', title: 'Encryption at rest: SSE-S3, SSE-KMS, DSSE-KMS, SSE-C', tag: 'concept',
      scene: { nodes: [n('a', 170, 90, 'SSE-S3 (default)', { kind: 'lock', sub: 'S3-managed keys · free', state: 'ok' }), n('b', 170, 210, 'SSE-KMS', { kind: 'kms', sub: 'your KMS key · audit · control' }), n('c', 170, 330, 'DSSE-KMS', { kind: 'kms', sub: 'two layers (compliance)' }), n('d', 170, 450, 'SSE-C', { kind: 'key', sub: 'you send the key each request', state: 'dim' }), n('obj', 640, 270, 'Object on disk', { kind: 'obj', sub: 'AES-256 encrypted' })],
        edges: [e('a', 'obj'), e('b', 'obj'), e('c', 'obj'), e('d', 'obj', '', { style: 'dashed' })], h: 520 },
      body: [
        '<b>In transit:</b> always HTTPS; enforce with the `aws:SecureTransport` deny and optionally require TLS 1.2+ (`s3:TlsVersion`).',
        '<b>At rest</b> ([[sse|server-side encryption]]):',
        '<ul><li><b>SSE-S3</b> — AES-256 with keys S3 manages. Applied to **every new object automatically since January 2023**. No cost, no setup, no key-level audit.</li><li><b>SSE-KMS</b> — S3 uses a key in [[kms|AWS KMS]]: the AWS-managed `aws/s3` key or, better, your **customer-managed key**. You control who can use the key (key policy), every use is logged in CloudTrail, and you can disable the key to make data unreadable. Costs KMS requests.</li><li><b>DSSE-KMS</b> — dual-layer encryption with KMS, for rules that require two independent layers.</li><li><b>SSE-C</b> — you send your own key with every request; S3 never stores it. Since **April 2026 it is blocked by default** on new buckets (and existing buckets in accounts that never used it); enable it explicitly only if you really need it.</li><li><b>Client-side encryption</b> — you encrypt before upload; S3 only sees ciphertext.</li></ul>',
      ],
    },
    {
      short: 'How SSE-KMS works', title: 'SSE-KMS is envelope encryption', tag: 'internals',
      scene: { nodes: [n('c', 110, 250, 'PutObject', { kind: 'code', sub: 'caller needs kms:GenerateDataKey' }), n('s3', 420, 250, 'S3', { kind: 's3' }), n('kms', 420, 80, 'KMS key (CMK)', { kind: 'kms', sub: 'never leaves KMS' }), n('dk', 760, 120, 'data key', { kind: 'key', sub: 'plaintext → encrypt object → discard' }), n('st', 760, 380, 'Stored: ciphertext + encrypted data key', { kind: 'obj' })],
        edges: [e('c', 's3'), e('s3', 'kms', 'GenerateDataKey'), e('kms', 'dk', 'plain + encrypted copy'), e('dk', 'st')],
        flows: [f('c>s3', '', { kind: 'code', every: 3.4 }), f('s3>kms', '', { kind: 's3', every: 3.4, delay: 0.7 }), f('kms>dk', '', { kind: 'kms', every: 3.4, delay: 1.4 }), f('dk>st', '', { kind: 'key', every: 3.4, delay: 2.1 })] },
      body: [
        'The KMS key itself never leaves KMS. On **upload**, S3 asks KMS for a **data key**: KMS returns it in plaintext *and* encrypted under your KMS key. S3 encrypts the object with the plaintext data key, throws that away, and stores the **encrypted data key** next to the object. On **download**, S3 sends the encrypted data key to KMS (`Decrypt`), gets the plaintext key back, decrypts the object, and discards the key again.',
        'So the *caller* needs, besides `s3:PutObject` / `s3:GetObject`: **`kms:GenerateDataKey`** to upload (multipart also needs **`kms:Decrypt`**), and **`kms:Decrypt`** to download — and the **key policy** must allow it. Cross-account readers need both the bucket policy *and* the key policy.',
        'KMS has request quotas per account and region (thousands to tens of thousands per second, depending on the region). A busy bucket calling KMS for every object can hit them and pay for every call — which is what Bucket Keys fix.',
      ],
    },
    {
      short: 'Bucket Keys', title: 'S3 Bucket Keys: up to 99% fewer KMS calls', tag: 'internals',
      scene: { nodes: [n('objs', 120, 250, '1 million PUTs', { kind: 'obj' }), n('bk', 460, 250, 'Bucket Key', { kind: 'kms', sub: 'short-lived, per bucket', state: 'active' }), n('kms', 800, 120, 'KMS', { kind: 'kms', sub: 'called occasionally' }), n('dks', 800, 380, 'unique data key per object', { kind: 'key', sub: 'made locally by S3' })],
        edges: [e('objs', 'bk'), e('bk', 'kms', 'rarely'), e('bk', 'dks', 'derives')],
        flows: [f('objs>bk', '', { kind: 'obj', every: 0.4 }), f('bk>dks', '', { kind: 'kms', every: 0.4, delay: 0.2 }), f('bk>kms', '', { kind: 'kms', every: 4 })] },
      body: [
        'With an [[bucket-key|S3 Bucket Key]], S3 asks KMS for a **bucket-level key** that it keeps for a limited time and uses to create the per-object data keys itself. KMS is called only when that bucket-level key is created or refreshed, cutting KMS requests — and their cost — **by up to 99%** and avoiding KMS throttling.',
        'Enable it in default encryption settings (*Bucket Key: Enable*) or per request. Trade-offs: CloudTrail KMS events show the **bucket ARN** as encryption context instead of each object ARN, so IAM/key-policy conditions on `kms:EncryptionContext:aws:s3:arn` must use the bucket ARN. It applies to SSE-KMS, not DSSE-KMS, and only affects new objects (copy existing ones to re-encrypt).',
      ],
      code: { file: 'default-encryption.sh', lang: 'bash', src: `
aws s3api put-bucket-encryption --bucket acme-data \\
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:eu-west-1:123456789012:key/1a2b3c4d-…"
      },
      "BucketKeyEnabled": true
    }]
  }'
aws s3api head-object --bucket acme-data --key x.csv   # ServerSideEncryption, BucketKeyEnabled`, hl: [6, 9] },
    },
    {
      short: 'In CDK', title: 'A locked-down, KMS-encrypted bucket in CDK', tag: 'code',
      scene: { nodes: [n('code', 130, 250, 'stack.ts', { kind: 'code' }), n('key', 450, 110, 'kms.Key', { kind: 'kms', sub: 'rotation on' }), n('b', 450, 380, 's3.Bucket', { kind: 's3', sub: 'KMS + Bucket Key + TLS 1.2' }), n('cf', 820, 250, 'CloudFront + OAC', { kind: 'cdn', sub: 'grants itself read' })],
        edges: [e('code', 'key'), e('code', 'b'), e('key', 'b', 'encrypts'), e('cf', 'b', 'reads')] },
      body: [
        '`encryptionKey` + `BucketEncryption.KMS` sets default encryption; `bucketKeyEnabled: true` turns on Bucket Keys; `enforceSSL` + `minimumTLSVersion` add the TLS policy; grants (`bucket.grantRead(role)`) automatically add `kms:Decrypt` on the key. For websites, `S3BucketOrigin.withOriginAccessControl()` wires CloudFront OAC and the bucket policy for you.',
      ],
      code: { file: 'lib/secure-bucket.ts', lang: 'ts', src: `
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const key = new kms.Key(this, 'DataKey', { enableKeyRotation: true, alias: 'alias/acme-data' });

const data = new s3.Bucket(this, 'Data', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: key,
  bucketKeyEnabled: true,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
  enforceSSL: true,
  minimumTLSVersion: 1.2,
});
data.grantRead(analyticsRole);            // s3:GetObject* + kms:Decrypt on the key

new cloudfront.Distribution(this, 'Site', {
  defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket) },
});`, hl: [9, 10, 11, 14, 17, 20] },
    },
    {
      short: 'Auditing', title: 'Seeing who accessed what', tag: 'concept',
      scene: { nodes: [n('b', 140, 250, 'Bucket', { kind: 's3' }), n('ct', 480, 90, 'CloudTrail data events', { kind: 'event', sub: 'Get/Put/Delete per object' }), n('sal', 480, 210, 'Server access logs', { kind: 'file', sub: 'best-effort, cheap' }), n('aa', 480, 330, 'Access Analyzer for S3', { kind: 'search', sub: 'public / external buckets' }), n('mac', 480, 450, 'Macie', { kind: 'eye', sub: 'finds PII in objects' })],
        edges: [e('b', 'ct'), e('b', 'sal'), e('b', 'aa'), e('b', 'mac')], h: 520 },
      body: [
        'CloudTrail logs bucket-level (management) calls by default; **object-level data events** (GetObject, PutObject, DeleteObject) must be enabled per trail or event data store — they are what you need for “who downloaded this file?”. **Server access logs** are cheaper, best-effort request logs. **IAM Access Analyzer** flags buckets shared publicly or with other accounts; **Amazon Macie** scans for sensitive data like card numbers and passport IDs.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'Is data in S3 encrypted by default?', a: ['Yes: since January 2023 every new object is encrypted at rest with SSE-S3 unless you choose another method. You still choose SSE-KMS when you need key-level access control and audit.'] },
    { lvl: 'J', q: 'How do you serve a private bucket as a public website?', a: ['Keep Block Public Access on and put CloudFront in front with Origin Access Control; the bucket policy allows only the CloudFront service principal for that distribution ARN.'] },
    { lvl: 'M', q: 'What permissions does a reader need for an SSE-KMS object?', a: ['s3:GetObject on the object and kms:Decrypt on the KMS key (allowed by the key policy). Writers need kms:GenerateDataKey (and kms:Decrypt for multipart).'] },
    { lvl: 'M', q: 'What is an S3 Bucket Key and why use it?', a: ['A time-limited bucket-level key derived from your KMS key that S3 uses to generate per-object data keys locally, reducing KMS requests by up to 99% — lower cost and no KMS throttling. Encryption context in CloudTrail becomes the bucket ARN.'] },
    { lvl: 'S', q: 'A partner account must upload files you can process, and nobody else may read them. Design it.', a: ['Bucket owner enforced (no ACLs); bucket policy allowing the partner role s3:PutObject on in/<partner>/* with aws:SecureTransport and a required KMS key; your customer-managed KMS key policy allowing the partner role kms:GenerateDataKey only via S3 (kms:ViaService) and your processor kms:Decrypt; Bucket Keys on; Block Public Access on; an access point per party if it grows; CloudTrail data events; an event notification to process new uploads.'], why: 'Combines bucket policy, KMS key policy and ownership.' },
  ],
  history: {
    timeline: [
      { yr: '2006–2011', title: 'ACLs and bucket policies', text: 'Per-object ACLs first; JSON bucket policies in 2010; SSE-S3 in 2011.' },
      { yr: '2014', title: 'SSE-KMS', text: 'Encryption with keys you control in KMS.' },
      { yr: '2018', title: 'Block Public Access', text: 'After many data leaks from public buckets, a master switch.', c: 'g' },
      { yr: '2020', title: 'S3 Bucket Keys', text: 'Up to 99% fewer KMS calls for SSE-KMS.' },
      { yr: '2023', title: 'Default encryption + secure defaults', text: 'SSE-S3 on every object (Jan); BPA on and ACLs off for new buckets (Apr); DSSE-KMS launched.' },
      { yr: 'Apr 2026', title: 'SSE-C off by default', text: 'Customer-provided-key encryption blocked unless explicitly enabled.', c: 'g' },
    ],
    alts: { cols: ['Encryption', 'Who holds the key', 'Audit per use', 'Pick when'], rows: [['SSE-S3', 'S3', 'no', 'default; most data'], ['SSE-KMS (aws/s3)', 'KMS, AWS-managed', 'yes', 'audit, but no key-policy control'], ['SSE-KMS (customer key) + Bucket Key', 'KMS, you control', 'yes', 'sensitive data, cross-account control'], ['DSSE-KMS', 'KMS, two layers', 'yes', 'compliance requiring dual layer'], ['SSE-C', 'you, every request', 'no', 'rare; blocked by default now'], ['Client-side', 'you', 'your system', 'S3 must never see plaintext']] },
  },
  quiz: [
    { q: 'Which overrides a bucket policy that allows `"Principal": "*"`?', o: ['Object Ownership', 'Block Public Access', 'Versioning', 'Lifecycle'], a: 1, why: 'BlockPublicPolicy / RestrictPublicBuckets.' },
    { q: 'Default encryption for new objects today?', o: ['none', 'SSE-S3', 'SSE-KMS', 'SSE-C'], a: 1, why: 'Since January 2023.' },
    { q: 'Uploading to an SSE-KMS bucket needs which KMS permission?', o: ['kms:Encrypt', 'kms:GenerateDataKey', 'kms:CreateKey', 'none'], a: 1, why: 'S3 requests a data key for each object (or bucket key).' },
    { q: 'Bucket Keys mainly reduce…', o: ['storage cost', 'KMS requests and cost', 'latency to CloudFront', 'object size'], a: 1, why: 'Up to 99% fewer KMS calls.' },
    { q: 'Recommended Object Ownership setting?', o: ['Object writer', 'Bucket owner preferred', 'Bucket owner enforced', 'ACL-based'], a: 2, why: 'ACLs disabled; policies only.' },
  ],
  cheat: `<h3>Access layers</h3><p>SCP/RCP → identity policy → bucket/access-point policy → Block Public Access → VPC endpoint policy → KMS key policy</p>
  <h3>Policy snippets</h3><pre>Deny if aws:SecureTransport = false · s3:TlsVersion &lt; 1.2
Allow cloudfront.amazonaws.com if AWS:SourceArn = distribution ARN (OAC)
aws:SourceVpce · aws:PrincipalOrgID · s3:x-amz-server-side-encryption-aws-kms-key-id</pre>
  <h3>Encryption</h3><table class="t"><tr><td>SSE-S3</td><td>default since 2023</td></tr><tr><td>SSE-KMS</td><td>kms:GenerateDataKey (PUT) · kms:Decrypt (GET)</td></tr><tr><td>Bucket Key</td><td>≤99% fewer KMS calls · context = bucket ARN</td></tr><tr><td>DSSE-KMS</td><td>dual layer</td></tr><tr><td>SSE-C</td><td>blocked by default since Apr 2026</td></tr></table>
  <h3>Defaults</h3><ul><li>BPA all four ON · Bucket owner enforced · SSE-S3 · SSE-C blocked</li></ul>`,
};
