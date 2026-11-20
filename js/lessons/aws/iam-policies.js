import { n, e, f, z } from '../../engine/build.js';

const legend = ['allow|#2f8a43', 'deny|#c0392b', 'not decided yet|#c6bbac'];

export default {
  id: 'iam-policies',
  title: 'IAM policies and how AWS decides: Allow or Deny',
  level: 'Intermediate',
  minutes: 40,
  tags: ['AWS', 'IAM', 'Security', 'CDK', 'Console'],
  summary: 'Read and write policy JSON with confidence: statements, actions, resources and conditions; identity-based vs resource-based policies; the exact evaluation logic (default deny, explicit deny wins); cross-account rules; guardrails such as permissions boundaries, SCPs and RCPs; and how to build, test and debug policies in the console, CLI and CDK.',
  learn: ['Policy anatomy: Effect, Action, Resource, Condition, Principal', 'Identity vs resource policies; AWS-managed vs customer-managed vs inline', 'The evaluation order, step by step', 'Same-account vs cross-account decisions', 'Condition keys, operators and policy variables', 'Boundaries, SCPs, RCPs and session policies as ceilings', 'Policy simulator, Access Analyzer and CDK grants'],
  steps: [
    {
      short: 'Anatomy', title: 'A policy is a list of statements', tag: 'code',
      scene: { nodes: [n('pol', 150, 250, 'Policy document', { kind: 'policy', sub: 'Version + Statement[]' }), n('eff', 500, 90, 'Effect', { kind: 'iam', sub: 'Allow | Deny' }), n('act', 500, 200, 'Action', { kind: 'code', sub: 's3:GetObject, s3:List*' }), n('res', 500, 310, 'Resource', { kind: 's3', sub: 'arn:aws:s3:::reports/*' }), n('cond', 500, 420, 'Condition (optional)', { kind: 'lock', sub: 'only over HTTPS, only with MFA…' })],
        edges: [e('pol', 'eff'), e('pol', 'act'), e('pol', 'res'), e('pol', 'cond')] },
      body: [
        'A [[policy]] is JSON with `"Version": "2012-10-17"` (always this exact date — it is the policy-language version, not today’s date) and a list of **statements**. Each statement says:',
        '<ul><li><b>Effect</b> — `Allow` or `Deny`.</li><li><b>Action</b> — API operations as `service:Operation`, e.g. `s3:GetObject`, wildcards allowed: `s3:Get*`, `s3:*`.</li><li><b>Resource</b> — the [[arn|ARNs]] it applies to. Note bucket vs objects: `arn:aws:s3:::reports` is the bucket (for `ListBucket`), `arn:aws:s3:::reports/*` is every object (for `GetObject`).</li><li><b>Condition</b> — optional extra tests.</li><li><b>Sid</b> — optional label for humans.</li></ul>',
      ],
      code: { file: 'read-reports.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListTheBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::reports"
    },
    {
      "Sid": "ReadObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::reports/*"
    }
  ]
}`, hl: [3, 8, 14] },
      callout: { kind: 'bad', title: 'Common mistake', text: 'Allowing `s3:ListBucket` on `arn:aws:s3:::reports/*` does nothing — ListBucket acts on the bucket ARN, GetObject on object ARNs. Half of all “why AccessDenied?” S3 questions are this.' },
    },
    {
      short: 'Where policies live', title: 'Identity-based vs resource-based policies', tag: 'concept',
      scene: { nodes: [n('role', 160, 160, 'Role: app', { kind: 'iam', sub: 'identity policy: Allow s3:GetObject' }), n('user', 160, 360, 'User: ada', { kind: 'user', sub: 'via group policy' }),
        n('bkt', 760, 250, 'Bucket: reports', { kind: 's3', sub: 'bucket policy (has Principal)' }), n('pol', 470, 250, 'Request', { kind: 'aws', sub: 'GetObject reports/q3.pdf' })],
        edges: [e('role', 'pol'), e('user', 'pol'), e('pol', 'bkt', 'both policies checked')], flows: [f('role>pol', '', { kind: 'iam', every: 2.6 }), f('pol>bkt', '', { kind: 'aws', every: 2.6, delay: 0.8 })] },
      body: [
        '<b>Identity-based</b> policies attach to a user, group or role and say what *that identity* can do. Three flavours: **AWS managed** (`ReadOnlyAccess`, maintained by AWS, can change over time), **customer managed** (your reusable, versioned policies — up to 6,144 characters each) and **inline** (embedded in one identity, deleted with it).',
        '<b>Resource-based</b> policies attach to a *resource* — S3 bucket policies, KMS key policies, SQS queue policies, Lambda resource policies, and a role’s [[trust-policy|trust policy]]. They contain a **Principal**: *who* the statement is about (an account, role, user, or service like `cloudfront.amazonaws.com`).',
        'A role can have 20 managed policies attached by default (raised from 10 in Aug 2026; up to 25 via Service Quotas); inline policy size limits are 2,048 characters (user), 5,120 (group) and 10,240 (role).',
      ],
      code: { file: 'bucket-policy.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LetAnalyticsAccountRead",
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::444455556666:role/analytics" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::reports/*"
  }]
}`, hl: [6] },
    },
    {
      short: 'Evaluation', title: 'The decision: default deny, explicit deny wins', tag: 'internals', legend,
      scene: { nodes: [n('req', 100, 250, 'Request', { kind: 'aws', sub: 'principal · action · resource · context' }),
        n('d1', 360, 90, '1 · Any explicit Deny?', { kind: 'policy', sub: 'in ANY applicable policy', state: 'bad' }),
        n('d2', 360, 250, '2 · Guardrails allow?', { kind: 'org', sub: 'SCP · RCP · boundary · session' }),
        n('d3', 360, 410, '3 · Any Allow?', { kind: 'policy', sub: 'identity or resource policy', state: 'ok' }),
        n('deny', 760, 150, 'DENY', { kind: 'note', icon: false, state: 'bad' }), n('allow', 760, 380, 'ALLOW', { kind: 'note', icon: false, state: 'ok' })],
        edges: [e('req', 'd1'), e('d1', 'deny', 'yes'), e('d1', 'd2', 'no'), e('d2', 'deny', 'no'), e('d2', 'd3', 'yes'), e('d3', 'allow', 'yes'), e('d3', 'deny', 'no → implicit deny', { style: 'dashed' })],
        flows: [f('req>d1', '', { kind: 'aws', every: 3.5 }), f('d1>d2', '', { kind: 'aws', every: 3.5, delay: 0.7 }), f('d2>d3', '', { kind: 'aws', every: 3.5, delay: 1.4 }), f('d3>allow', '', { kind: 'aws', every: 3.5, delay: 2.1 })], h: 500 },
      body: [
        'Every API request is evaluated against **all** policies that apply. Simplified for one account:',
        '<ol><li>Start with **implicit deny**.</li><li>If **any** applicable policy has a matching `Deny` → **denied**. Nothing can override an explicit deny.</li><li>Every **guardrail** that applies (SCP, RCP, permissions boundary, session policy) must allow the action — they never grant, they only limit.</li><li>If an identity-based **or** resource-based policy allows it → **allowed**. Otherwise the implicit deny stands.</li></ol>',
        'Remember it as: **Deny beats Allow, Allow beats nothing.**',
      ],
      interview: 'Expect: “A user has an Allow for s3:* and the bucket policy denies DeleteObject. Can they delete?” — No: explicit deny wins regardless of where the Allow came from.',
    },
    {
      short: 'Cross-account', title: 'Same account vs cross-account: who must say yes', tag: 'concept',
      scene: { zones: [z('a', 40, 80, 380, 340, 'Account A — caller', 'iam'), z('b', 600, 80, 380, 340, 'Account B — owner', 'aws')], nodes: [n('role', 230, 250, 'Role in A', { kind: 'iam', sub: 'identity policy: Allow' }), n('bkt', 790, 250, 'Bucket in B', { kind: 's3', sub: 'bucket policy: Allow A' })],
        edges: [e('role', 'bkt', 'both must allow')], flows: [f('role>bkt', 'GetObject', { kind: 'iam', every: 2.6 })] },
      body: [
        '**Same account:** an Allow in *either* the identity policy *or* the resource policy is enough (exceptions: KMS key policies and role trust policies must explicitly allow).',
        '**Cross-account:** *both* sides must agree. Account B’s resource policy must trust the principal from A, **and** A’s identity policy must allow the action. Account A cannot grant itself access to B’s data, and B cannot force A’s users to have it.',
        'For services without resource policies, cross-account access means **assuming a role** in the other account — next lesson.',
      ],
    },
    {
      short: 'Conditions', title: 'Conditions, operators and policy variables', tag: 'code',
      scene: { nodes: [n('req', 140, 250, 'Request context', { kind: 'aws', sub: 'SourceIp · MFA · tags · TLS · region' }), n('cond', 500, 250, 'Condition block', { kind: 'lock', sub: 'Operator: { key: value }' }), n('ok', 840, 160, 'matches → statement applies', { kind: 'note', icon: false, state: 'ok' }), n('no', 840, 340, 'no match → statement ignored', { kind: 'note', icon: false })],
        edges: [e('req', 'cond', 'compare'), e('cond', 'ok'), e('cond', 'no', '', { style: 'dashed' })] },
      body: [
        'A condition compares **context keys** with values using an **operator**. Global keys start with `aws:` — `aws:SourceIp`, `aws:SecureTransport`, `aws:MultiFactorAuthPresent`, `aws:RequestedRegion`, `aws:PrincipalTag/team`, `aws:ResourceTag/env`, `aws:PrincipalOrgID`. Services add their own: `s3:prefix`, `s3:x-amz-server-side-encryption`, `kms:ViaService`.',
        'Operators: `StringEquals`, `StringLike` (wildcards), `ArnLike`, `Bool`, `IpAddress`, `NumericLessThan`, `DateGreaterThan`… Add `IfExists` to pass when the key is absent; `ForAnyValue:` / `ForAllValues:` for multi-valued keys. Several keys in one block are ANDed; several values for one key are ORed.',
        '**Policy variables** make one policy per-person: `${aws:username}` or `${aws:PrincipalTag/team}` inside a Resource.',
      ],
      code: { file: 'home-folder.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::team-share",
      "Condition": { "StringLike": { "s3:prefix": ["home/\${aws:username}/*"] } } },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::team-share/home/\${aws:username}/*" },
    { "Effect": "Deny", "Action": "s3:*", "Resource": "*",
      "Condition": { "Bool": { "aws:SecureTransport": "false" } } }
  ]
}`, hl: [6, 8, 10] },
    },
    {
      short: 'Not* & deny', title: 'Deny statements, NotAction and NotResource', tag: 'concept', legend,
      scene: { nodes: [n('all', 160, 250, 'Allow *:* (admin)', { kind: 'policy', state: 'ok' }), n('deny', 520, 250, 'Deny NotAction (global services)', { kind: 'policy', sub: 'if region ∉ {eu-west-1}', state: 'bad' }), n('eff', 860, 250, 'Effective', { kind: 'iam', sub: 'admin, but only in Ireland' })],
        edges: [e('all', 'deny', 'combined'), e('deny', 'eff')] },
      body: [
        'Use explicit **Deny** for rules that must never be broken, whatever else gets attached later: deny non-TLS access, deny leaving a region, deny disabling CloudTrail, deny deleting backups.',
        '`NotAction` means “every action except these”, `NotResource` “every resource except these”. Paired with **Deny** they are powerful guardrails (deny everything outside eu-west-1 *except* global services like IAM). Paired with **Allow** they are dangerous — `Allow` + `NotAction: iam:*` grants every current and future action in every other service.',
      ],
      code: { file: 'region-lock.json', lang: 'json', src: `
{
  "Effect": "Deny",
  "NotAction": ["iam:*", "organizations:*", "sts:*", "cloudfront:*",
                "route53:*", "support:*", "budgets:*"],
  "Resource": "*",
  "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1"] } }
}`, hl: [2, 3, 6] },
    },
    {
      short: 'Guardrails', title: 'Ceilings: boundaries, SCPs, RCPs and session policies', tag: 'concept', legend,
      scene: { nodes: [n('scp', 500, 70, 'SCP (organization)', { kind: 'org', sub: 'max for principals in the account' }), n('rcp', 500, 160, 'RCP (organization)', { kind: 'org', sub: 'max for resources in the account' }), n('pb', 500, 250, 'Permissions boundary', { kind: 'policy', sub: 'max for one user/role' }), n('sp', 500, 340, 'Session policy', { kind: 'sts', sub: 'max for one assumed session' }), n('id', 500, 430, 'Identity policy', { kind: 'iam', sub: 'what is GRANTED', state: 'ok' }), n('eff', 880, 250, 'Effective permissions', { kind: 'iam', sub: '= intersection of all', state: 'active' })],
        edges: [e('scp', 'eff'), e('rcp', 'eff'), e('pb', 'eff'), e('sp', 'eff'), e('id', 'eff')], h: 500 },
      body: [
        'Only identity and resource policies **grant**. These four only **cap** what can be granted — effective permissions are the intersection:',
        '<ul><li><b>[[scp|Service Control Policies]]</b> (Organizations): the maximum for every IAM principal in member accounts — including their root user. Not the management account.</li><li><b>Resource Control Policies</b> (Organizations, since Nov 2024): the maximum for resources (S3, KMS, SQS, STS, Secrets Manager…) in member accounts — e.g. “no bucket here may be accessed from outside our org”.</li><li><b>[[permission-boundary|Permissions boundaries]]</b>: a managed policy set on a user/role. Classic use: let developers create roles for their Lambdas, but only with a boundary attached, so they cannot create something more powerful than themselves.</li><li><b>Session policies</b>: passed when assuming a role or federating, to narrow that one session.</li></ul>',
      ],
    },
    {
      short: 'Console tools', title: 'Building and testing policies in the console', tag: 'concept',
      scene: { nodes: [n('ed', 150, 150, 'Policy editor', { kind: 'iam', sub: 'visual or JSON' }), n('aa', 150, 350, 'Access Analyzer', { kind: 'search', sub: 'validate · generate · unused access' }), n('sim', 520, 250, 'Policy simulator', { kind: 'cpu', sub: 'would this be allowed?' }), n('la', 860, 250, 'Last accessed', { kind: 'clock', sub: 'services/actions really used' })],
        edges: [e('ed', 'sim'), e('aa', 'sim'), e('sim', 'la', 'then trim')] },
      body: [
        '**IAM → Policies → Create policy**: the *visual* editor picks service, actions, resources and conditions; the *JSON* tab shows the result. As you type, **IAM Access Analyzer policy validation** flags errors, security warnings (e.g. `iam:PassRole` with `*`) and suggestions.',
        '**Access Analyzer → Generate policy** reads up to 90 days of CloudTrail for a role and drafts a least-privilege policy from what it actually used. **Unused access** findings list roles, keys and permissions nobody uses. Each user/role also has a **Last accessed** tab per service and (for some services) per action.',
        'The **IAM policy simulator** (or `aws iam simulate-principal-policy`) answers “would Ada be allowed `s3:DeleteObject` on this ARN?” without touching anything.',
      ],
      code: { file: 'simulate.sh', lang: 'bash', src: `
aws iam simulate-principal-policy \\
  --policy-source-arn arn:aws:iam::123456789012:user/ada \\
  --action-names s3:GetObject s3:DeleteObject \\
  --resource-arns arn:aws:s3:::reports/q3.pdf \\
  --query "EvaluationResults[].[EvalActionName,EvalDecision]" --output table
# s3:GetObject      allowed
# s3:DeleteObject   implicitDeny`, hl: [1, 6, 7] },
    },
    {
      short: 'In CDK', title: 'Policies in CDK: statements and grants', tag: 'code',
      scene: { nodes: [n('code', 140, 250, 'stack.ts', { kind: 'code', sub: 'grantRead · addToPolicy' }), n('pol', 480, 150, 'AWS::IAM::Policy', { kind: 'policy', sub: 'least-privilege, generated' }), n('bp', 480, 350, 'AWS::S3::BucketPolicy', { kind: 'policy', sub: 'addToResourcePolicy' }), n('role', 820, 250, 'Role: worker', { kind: 'iam' })],
        edges: [e('code', 'pol'), e('code', 'bp'), e('pol', 'role', 'attached')] },
      body: [
        'Prefer **grant methods** on L2 constructs: `bucket.grantRead(role)`, `table.grantReadWriteData(fn)`, `queue.grantSendMessages(fn)`, `key.grantDecrypt(role)`. They write correct actions and ARNs (bucket *and* `/*`), and add KMS permissions when the bucket is KMS-encrypted.',
        'For anything else, build `PolicyStatement`s. Use `ManagedPolicy` for reusable customer-managed policies, `addToPrincipalPolicy` for identity policies and `addToResourcePolicy` for bucket/queue/key policies.',
      ],
      code: { file: 'lib/policies.ts', lang: 'ts', src: `
const role = new iam.Role(this, 'Worker', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

bucket.grantRead(role, 'incoming/*');          // s3:GetObject*, s3:List* … on bucket + prefix

role.addToPolicy(new iam.PolicyStatement({
  sid: 'WriteResults',
  actions: ['s3:PutObject'],
  resources: [bucket.arnForObjects('results/*')],
  conditions: { StringEquals: { 's3:x-amz-server-side-encryption': 'aws:kms' } },
}));

bucket.addToResourcePolicy(new iam.PolicyStatement({
  effect: iam.Effect.DENY,
  principals: [new iam.AnyPrincipal()],
  actions: ['s3:*'],
  resources: [bucket.bucketArn, bucket.arnForObjects('*')],
  conditions: { Bool: { 'aws:SecureTransport': 'false' } },   // = enforceSSL: true
}));`, hl: [5, 7, 14, 19] },
    },
    {
      short: 'Debug AccessDenied', title: 'Debugging AccessDenied like a pro', tag: 'scenario',
      scene: { nodes: [n('err', 140, 250, 'AccessDenied', { kind: 'note', icon: false, state: 'bad' }), n('msg', 440, 110, 'Read the message', { kind: 'search', sub: 'identity · action · resource · policy type' }), n('ct', 440, 250, 'CloudTrail event', { kind: 'event', sub: 'errorCode, userIdentity' }), n('sim', 440, 390, 'Simulate / last accessed', { kind: 'cpu' }), n('fix', 800, 250, 'Smallest correct fix', { kind: 'policy', state: 'ok' })],
        edges: [e('err', 'msg'), e('err', 'ct'), e('err', 'sim'), e('msg', 'fix'), e('ct', 'fix'), e('sim', 'fix')] },
      body: [
        'Modern AccessDenied messages tell you a lot: *User arn:…/ada is not authorized to perform s3:PutObject on resource arn:aws:s3:::reports/x because no identity-based policy allows the s3:PutObject action* — or *…with an explicit deny in a service control policy / resource-based policy / permissions boundary*.',
        'Checklist: (1) right identity? `sts get-caller-identity`; (2) right action name and ARN shape (bucket vs `/*`); (3) explicit deny anywhere — SCP, RCP, boundary, bucket policy, VPC endpoint policy; (4) cross-account: both sides allow? (5) KMS: does the key policy allow you? (6) conditions: MFA, source IP, TLS, tags.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'What happens if no policy mentions an action?', a: ['It is implicitly denied. IAM is default-deny; something must explicitly allow every action.'] },
    { lvl: 'J', q: 'Identity-based vs resource-based policy?', a: ['Identity-based attach to users/groups/roles and have no Principal. Resource-based attach to resources (bucket, key, queue, role trust) and name a Principal. Resource policies enable cross-account access without assuming a role.'] },
    { lvl: 'M', q: 'Explain IAM policy evaluation logic.', a: ['Implicit deny by default; any explicit Deny in any applicable policy wins; guardrails (SCP, RCP, boundary, session policy) must all allow; then an Allow in an identity or resource policy grants. Cross-account requires both the caller’s identity policy and the resource policy to allow.'] },
    { lvl: 'M', q: 'What is a permissions boundary for?', a: ['It caps the maximum permissions of a user or role. Typical use: delegate role creation to developers while requiring a boundary, preventing privilege escalation (they cannot create a role more powerful than allowed).'] },
    { lvl: 'M', q: 'Why is `Allow` with `NotAction` dangerous?', a: ['It grants every action except the listed ones — including actions in services added in the future. NotAction is safe mainly with Deny for guardrails.'] },
    { lvl: 'S', q: 'How would you guarantee that no S3 data in your organization can ever be read by an outside account, even if a developer writes a public bucket policy?', a: ['Layers: account-level and org-wide S3 Block Public Access; an RCP denying s3:* when aws:PrincipalOrgID is not your org (with exceptions for AWS service principals); SCPs denying changes to Block Public Access; Access Analyzer external-access findings; CloudTrail/Config alarms. Explicit denies at the org level cannot be overridden by account-level allows.'], why: 'Tests understanding of guardrails vs grants.' },
  ],
  history: {
    timeline: [
      { yr: '2010–2011', title: 'IAM policies', text: 'JSON policy language; version 2012-10-17 added policy variables and is still current.' },
      { yr: '2016', title: 'Permissions boundaries & policy simulator matured', text: 'Boundaries arrived in 2018 to enable safe delegation.' },
      { yr: '2017', title: 'Service Control Policies', text: 'Organization-wide guardrails for member accounts.' },
      { yr: '2019–2023', title: 'IAM Access Analyzer', text: 'External access findings, policy validation, policy generation, unused access.', c: 'g' },
      { yr: 'Nov 2024', title: 'Resource Control Policies', text: 'Organization-wide ceilings on what resources allow — the data perimeter in one policy.', c: 'g' },
    ],
    alts: { cols: ['Policy type', 'Grants?', 'Attached to', 'Typical use'], rows: [['Identity (managed/inline)', 'yes', 'user, group, role', 'what an identity may do'], ['Resource-based', 'yes', 'bucket, key, queue, role trust', 'who may use a resource; cross-account'], ['Permissions boundary', 'no (cap)', 'user, role', 'safe delegation'], ['SCP', 'no (cap)', 'OU / account', 'org guardrails for principals'], ['RCP', 'no (cap)', 'OU / account', 'data perimeter for resources'], ['Session policy', 'no (cap)', 'one session', 'narrow a temporary session']] },
  },
  quiz: [
    { q: 'Identity policy allows s3:*; bucket policy denies s3:DeleteObject for everyone. DeleteObject is…', o: ['allowed', 'denied', 'allowed with MFA', 'depends on the region'], a: 1, why: 'Explicit deny always wins.' },
    { q: 'Which ARN does `s3:ListBucket` need?', o: ['arn:aws:s3:::b/*', 'arn:aws:s3:::b', 'either', 'arn:aws:s3:::*/b'], a: 1, why: 'ListBucket acts on the bucket.' },
    { q: 'Same account: bucket policy allows role R to GetObject; R has no identity policy. Result?', o: ['Allowed', 'Denied', 'Needs a boundary', 'Needs an SCP'], a: 0, why: 'In the same account either side’s Allow is enough.' },
    { q: 'An SCP allows only s3:*. A role has AdministratorAccess. Can it create an EC2 instance?', o: ['Yes', 'No', 'Only in us-east-1', 'Only with MFA'], a: 1, why: 'SCPs cap permissions; ec2 is outside the cap.' },
    { q: 'Which tool drafts a least-privilege policy from real activity?', o: ['Policy simulator', 'Access Analyzer policy generation', 'Trusted Advisor', 'Config'], a: 1, why: 'It reads CloudTrail history.' },
  ],
  cheat: `<h3>Statement</h3><pre>{ "Sid": "…", "Effect": "Allow|Deny", "Principal": {…} (resource policies),
  "Action": "svc:Op" | ["svc:Get*"], "NotAction": …,
  "Resource": "arn:…" , "NotResource": …,
  "Condition": { "StringEquals": { "aws:PrincipalTag/team": "data" } } }</pre>
  <h3>Evaluation</h3><ol><li>explicit Deny anywhere → DENY</li><li>SCP / RCP / boundary / session policy must allow</li><li>identity OR resource Allow → ALLOW (cross-account: both)</li><li>else implicit DENY</li></ol>
  <h3>S3 ARNs</h3><table class="t"><tr><td>ListBucket</td><td>arn:aws:s3:::bucket</td></tr><tr><td>Get/Put/DeleteObject</td><td>arn:aws:s3:::bucket/*</td></tr></table>
  <h3>Useful keys</h3><p><code>aws:SecureTransport</code> <code>aws:MultiFactorAuthPresent</code> <code>aws:SourceIp</code> <code>aws:RequestedRegion</code> <code>aws:PrincipalOrgID</code> <code>aws:PrincipalTag/…</code> <code>s3:prefix</code></p>
  <h3>Tools</h3><pre>aws iam simulate-principal-policy …
Access Analyzer: validate · generate · unused access · external access</pre>`,
};
