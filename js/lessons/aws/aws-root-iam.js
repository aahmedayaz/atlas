import { n, e, f, z } from '../../engine/build.js';

const you = (o = {}) => n('you', 110, 250, 'You', { kind: 'user', sub: o.sub || 'laptop + browser', ...o });
const root = (o = {}) => n('root', 470, 150, 'Root user', { kind: 'root', sub: o.sub || 'email + password', ...o });
const iamSvc = (o = {}) => n('iam', 470, 330, 'IAM', { kind: 'iam', sub: o.sub || 'users · groups · roles · policies', ...o });
const res = (o = {}) => n('res', 820, 250, 'Resources', { kind: 'aws', sub: o.sub || 'S3 · Lambda · EC2 · billing', ...o });
const acct = (h = 300) => z('acct', 320, 70, 620, h, 'AWS account 1234-5678-9012', 'aws');

export default {
  id: 'aws-root-iam',
  title: 'Your AWS account: root user vs IAM users',
  level: 'Beginner',
  minutes: 30,
  tags: ['AWS', 'IAM', 'Security', 'Console'],
  summary: 'What an AWS account really is, why the root user is a master key you lock away, how IAM users, groups and access keys work in the console and CLI, which credentials exist and how they differ, and what modern AWS recommends instead of long-lived keys.',
  learn: ['Account ID, regions and what lives “inside” an account', 'What only the root user can do — and how to lock it away (MFA, no keys, centralized root access)', 'Creating IAM users and groups in the console, CLI and CDK', 'Every credential type: password, access keys, temporary credentials', 'How a request is signed (SigV4) and why leaked keys are so dangerous', 'Modern sign-in: IAM Identity Center and `aws login`'],
  steps: [
    {
      short: 'The account', title: 'An AWS account is a sealed box with one bill', tag: 'concept',
      scene: { zones: [acct()], nodes: [you(), root({ state: 'dim' }), iamSvc({ state: 'dim' }), res({ state: 'active' })], edges: [e('you', 'res', 'sign up: email, card, phone')],
        flows: [f('you>res', 'sign up', { kind: 'user', every: 2.4 })] },
      facts: [['account ID', '12 digits'], ['regions', '30+'], ['bill', '1 per account'], ['default limits', 'per account']],
      body: [
        'When you sign up you get an [[aws-account]]: a container with a 12-digit **account ID** (e.g. `123456789012`). Every resource you create — a bucket, a function, a database — belongs to exactly one account, and the account receives one bill.',
        'Inside the account, most resources live in one [[region]] (like `us-east-1` or `eu-west-1`), and each region has several [[az|Availability Zones]]. A few services are **global**: IAM, CloudFront, Route 53, Organizations.',
        'The account is also the strongest wall in AWS. Nothing in account A can touch account B unless both sides explicitly allow it. That is why companies use many accounts (dev, staging, prod) under [[organizations|AWS Organizations]].',
      ],
      callout: { kind: 'tip', title: 'Think of it as', text: 'A rented building with its own address (account ID), its own electricity bill, and walls nobody else can walk through.' },
    },
    {
      short: 'Root user', title: 'The root user: the master key', tag: 'concept',
      scene: { zones: [acct()], nodes: [you(), root({ state: 'upd', sub: 'can do EVERYTHING' }), iamSvc({ state: 'dim' }), res({ state: 'active' })], edges: [e('you', 'root', 'email + password + MFA'), e('root', 'res', 'unrestricted')],
        flows: [f('you>root', 'sign in', { kind: 'user', every: 2.6 }), f('root>res', 'any action', { kind: 'root', every: 2.6, delay: 0.8 })] },
      body: [
        'The email address you signed up with becomes the [[root-user]]. It has complete access to every service and every resource in the account, and **IAM policies cannot restrict it** in its own account (only an [[scp|SCP]] can, and only for member accounts in an organization).',
        'A handful of tasks can **only** be done as root, for example:',
        '<ul><li>change the account’s root email, name or password; close the account</li><li>change some billing/tax settings and the AWS Support plan</li><li>restore permissions when every IAM admin has been locked out</li><li>delete an S3 bucket policy (or SQS queue policy) that accidentally denies everyone</li><li>enable **MFA Delete** on an S3 bucket</li></ul>',
        'Everything else should be done with IAM identities. Using root day-to-day is like carrying the building’s master key to buy coffee.',
      ],
      interview: 'A classic question: “Name things only the root user can do.” Mention account closure/contact changes, MFA Delete on S3, recovering from a bucket policy that denies everyone, and restoring admin access — then say you never use root for daily work.',
    },
    {
      short: 'Lock root', title: 'Locking the root user away', tag: 'concept',
      scene: { zones: [acct()], nodes: [you(), root({ state: 'ok', sub: 'MFA · no access keys' }), n('mfa', 110, 420, 'Passkey / security key', { kind: 'mfa', sub: 'second factor' }), iamSvc({ state: 'dim' }), res({ state: 'dim' })],
        edges: [e('you', 'root', 'password'), e('mfa', 'root', 'proof', { style: 'dashed' })],
        flows: [f('you>root', 'password', { kind: 'user', every: 2.6 }), f('mfa>root', 'tap', { kind: 'mfa', every: 2.6, delay: 0.6 })] },
      facts: [['MFA', 'required'], ['root access keys', 'none'], ['used for', 'rare root tasks'], ['alarm', 'on root sign-in']],
      body: [
        '[[mfa|MFA]] is now **mandatory** for root users of every account type (management, member and standalone). Prefer a **passkey or FIDO2 security key** over an authenticator-app code — it cannot be phished. Register more than one device.',
        '**Never create root access keys.** If old ones exist, delete them (IAM console → Security credentials). Keep the root password in a password manager, set **alternate contacts** (billing, operations, security), and alarm on any root sign-in using CloudTrail + EventBridge.',
        'With [[organizations|AWS Organizations]] you can go further: **centralized root access** lets the management account delete root credentials from member accounts entirely and run the few privileged root tasks centrally (with short-lived `sts:AssumeRoot` sessions). New member accounts are created without root credentials.',
      ],
      code: { file: 'root-signin-alarm.json', lang: 'json', src: `
{
  "source": ["aws.signin"],
  "detail-type": ["AWS Console Sign In via CloudTrail"],
  "detail": {
    "userIdentity": { "type": ["Root"] }
  }
}
// EventBridge rule pattern → send to SNS/email: "someone signed in as root"`, hl: [4, 5] },
    },
    {
      short: 'IAM pieces', title: 'IAM: users, groups, roles and policies', tag: 'concept',
      scene: { zones: [acct(360), z('iamz', 340, 210, 260, 200, 'IAM (global)', 'iam')], nodes: [you(), root({ state: 'dim' }),
        n('user', 470, 260, 'IAM user: ada', { kind: 'user', sub: 'password · MFA' }), n('grp', 470, 350, 'Group: Developers', { kind: 'org', sub: 'policies attached' }),
        n('pol', 820, 380, 'Policy (JSON)', { kind: 'policy', sub: 'Allow s3:GetObject …' }), res()],
        edges: [e('you', 'user', 'sign in'), e('user', 'grp', 'member of', { style: 'dashed' }), e('pol', 'grp', 'attached', { style: 'dashed' }), e('user', 'res', 'allowed calls')],
        flows: [f('you>user', 'sign in', { kind: 'user', every: 2.6 }), f('user>res', 'API call', { kind: 'iam', every: 2.6, delay: 0.8 })] },
      body: [
        '[[iam|IAM]] is free and global. It has four building blocks:',
        '<ul><li><b>[[iam-user|User]]</b> — a long-lived identity for one person or one program, with an optional console password and optional access keys.</li><li><b>[[iam-group|Group]]</b> — a bag of users that share policies. Groups are not identities: you cannot sign in as a group, and groups cannot contain groups.</li><li><b>[[iam-role|Role]]</b> — an identity with no password or keys; whoever is trusted can <i>assume</i> it and receive temporary credentials. (Next lessons.)</li><li><b>[[policy|Policy]]</b> — JSON that says Allow/Deny which actions on which resources.</li></ul>',
        'A brand-new IAM user has **no permissions at all**. Everything is denied until a policy allows it — this “default deny” is the most important IAM rule.',
      ],
    },
    {
      short: 'Create user', title: 'Creating an IAM user: console, CLI and sign-in URL', tag: 'code',
      scene: { zones: [acct(360)], nodes: [you({ sub: 'admin' }), n('con', 470, 170, 'IAM console', { kind: 'iam', sub: 'Users → Create user' }), n('user', 470, 330, 'IAM user: ada', { kind: 'user', sub: 'console access ✓', state: 'upd' }), n('url', 820, 250, 'Sign-in URL', { kind: 'browser', sub: 'acme.signin.aws.amazon.com/console' })],
        edges: [e('you', 'con', 'create'), e('con', 'user', 'adds'), e('user', 'url', 'signs in at')],
        flows: [f('you>con', 'create user', { kind: 'user', every: 3 }), f('con>user', '', { kind: 'iam', every: 3, delay: 0.7 }), f('user>url', '', { kind: 'user', every: 3, delay: 1.4 })] },
      body: [
        '**Console:** IAM → Users → *Create user* → name → tick *Provide user access to the AWS Management Console* → choose a password (and *must create a new password at next sign-in*) → *Add user to group* (e.g. Developers) → *Create user*. Then open the user → *Security credentials* → *Assign MFA device*.',
        'IAM users sign in at the **account sign-in URL**: `https://<account-id>.signin.aws.amazon.com/console`. Create an **account alias** (IAM dashboard) to get a friendlier URL like `https://acme.signin.aws.amazon.com/console`. Root signs in on the normal page by choosing *Root user* and typing the email.',
        'The same steps with the CLI show what the console does under the hood:',
      ],
      code: { file: 'create-user.sh', lang: 'bash', src: `
aws iam create-user --user-name ada
aws iam create-login-profile --user-name ada \\
  --password 'Temp#Pass-2026' --password-reset-required
aws iam create-group --group-name Developers
aws iam attach-group-policy --group-name Developers \\
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
aws iam add-user-to-group --user-name ada --group-name Developers
aws iam create-account-alias --account-alias acme
aws iam update-account-password-policy --minimum-password-length 14 \\
  --require-symbols --require-numbers --max-password-age 90`, hl: [1, 2, 3, 7] },
      interview: 'If asked “how does an IAM user sign in?”, mention the account-specific sign-in URL (or alias), console password + MFA — and that access keys are a separate, programmatic credential.',
    },
    {
      short: 'Credential types', title: 'Every kind of AWS credential, side by side', tag: 'concept',
      scene: { nodes: [
        n('pw', 170, 120, 'Console password', { kind: 'lock', sub: 'humans · browser' }),
        n('ak', 170, 260, 'Access key (AKIA…)', { kind: 'key', sub: 'programs · long-term' }),
        n('tmp', 170, 400, 'Temporary creds (ASIA…)', { kind: 'sts', sub: '+ session token · expires' }),
        n('api', 640, 260, 'AWS APIs', { kind: 'aws', sub: 'S3, IAM, EC2 …' }),
        n('note', 640, 420, 'Root: password + MFA only', { kind: 'note', icon: false })],
        edges: [e('pw', 'api', 'console session'), e('ak', 'api', 'SigV4-signed'), e('tmp', 'api', 'SigV4 + token')],
        flows: [f('pw>api', '', { kind: 'lock', every: 3 }), f('ak>api', 'risky', { kind: 'key', every: 3, delay: 0.5 }), f('tmp>api', 'preferred', { kind: 'sts', every: 3, delay: 1 })] },
      body: [
        '<ul><li><b>Console password</b> (+ MFA): for people in the browser. Root and IAM users can have one.</li><li><b>[[access-key|Access keys]]</b>: access key ID `AKIA…` + secret access key. For programs and the CLI. They never expire on their own — the main source of AWS breaches. Max two per IAM user, so you can rotate.</li><li><b>[[temp-creds|Temporary credentials]]</b>: access key ID `ASIA…` + secret + **session token**, issued by [[sts|STS]]. They expire (15 min – 12 h). Roles, Identity Center, `aws login` and every AWS service (Lambda, EC2) use these.</li><li>Rarer: SSH public keys (CodeCommit), X.509 signing certificates, service-specific credentials.</li></ul>',
        'Rule of thumb: **humans get temporary credentials via sign-in; workloads get temporary credentials via roles; long-term access keys are the last resort.**',
      ],
      callout: { kind: 'warn', title: 'Spot the prefix', text: '`AKIA` = long-term IAM user (or root) key. `ASIA` = temporary STS key. If you see `AKIA` in a GitHub repo, that key must be deactivated immediately.' },
    },
    {
      short: 'How signing works', title: 'Access keys sign requests — the secret never travels', tag: 'internals',
      scene: { nodes: [n('cli', 140, 250, 'AWS CLI / SDK', { kind: 'cli', sub: 'has key ID + secret' }), n('sig', 430, 250, 'SigV4 signature', { kind: 'kms', sub: 'HMAC-SHA256 of the request' }), n('api', 740, 250, 's3.amazonaws.com', { kind: 's3', sub: 'recomputes & compares' }), n('iamc', 740, 420, 'IAM', { kind: 'iam', sub: 'who? allowed?' })],
        edges: [e('cli', 'sig', 'sign locally'), e('sig', 'api', 'Authorization header'), e('api', 'iamc', 'authorize')],
        flows: [f('cli>sig', '', { kind: 'cli', every: 3 }), f('sig>api', 'key ID + signature', { kind: 'kms', every: 3, delay: 0.7 }), f('api>iamc', '', { kind: 'iam', every: 3, delay: 1.4 })] },
      body: [
        'The CLI does **not** send your secret key. It builds a canonical version of the request (method, path, headers, body hash, date, region, service), derives a signing key from the secret, and computes an HMAC-SHA256 **signature** — this is **Signature Version 4 (SigV4)**.',
        'It sends only the access key ID, the signature and the timestamp in the `Authorization` header. AWS looks up the secret for that key ID, recomputes the signature, and if they match it knows who you are. Then IAM checks whether you are *allowed*.',
        'So anyone holding the key ID + secret *is* you, from anywhere on the internet, until the key is deactivated. AWS scans public GitHub for leaked keys and may attach a quarantine policy, but you must still rotate and investigate.',
      ],
      code: { file: 'keys.sh', lang: 'bash', src: `
aws iam create-access-key --user-name ci-bot          # shows the secret ONCE
aws iam list-access-keys --user-name ci-bot
aws iam get-access-key-last-used --access-key-id AKIAEXAMPLE123
# rotate: create key 2 → switch the app → deactivate key 1 → delete key 1
aws iam update-access-key --user-name ci-bot \\
  --access-key-id AKIAEXAMPLE123 --status Inactive
aws iam delete-access-key --user-name ci-bot --access-key-id AKIAEXAMPLE123`, hl: [1, 4, 5] },
    },
    {
      short: 'Modern sign-in', title: 'Better than access keys: Identity Center and `aws login`', tag: 'concept',
      scene: { nodes: [you({ sub: 'developer' }), n('idc', 420, 150, 'IAM Identity Center', { kind: 'org', sub: 'one login, many accounts' }), n('login', 420, 350, '`aws login`', { kind: 'cli', sub: 'console sign-in → CLI' }), n('sts', 720, 250, 'STS', { kind: 'sts', sub: 'temporary credentials' }), n('api', 960, 250, 'AWS APIs', { kind: 'aws', sub: 'expire in hours' })],
        edges: [e('you', 'idc', 'aws sso login'), e('you', 'login', 'browser + MFA'), e('idc', 'sts'), e('login', 'sts'), e('sts', 'api', 'ASIA… creds')],
        flows: [f('you>idc', '', { kind: 'user', every: 3.2 }), f('you>login', '', { kind: 'user', every: 3.2, delay: 1.6 }), f('sts>api', 'temp', { kind: 'sts', every: 1.6, delay: 0.8 })] },
      body: [
        '**[[identity-center|IAM Identity Center]]** (formerly AWS SSO) is the recommended way for people to access AWS, especially with several accounts: users sign in once (optionally through Google, Okta or Microsoft Entra), pick an account and a *permission set*, and get temporary credentials in the console or CLI (`aws configure sso`, `aws sso login`).',
        'For a single account without Identity Center, **`aws login`** (AWS CLI 2.32+, Nov 2025) lets you sign in with your normal console credentials — root, IAM user or federation — in the browser, and gives the CLI and SDKs short-lived, auto-refreshed credentials. No access key is ever created.',
        'Keep IAM users with access keys only for things that truly cannot use roles or federation (some third-party tools). Next lesson digs into how the CLI finds and uses these credentials.',
      ],
    },
    {
      short: 'In CDK', title: 'Users and groups as code (CDK, TypeScript)', tag: 'code',
      scene: { nodes: [n('code', 150, 250, 'iam-stack.ts', { kind: 'code', sub: 'Group · User · policy' }), n('cfn', 480, 250, 'CloudFormation', { kind: 'cfn', sub: 'stack: IamStack' }), n('grp', 820, 160, 'Group: Developers', { kind: 'org' }), n('user', 820, 340, 'User: ada', { kind: 'user', sub: 'password from Secrets Manager' })],
        edges: [e('code', 'cfn', 'cdk deploy'), e('cfn', 'grp', 'creates'), e('cfn', 'user', 'creates')],
        flows: [f('code>cfn', 'template', { kind: 'cfn', every: 3 }), f('cfn>grp', '', { kind: 'iam', every: 3, delay: 0.8 }), f('cfn>user', '', { kind: 'iam', every: 3, delay: 1.1 })] },
      body: [
        'In real teams IAM is managed as code so every change is reviewed. The [[cdk|CDK]] `aws-iam` module has L2 [[construct|constructs]] for users, groups, roles and policies.',
        'Never put a password in source code. Generate it in Secrets Manager and pass it as a `SecretValue`; force a reset at first sign-in. For people, prefer Identity Center permission sets (also manageable in CDK) over IAM users.',
      ],
      code: { file: 'lib/iam-stack.ts', lang: 'ts', src: `
import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class IamStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const devs = new iam.Group(this, 'Developers', { groupName: 'Developers' });
    devs.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));

    const pw = new sm.Secret(this, 'AdaInitialPassword', {
      generateSecretString: { passwordLength: 20 },
    });
    const ada = new iam.User(this, 'Ada', {
      userName: 'ada',
      password: pw.secretValue,             // never a literal string
      passwordResetRequired: true,
      groups: [devs],
    });
  }
}`, hl: [10, 11, 16, 18, 19] },
    },
    {
      short: 'Hygiene', title: 'Account hygiene checklist', tag: 'concept',
      scene: { zones: [acct(330)], nodes: [root({ state: 'ok', sub: 'MFA · no keys · alarm' }), iamSvc({ state: 'ok', sub: 'groups · least privilege' }), n('ct', 820, 150, 'CloudTrail', { kind: 'event', sub: 'audit log on', state: 'ok' }), n('bud', 820, 330, 'Budgets', { kind: 'aws', sub: 'alert at $10', state: 'ok' }), you({ sub: 'Identity Center / aws login' })],
        edges: [e('you', 'iam', 'temporary creds')], flows: [f('you>iam', '', { kind: 'sts', every: 2.5 })] },
      body: [
        '<ul><li>Root: MFA (passkey), no access keys, alternate contacts, alarm on use.</li><li>Create an admin identity (Identity Center or an IAM user with MFA) and stop using root.</li><li>Use groups, not policies attached to individual users.</li><li>[[cloudtrail|CloudTrail]] trail to an S3 bucket in all regions; GuardDuty on.</li><li>An AWS **Budget** with an email alert — the first real-world defence against a leaked key mining crypto.</li><li>Run the **credential report** (`aws iam generate-credential-report`) to find old passwords, unused keys and users without MFA.</li><li>IAM Access Analyzer to find resources shared outside the account and unused permissions.</li></ul>',
      ],
      code: { file: 'audit.sh', lang: 'bash', src: `
aws iam generate-credential-report
aws iam get-credential-report --query Content --output text | base64 -d > report.csv
# columns include: password_last_used, mfa_active,
# access_key_1_active, access_key_1_last_rotated, access_key_1_last_used_date
aws iam get-account-summary   # counts: users, MFA devices, AccountMFAEnabled ...`, hl: [1, 2] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What is the difference between the root user and an IAM user?', a: ['Root is created with the account (email + password), has unrestricted access and cannot be limited by IAM policies in its own account. IAM users are identities you create inside the account; they start with zero permissions and get only what policies allow. Use root only for the few root-only tasks; use IAM/Identity Center for everything else.'] },
    { lvl: 'J', q: 'Can an IAM user do anything right after you create it?', a: ['No. IAM is default-deny: without an attached policy (directly or via a group) every request is denied. It cannot even list buckets.'] },
    { lvl: 'J', q: 'What are access keys and why are they risky?', a: ['A long-term key ID (AKIA…) + secret used to sign API requests. They do not expire, work from anywhere, and are often leaked in code, logs or laptops. Prefer temporary credentials (roles, Identity Center, aws login) and rotate/limit any keys you must keep.'] },
    { lvl: 'M', q: 'Name tasks that require the root user.', a: ['Changing the root email/password/account name, closing the account, changing the Support plan and some billing settings, enabling MFA Delete on S3, restoring access when all IAM admins are locked out, and deleting a bucket/queue policy that denies everyone. With centralized root access some of these can be done from the management account via sts:AssumeRoot.'] },
    { lvl: 'M', q: 'How does AWS verify an API request signed with an access key?', a: ['SigV4: the client derives a signing key from the secret, date, region and service, and HMAC-signs a canonical form of the request. It sends the key ID and signature. AWS recomputes the signature with its copy of the secret and compares; then IAM evaluates authorization. The secret never crosses the network, and the timestamp limits replay.'] },
    { lvl: 'S', q: 'You inherit an account where 40 developers have IAM users with access keys. What is your plan?', a: ['Turn on Identity Center (or aws login for a single account) and move people to temporary credentials; generate a credential report and Access Analyzer unused-access findings; deactivate unused keys first, then migrate CI to OIDC roles (e.g. GitHub Actions → AssumeRoleWithWebIdentity); enforce MFA; add SCPs/guardrails denying iam:CreateAccessKey; alarm on root use and on new keys; delete IAM users once migrated.'], why: 'Tests a realistic migration from long-lived keys to federation without breaking people.' },
  ],
  history: {
    timeline: [
      { yr: '2006', title: 'AWS launches S3 and EC2', text: 'Accounts had only the root email/password and root access keys.' },
      { yr: '2010–2011', title: 'IAM becomes generally available', text: 'Users, groups and policies arrived so teams could stop sharing the root password; roles for EC2 followed in 2012.', c: 'g' },
      { yr: '2017', title: 'AWS Organizations & SCPs', text: 'Many accounts under one management account with guardrails.' },
      { yr: '2017–2020', title: 'AWS SSO → IAM Identity Center (2022)', text: 'Central human sign-in with temporary credentials across accounts.' },
      { yr: '2024–2025', title: 'MFA required for all root users; centralized root access', text: 'Root MFA enforced for every account type; Organizations can delete member-account root credentials.' },
      { yr: 'Nov 2025', title: '`aws login`', text: 'CLI/SDKs can use console sign-in for short-lived credentials — no access keys needed for local development.', c: 'g' },
    ],
    alts: { cols: ['Way to access AWS', 'Credential', 'Use it for'], rows: [['Root user', 'password + MFA', 'only root-only tasks'], ['IAM user + password', 'password + MFA', 'small single accounts (legacy)'], ['IAM user + access key', 'long-term AKIA key', 'last resort for tools that cannot federate'], ['IAM Identity Center', 'temporary', 'people, multi-account'], ['aws login', 'temporary', 'local dev with console credentials'], ['IAM role', 'temporary', 'workloads, CI (OIDC), cross-account']] },
  },
  quiz: [
    { q: 'A new IAM user with no policies tries `aws s3 ls`. Result?', o: ['Lists all buckets', 'AccessDenied', 'Lists only their buckets', 'Works for 24 hours'], a: 1, why: 'IAM denies by default.' },
    { q: 'Which access key ID is temporary?', o: ['AKIA…', 'ASIA…', 'Both', 'Neither'], a: 1, why: 'ASIA keys come from STS and need a session token.' },
    { q: 'Which can only be done by the root user?', o: ['Create an S3 bucket', 'Enable MFA Delete on a bucket', 'Create an IAM role', 'Read CloudTrail logs'], a: 1, why: 'MFA Delete is a root-only operation.' },
    { q: 'What travels over the network when the CLI signs a request?', o: ['The secret access key', 'The key ID and an HMAC signature', 'Your password', 'Nothing'], a: 1, why: 'SigV4 never sends the secret.' },
    { q: 'Best way for developers to get CLI credentials in a multi-account company?', o: ['Share the root keys', 'IAM Identity Center temporary credentials', 'One IAM user per team', 'Keys in a wiki'], a: 1, why: 'Temporary, per-person, centrally managed.' },
  ],
  cheat: `<h3>Root user</h3><ul><li>MFA (passkey/security key) · no access keys · alternate contacts · alarm on sign-in</li><li>Root-only: close account, change root email, Support plan, MFA Delete, unlock a deny-all bucket policy, restore lost admin</li><li>Organizations: centralized root access → delete member root credentials</li></ul>
  <h3>Credentials</h3><table class="t"><tr><td>Password (+MFA)</td><td>console, humans</td></tr><tr><td>AKIA… key</td><td>long-term, max 2 per user, rotate</td></tr><tr><td>ASIA… + token</td><td>temporary from STS (roles, SSO, aws login)</td></tr></table>
  <h3>CLI</h3><pre>aws iam create-user --user-name ada
aws iam create-login-profile --user-name ada --password … --password-reset-required
aws iam add-user-to-group --user-name ada --group-name Developers
aws iam create-access-key / list-access-keys / update-access-key --status Inactive
aws iam generate-credential-report</pre>
  <h3>Sign-in URL</h3><p><code>https://&lt;account-id|alias&gt;.signin.aws.amazon.com/console</code></p>`,
};
