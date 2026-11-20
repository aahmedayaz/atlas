import { n, e, f, z } from '../../engine/build.js';

export default {
  id: 'iam-roles',
  title: 'IAM roles and STS: borrowing permissions safely',
  level: 'Intermediate',
  minutes: 40,
  tags: ['AWS', 'IAM', 'STS', 'CDK', 'Console'],
  summary: 'What a role is (and isn’t), the two policies every role has, how AssumeRole hands out temporary credentials, service roles for Lambda and EC2, iam:PassRole, cross-account roles with external IDs, GitHub Actions with OIDC, and building all of it in the console and in CDK.',
  learn: ['Role = permissions policy + trust policy, no long-term credentials', 'What STS AssumeRole returns and how long it lasts', 'Service roles: Lambda execution roles and EC2 instance profiles', 'iam:PassRole and privilege escalation', 'Cross-account roles, external IDs and role chaining', 'OIDC federation for CI (GitHub Actions)', 'Creating roles in the console and in CDK'],
  steps: [
    {
      short: 'What a role is', title: 'A role is a hat anyone trusted can wear', tag: 'concept',
      scene: { nodes: [n('who', 150, 250, 'Trusted principal', { kind: 'user', sub: 'user · service · other account' }), n('role', 500, 250, 'Role: ReportsReader', { kind: 'iam', sub: 'no password · no keys', state: 'active' }), n('tp', 500, 90, 'Trust policy', { kind: 'policy', sub: 'WHO may assume' }), n('pp', 500, 410, 'Permissions policy', { kind: 'policy', sub: 'WHAT the role can do' }), n('res', 860, 250, 'S3: reports', { kind: 's3' })],
        edges: [e('who', 'role', 'assume'), e('tp', 'role', '', { style: 'dashed' }), e('pp', 'role', '', { style: 'dashed' }), e('role', 'res', 'acts as role')],
        flows: [f('who>role', 'AssumeRole', { kind: 'sts', every: 3 }), f('role>res', 'GetObject', { kind: 'iam', every: 3, delay: 1 })] },
      body: [
        'An [[iam-role|IAM role]] is an identity with permissions but **no password and no access keys**. Instead, a trusted principal *assumes* it and receives [[temp-creds|temporary credentials]] for that role. While using them, AWS sees the role — not the original caller (though CloudTrail records who assumed it).',
        'Every role has exactly two kinds of policy:',
        '<ul><li><b>[[trust-policy|Trust policy]]</b> — a resource-based policy on the role saying *who* may assume it (`Principal` + `sts:AssumeRole`).</li><li><b>Permissions policies</b> — normal identity policies saying *what* the role can do.</li></ul>',
        'Roles are used for: AWS services acting for you (Lambda, EC2, ECS, CloudFormation), people switching into other accounts, federated users (Identity Center, SAML, OIDC) and CI systems.',
      ],
    },
    {
      short: 'AssumeRole', title: 'STS AssumeRole: what you get back', tag: 'internals',
      scene: { nodes: [n('caller', 120, 250, 'Caller', { kind: 'cli', sub: 'has some credentials' }), n('sts', 440, 250, 'STS', { kind: 'sts', sub: 'checks trust + caller permission' }), n('creds', 780, 150, 'AccessKeyId ASIA… · Secret · SessionToken', { kind: 'key', sub: 'Expiration: +1h' }), n('role', 780, 360, 'arn:…:assumed-role/ReportsReader/ada', { kind: 'iam', sub: 'session identity' })],
        edges: [e('caller', 'sts', 'AssumeRole(RoleArn, SessionName)'), e('sts', 'creds'), e('sts', 'role')],
        flows: [f('caller>sts', '', { kind: 'cli', every: 3 }), f('sts>creds', '', { kind: 'sts', every: 3, delay: 0.8 })] },
      body: [
        '[[sts|STS]] allows the call only if **both** are true: the role’s trust policy trusts the caller, **and** (for IAM users/roles) the caller’s own policies allow `sts:AssumeRole` on that role ARN (same-account trust of a specific user ARN is enough on its own).',
        'It returns an access key ID starting `ASIA`, a secret, a **session token** and an expiration. The default duration is 1 hour; `DurationSeconds` can be 15 minutes up to the role’s *maximum session duration* (1–12 hours). **Role chaining** (using a role’s credentials to assume another role) is capped at 1 hour.',
        'Temporary credentials cannot be individually revoked. To cut off sessions, use the console’s *Revoke active sessions* (adds a deny for tokens issued before now) or wait for expiry.',
      ],
      code: { file: 'assume.sh', lang: 'bash', src: `
aws sts assume-role \\
  --role-arn arn:aws:iam::123456789012:role/ReportsReader \\
  --role-session-name ada-debug --duration-seconds 3600
# {
#   "Credentials": { "AccessKeyId": "ASIA...", "SecretAccessKey": "...",
#                    "SessionToken": "IQoJb3JpZ2luX2VjE...", "Expiration": "2026-11-20T08:15:00Z" },
#   "AssumedRoleUser": { "Arn": "arn:aws:sts::123456789012:assumed-role/ReportsReader/ada-debug" }
# }
export AWS_ACCESS_KEY_ID=ASIA... AWS_SECRET_ACCESS_KEY=... AWS_SESSION_TOKEN=...
aws sts get-caller-identity   # → assumed-role/ReportsReader/ada-debug`, hl: [1, 6, 10] },
    },
    {
      short: 'Trust policies', title: 'Reading trust policies', tag: 'code',
      scene: { nodes: [n('svc', 160, 120, 'lambda.amazonaws.com', { kind: 'lambda', sub: 'Service principal' }), n('acct', 160, 250, 'arn:aws:iam::444455556666:root', { kind: 'aws', sub: 'another account' }), n('fed', 160, 380, 'token.actions.githubusercontent.com', { kind: 'git', sub: 'OIDC provider' }), n('role', 600, 250, 'Trust policy', { kind: 'policy', sub: 'Principal + Action + Condition' })],
        edges: [e('svc', 'role', 'sts:AssumeRole'), e('acct', 'role', 'sts:AssumeRole'), e('fed', 'role', 'sts:AssumeRoleWithWebIdentity')] },
      body: [
        'A trust policy’s **Principal** decides who may assume: a **service** (`lambda.amazonaws.com`), an **account** (`arn:aws:iam::444455556666:root` — means “that account, if its own IAM also allows”), a specific **user or role ARN**, or a **federated** identity provider (SAML or OIDC).',
        'Conditions narrow it: `sts:ExternalId` for third parties, `aws:MultiFactorAuthPresent` for humans, `aws:SourceArn` / `aws:SourceAccount` so a service can only assume your role *on behalf of your own resources* (the “confused deputy” protection).',
      ],
      code: { file: 'trust-lambda.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole",
    "Condition": { "StringEquals": { "aws:SourceAccount": "123456789012" } }
  }]
}`, hl: [5, 6, 7] },
    },
    {
      short: 'Service roles', title: 'Service roles: Lambda execution roles and EC2 instance profiles', tag: 'concept',
      scene: { nodes: [n('fn', 150, 140, 'Lambda function', { kind: 'lambda', sub: 'execution role' }), n('ec2', 150, 360, 'EC2 instance', { kind: 'server', sub: 'instance profile → role' }), n('sts', 470, 250, 'STS', { kind: 'sts', sub: 'auto-refreshing creds' }), n('sdk', 760, 250, 'SDK in your code', { kind: 'code', sub: 'no keys in code!' }), n('s3', 1000, 250, 'S3', { kind: 's3' })],
        edges: [e('fn', 'sts'), e('ec2', 'sts', 'IMDSv2'), e('sts', 'sdk', 'env / metadata'), e('sdk', 's3')],
        flows: [f('fn>sts', '', { kind: 'lambda', every: 3 }), f('ec2>sts', '', { kind: 'server', every: 3, delay: 0.5 }), f('sts>sdk', 'temp creds', { kind: 'sts', every: 3, delay: 1 }), f('sdk>s3', '', { kind: 'code', every: 3, delay: 1.6 })] },
      body: [
        'A **Lambda execution role** is assumed by the Lambda service for every invocation; your code receives the credentials as environment variables and the SDK picks them up automatically. Minimum: `AWSLambdaBasicExecutionRole` (write CloudWatch Logs) plus what your function needs.',
        'An **EC2 instance profile** is a container that puts one role on an instance; the SDK fetches credentials from the instance metadata service (use IMDSv2, which requires a session token and blocks SSRF tricks). ECS tasks and EKS pods have their own task roles / Pod Identity.',
        'Result: **zero access keys in code or config**. If you ever see keys in a Lambda environment variable, that is a bug.',
      ],
    },
    {
      short: 'PassRole', title: 'iam:PassRole — the permission people forget', tag: 'concept',
      scene: { nodes: [n('dev', 140, 250, 'Developer', { kind: 'user', sub: 'lambda:CreateFunction' }), n('pass', 470, 250, 'iam:PassRole?', { kind: 'policy', sub: 'on which role ARNs?' }), n('admin', 820, 140, 'AdminRole', { kind: 'iam', sub: 'escalation!', state: 'bad' }), n('app', 820, 360, 'app-* roles', { kind: 'iam', sub: 'allowed', state: 'ok' })],
        edges: [e('dev', 'pass', 'create function with role'), e('pass', 'admin', 'deny', { style: 'dashed' }), e('pass', 'app', 'allow')] },
      body: [
        'To *give* a role to a service — set a Lambda’s execution role, attach an instance profile, pass a role to CloudFormation or ECS — the caller needs [[passrole|`iam:PassRole`]] on that role.',
        'Why: otherwise anyone who can create a Lambda could attach an admin role to it and run code as admin — a privilege escalation. So scope PassRole to specific role ARNs and the right service with `iam:PassedToService`.',
      ],
      code: { file: 'passrole.json', lang: 'json', src: `
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::123456789012:role/app-*",
  "Condition": { "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" } }
}`, hl: [3, 4, 5] },
    },
    {
      short: 'Cross-account', title: 'Cross-account roles and external IDs', tag: 'concept',
      scene: { zones: [z('a', 30, 70, 400, 360, 'Account A (yours)', 'iam'), z('b', 600, 70, 400, 360, 'Account B (prod)', 'aws')], nodes: [n('ada', 230, 170, 'ada (A)', { kind: 'user', sub: 'Allow sts:AssumeRole on B role' }), n('vendor', 230, 340, 'Vendor SaaS', { kind: 'aws', sub: 'sends ExternalId' }), n('role', 800, 250, 'Role: Deployer (B)', { kind: 'iam', sub: 'trusts A (+ MFA / ExternalId)' })],
        edges: [e('ada', 'role', 'Switch role'), e('vendor', 'role', 'AssumeRole + ExternalId', { style: 'dashed' })],
        flows: [f('ada>role', 'MFA', { kind: 'sts', every: 3 }), f('vendor>role', '', { kind: 'aws', every: 3, delay: 1.2 })] },
      body: [
        'To work in account B, create a role **in B** whose trust policy names account A (or a specific role in A), and allow `sts:AssumeRole` on that role in A. In the console: account menu → **Switch role** → account ID + role name. In the CLI: a profile with `role_arn` + `source_profile`.',
        'Third-party vendors (monitoring, cost tools) use the same pattern plus an **external ID**: a secret-ish value unique to you, required by `sts:ExternalId` in the trust policy. It stops another customer of that vendor from tricking the vendor into accessing *your* account (the confused-deputy problem).',
      ],
    },
    {
      short: 'OIDC for CI', title: 'GitHub Actions without stored keys (OIDC)', tag: 'code',
      scene: { nodes: [n('gh', 140, 250, 'GitHub Actions job', { kind: 'git', sub: 'repo acme/web, branch main' }), n('tok', 440, 120, 'OIDC token (JWT)', { kind: 'sts', sub: 'signed by GitHub' }), n('sts', 440, 380, 'STS AssumeRoleWithWebIdentity', { kind: 'sts' }), n('role', 800, 250, 'Role: gh-deploy', { kind: 'iam', sub: 'trust: sub = repo:acme/web:ref:refs/heads/main' })],
        edges: [e('gh', 'tok', 'request'), e('tok', 'sts', 'present'), e('sts', 'role', 'temp creds')],
        flows: [f('gh>tok', '', { kind: 'git', every: 3.2 }), f('tok>sts', '', { kind: 'sts', every: 3.2, delay: 0.8 }), f('sts>role', '1 h creds', { kind: 'sts', every: 3.2, delay: 1.6 })] },
      body: [
        'Instead of saving access keys as GitHub secrets, register GitHub as an **OIDC identity provider** in IAM and create a role that trusts it. Each job gets a short-lived signed token describing the repo, branch and environment; STS exchanges it for temporary credentials.',
        'The **`sub` condition is the security boundary**: restrict it to your repo and branch/environment. A trust policy that only checks the audience would let *any* GitHub repository assume your role.',
      ],
      code: { file: 'lib/github-oidc.ts', lang: 'ts', src: `
const provider = new iam.OpenIdConnectProvider(this, 'GitHub', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

const deployRole = new iam.Role(this, 'GhDeploy', {
  assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
    StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
    StringLike: { 'token.actions.githubusercontent.com:sub': 'repo:acme/web:ref:refs/heads/main' },
  }),
  maxSessionDuration: Duration.hours(1),
});
// workflow: permissions: id-token: write
//   - uses: aws-actions/configure-aws-credentials@v4
//     with: { role-to-assume: <GhDeploy ARN>, aws-region: eu-west-1 }`, hl: [8, 9, 10] },
    },
    {
      short: 'Console', title: 'Creating a role in the console', tag: 'concept',
      scene: { nodes: [n('s1', 200, 130, '1 · Trusted entity', { kind: 'iam', sub: 'service · account · web identity\nSAML · custom JSON' }), n('s2', 620, 130, '2 · Permissions', { kind: 'policy', sub: 'attach policies · boundary' }), n('s3', 620, 340, '3 · Name & review', { kind: 'file', sub: 'trust JSON shown' }), n('use', 200, 340, 'Use it', { kind: 'sts', sub: 'Switch role / service setting' })],
        edges: [e('s1', 's2'), e('s2', 's3'), e('s3', 'use')], flows: [f('s1>s2', '', { kind: 'iam', every: 3 }), f('s2>s3', '', { kind: 'iam', every: 3, delay: 0.7 }), f('s3>use', '', { kind: 'sts', every: 3, delay: 1.4 })] },
      body: [
        '**IAM → Roles → Create role.** Step 1 *Select trusted entity*: **AWS service** (pick Lambda, EC2…), **AWS account** (this or another, optional *Require external ID* / *Require MFA*), **Web identity**, **SAML 2.0 federation**, or **Custom trust policy** (write JSON). Step 2 attach permission policies and optionally a permissions boundary. Step 3 name it and review the generated trust policy.',
        'Afterwards: the role’s **Trust relationships** tab edits who may assume it; **Maximum session duration** (1–12 h) is in the summary; **Revoke sessions** kills existing sessions; **Last accessed** shows what it really uses.',
      ],
    },
    {
      short: 'In CDK', title: 'Roles in CDK: principals, grants and boundaries', tag: 'code',
      scene: { nodes: [n('code', 140, 250, 'stack.ts', { kind: 'code' }), n('role', 470, 150, 'AWS::IAM::Role', { kind: 'iam', sub: 'trust from assumedBy' }), n('pol', 470, 350, 'AWS::IAM::Policy', { kind: 'policy', sub: 'from grants' }), n('fn', 800, 250, 'Lambda', { kind: 'lambda', sub: 'uses the role' })],
        edges: [e('code', 'role'), e('code', 'pol'), e('role', 'fn'), e('pol', 'role', '', { style: 'dashed' })] },
      body: [
        '`new iam.Role(this, id, { assumedBy })` writes the trust policy for you: `ServicePrincipal`, `AccountPrincipal`, `ArnPrincipal`, `WebIdentityPrincipal`, `CompositePrincipal` (several). `role.grantAssumeRole(principal)` allows another identity to assume it.',
        'Most of the time you don’t create Lambda roles at all — `new lambda.Function()` creates one, and grants (`bucket.grantRead(fn)`) add policies to it. Use `PermissionsBoundary.of(this).apply(policy)` to put a boundary on every role in a stack or app.',
      ],
      code: { file: 'lib/roles.ts', lang: 'ts', src: `
const readerRole = new iam.Role(this, 'ReportsReader', {
  assumedBy: new iam.AccountPrincipal('444455556666')
    .withConditions({ StringEquals: { 'sts:ExternalId': 'acme-7f3k' } }),
  maxSessionDuration: Duration.hours(2),
  description: 'Analytics account reads reports',
});
reportsBucket.grantRead(readerRole);

const fn = new lambda.Function(this, 'Worker', { /* … */ });  // role auto-created
reportsBucket.grantReadWrite(fn);                            // policy added to fn.role

const boundary = iam.ManagedPolicy.fromManagedPolicyName(this, 'B', 'DevBoundary');
iam.PermissionsBoundary.of(this).apply(boundary);            // every role in this stack`, hl: [3, 4, 7, 10, 13] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'Role vs user?', a: ['A user has long-term credentials and belongs to one person/program. A role has none; it is assumed by trusted principals who receive temporary credentials. Roles are preferred for workloads, cross-account access and federation.'] },
    { lvl: 'J', q: 'How does a Lambda function get AWS credentials?', a: ['Through its execution role: Lambda assumes it and injects temporary credentials as environment variables, which the SDK uses automatically. No keys in code.'] },
    { lvl: 'M', q: 'What is iam:PassRole and why does it exist?', a: ['Permission to hand a role to an AWS service (Lambda, EC2, ECS, CloudFormation). Without it, anyone able to create resources could attach a more powerful role and escalate privileges. Scope it to specific role ARNs and iam:PassedToService.'] },
    { lvl: 'M', q: 'What is an external ID and the confused deputy problem?', a: ['A third party (deputy) acting for many customers could be tricked into using its access on a victim’s account by another customer supplying the victim’s role ARN. Requiring a per-customer external ID in the trust policy prevents it. For AWS services, aws:SourceArn/aws:SourceAccount conditions play the same role.'] },
    { lvl: 'S', q: 'Design CI/CD access for 30 repos deploying into dev/staging/prod accounts.', a: ['GitHub OIDC provider in a tools account (or each target); per-repo/per-environment roles whose trust policy pins sub to repo + environment (prod requires a protected environment); those roles can only assume the CDK bootstrap deploy roles in targets; bootstrap targets with --trust for the tools account and restricted execution policies; short session durations; no stored keys; CloudTrail alerts on AssumeRoleWithWebIdentity from unexpected subs.'], why: 'Combines OIDC, cross-account trust and CDK bootstrap.' },
  ],
  history: {
    timeline: [
      { yr: '2011', title: 'STS and federation', text: 'Temporary credentials and federated users arrived soon after IAM.' },
      { yr: '2012', title: 'IAM roles for EC2', text: 'Instances got credentials without baked-in keys — the start of “no keys in code”.', c: 'g' },
      { yr: '2014–2015', title: 'Cross-account roles and Switch Role', text: 'Console account switching; Lambda launched with execution roles (2014).' },
      { yr: '2019', title: 'IMDSv2', text: 'Session-token metadata service to block SSRF credential theft.' },
      { yr: '2021', title: 'GitHub Actions OIDC', text: 'CI pipelines assume roles with short-lived tokens instead of stored keys.', c: 'g' },
    ],
    alts: { cols: ['Who needs access', 'Mechanism', 'Credential'], rows: [['AWS service (Lambda, EC2, ECS)', 'service role / instance profile', 'auto-rotated temp'], ['Person in another account', 'cross-account role (Switch role)', 'temp, MFA'], ['Workforce users', 'IAM Identity Center permission sets', 'temp'], ['CI/CD (GitHub, GitLab)', 'OIDC + AssumeRoleWithWebIdentity', 'temp, per job'], ['Third-party SaaS', 'cross-account role + external ID', 'temp'], ['Non-AWS servers', 'IAM Roles Anywhere (X.509)', 'temp']] },
  },
  quiz: [
    { q: 'Which policy says WHO may assume a role?', o: ['Permissions policy', 'Trust policy', 'SCP', 'Session policy'], a: 1, why: 'The trust policy is the role’s resource policy.' },
    { q: 'Temporary credentials’ access key IDs start with…', o: ['AKIA', 'ASIA', 'AROA', 'AIDA'], a: 1, why: 'AROA is a role’s unique ID, AIDA a user’s.' },
    { q: 'Max duration when chaining from one role into another?', o: ['15 min', '1 hour', '12 hours', 'unlimited'], a: 1, why: 'Role chaining is capped at one hour.' },
    { q: 'A developer can create Lambdas but gets AccessDenied when choosing an existing role. Missing permission?', o: ['lambda:InvokeFunction', 'iam:PassRole', 'sts:AssumeRole', 'iam:CreateRole'], a: 1, why: 'Passing a role to a service requires iam:PassRole.' },
    { q: 'In a GitHub OIDC trust policy, which condition prevents other repos from assuming the role?', o: ['aud', 'sub', 'iss', 'exp'], a: 1, why: 'sub encodes repo and ref/environment.' },
  ],
  cheat: `<h3>Role = trust + permissions</h3><pre>trust: { "Principal": { "Service": "lambda.amazonaws.com" | "AWS": "arn:…:root" | "Federated": "arn:…:oidc-provider/…" },
         "Action": "sts:AssumeRole | sts:AssumeRoleWithWebIdentity | sts:AssumeRoleWithSAML" }</pre>
  <h3>STS</h3><ul><li>Returns ASIA key + secret + session token + expiration</li><li>15 min – role max (1–12 h); chaining ≤ 1 h</li><li>Revoke: “Revoke active sessions” (deny tokens issued before now)</li></ul>
  <h3>Must-knows</h3><ul><li>iam:PassRole scoped to role ARNs + iam:PassedToService</li><li>Third parties: sts:ExternalId · services: aws:SourceArn / aws:SourceAccount</li><li>OIDC CI: pin token…:sub to repo + branch/environment</li><li>EC2: instance profile + IMDSv2 · Lambda: execution role</li></ul>
  <h3>CDK</h3><pre>new iam.Role(this, 'R', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') })
bucket.grantRead(role) · role.grantAssumeRole(principal) · PermissionsBoundary.of(this).apply(p)</pre>`,
};
