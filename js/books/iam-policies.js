export default {
  title: 'IAM policies: how AWS decides yes or no',
  intro: 'Every single AWS request is checked against rules. This book teaches you to read and write those rules (policies), and to predict exactly how AWS combines them — the skill behind fixing every “AccessDenied”.',
  chapters: [
    {
      level: 1, title: 'Authentication vs authorization',
      text: [
        'Two questions are asked for every request. **Authentication**: who are you? (proved with a password, key or token). **Authorization**: are you allowed to do *this*? IAM policies answer the second question.',
        'A request always has a **principal** (who), an **action** (what, e.g. `s3:GetObject`), a **resource** (on what, e.g. one file) and **context** (when, from where, with MFA or not…).',
      ],
      words: [
        ['Authentication', 'Proving your identity.'],
        ['Authorization', 'Deciding what that identity may do.'],
        ['Principal', 'The identity making the request.'],
        ['Action', 'The operation requested, written `service:Operation`.'],
      ],
      example: 'At an airport, showing your passport is authentication; your boarding pass deciding which plane you may board is authorization.',
      remember: 'Policies answer: may this principal do this action on this resource now?',
      check: ['Is “wrong password” an authorization failure?', 'No — that is authentication.'],
    },
    {
      level: 1, title: 'Reading a policy',
      text: [
        'A **policy** is JSON with `"Version": "2012-10-17"` (always that date — it names the language version) and a list of **statements**. Each statement has an **Effect** (`Allow` or `Deny`), **Action**(s), **Resource**(s) and optionally a **Condition**.',
        'Wildcards are allowed: `s3:Get*` means every action starting with Get. Resources are written as **ARNs** — full names like `arn:aws:s3:::reports/*`.',
      ],
      words: [
        ['Statement', 'One rule inside a policy.'],
        ['Effect', 'Allow or Deny.'],
        ['ARN', 'Amazon Resource Name, the unique full name of a resource.'],
        ['Wildcard', '`*` meaning “anything here”.'],
      ],
      example: 'A gym membership card: “Allow — use pool and sauna — at the city branch — weekdays only”.',
      remember: 'Effect + Action + Resource (+ Condition).',
      check: ['What does `"Version": "2012-10-17"` mean?', 'The policy language version — always use exactly this value.'],
    },
    {
      level: 1, title: 'The S3 bucket-vs-object trap',
      text: [
        'Some actions work on a **bucket** and some on **objects** inside it. `s3:ListBucket` needs the bucket ARN `arn:aws:s3:::reports`; `s3:GetObject` needs object ARNs like `arn:aws:s3:::reports/*`.',
        'Mixing them up is the most common reason a policy “that looks right” still denies access.',
      ],
      words: [
        ['Bucket ARN', '`arn:aws:s3:::bucket-name` — the container itself.'],
        ['Object ARN', '`arn:aws:s3:::bucket-name/key` — files inside it.'],
      ],
      example: 'Permission to look at a library’s catalogue is different from permission to take a book home.',
      remember: 'List → bucket ARN. Get/Put/Delete → `bucket/*`.',
      check: ['Which ARN does `s3:ListBucket` need?', 'The bucket ARN, without `/*`.'],
    },
    {
      level: 2, title: 'Where policies are attached',
      text: [
        '**Identity-based policies** attach to users, groups or roles: “what may this identity do?”. They come as **AWS managed** (ready-made by AWS), **customer managed** (yours, reusable) or **inline** (embedded in one identity).',
        '**Resource-based policies** attach to a resource — an S3 bucket, a KMS key, a queue, a role’s trust policy — and include a **Principal** saying *who* the rule is about. They make cross-account sharing possible.',
      ],
      words: [
        ['Managed policy', 'A standalone policy you can attach to many identities.'],
        ['Inline policy', 'A policy embedded in a single identity, deleted with it.'],
        ['Resource-based policy', 'A policy attached to a resource, naming principals.'],
      ],
      example: 'Your badge lists the rooms you may enter (identity policy); a door sign lists who may come in (resource policy).',
      remember: 'Identity policies: no Principal. Resource policies: Principal required.',
      check: ['Which kind lets another account read your bucket without assuming a role?', 'A resource-based policy (bucket policy) naming that account’s principal.'],
    },
    {
      level: 2, title: 'How AWS combines everything',
      text: [
        'Start at **no** (implicit deny). If **any** applicable policy has a matching **Deny**, the answer is no — nothing can override it. If guardrails apply (SCP, RCP, permissions boundary, session policy), each must allow the action. Then, if an identity or resource policy **allows** it, the answer is yes. Otherwise it stays no.',
        'Short version: **explicit Deny beats Allow, Allow beats silence.**',
      ],
      words: [
        ['Implicit deny', 'The automatic “no” when nothing allows a request.'],
        ['Explicit deny', 'A Deny statement that matches the request.'],
        ['Guardrail', 'A policy that limits permissions but never grants any.'],
      ],
      example: 'A club: if you’re on the banned list (explicit deny), no VIP pass helps; otherwise you need someone to put you on the guest list (allow).',
      remember: 'Deny > Allow > nothing.',
      check: ['Admin user, bucket policy denies DeleteObject to everyone. Can they delete?', 'No — the explicit deny wins.'],
    },
    {
      level: 2, title: 'Cross-account rules',
      text: [
        'Inside one account, an Allow from *either* the identity policy *or* the resource policy is enough (with exceptions such as KMS key policies). Across accounts, **both** must allow: the owner’s resource policy must trust the caller, and the caller’s own account must allow the action.',
        'This protects both sides: you can’t grant yourself access to someone else’s data, and they can’t force access onto your users.',
      ],
      words: [
        ['Cross-account', 'A principal in one account using a resource in another.'],
      ],
      example: 'Visiting another company’s office needs both your manager’s approval and their reception’s approval.',
      remember: 'Same account: either side. Cross-account: both sides.',
      check: ['Bucket in B trusts a role in A. Role has no policies. Access?', 'Denied — the role’s own account must also allow it.'],
    },
    {
      level: 2, title: 'Conditions and variables',
      text: [
        'A **Condition** adds fine print using **context keys**: `aws:SecureTransport` (HTTPS?), `aws:MultiFactorAuthPresent`, `aws:SourceIp`, `aws:RequestedRegion`, `aws:PrincipalTag/team`, `s3:prefix`…',
        'Operators decide how to compare: `StringEquals`, `StringLike` (wildcards), `Bool`, `IpAddress`, `NumericLessThan`… **Policy variables** like `${aws:username}` let one policy give every user their own folder.',
      ],
      words: [
        ['Condition key', 'A piece of request context you can test, like source IP.'],
        ['Operator', 'How a condition compares values (equals, like, less than).'],
        ['Policy variable', 'A placeholder replaced at request time, e.g. `${aws:username}`.'],
      ],
      example: '“You may enter the lab — only with your badge AND a PIN, only from the internal door.”',
      remember: 'Multiple keys = AND; multiple values for one key = OR.',
      check: ['How do you force HTTPS for a bucket?', 'A Deny statement with condition `"Bool": { "aws:SecureTransport": "false" }`.'],
    },
    {
      level: 3, title: 'Guardrails: ceilings, not grants',
      text: [
        '**Service Control Policies (SCPs)** set the maximum for every principal in member accounts of an organization. **Resource Control Policies (RCPs)** set the maximum for resources in those accounts. **Permissions boundaries** cap one user or role. **Session policies** cap one temporary session.',
        'Effective permissions are the **intersection** of all of them with what identity/resource policies grant. A guardrail alone never gives access.',
      ],
      words: [
        ['SCP', 'Organization policy limiting what principals in accounts can do.'],
        ['RCP', 'Organization policy limiting what can be done to resources in accounts.'],
        ['Permissions boundary', 'A cap on the maximum permissions of one identity.'],
        ['Intersection', 'Only what every layer allows.'],
      ],
      example: 'A building’s fire code (SCP) and your tenancy contract (boundary) limit what you can do, even if your landlord says “do anything”.',
      remember: 'Grants ∩ guardrails = effective permissions.',
      check: ['An SCP allows only S3. A role has AdministratorAccess. Can it create a database?', 'No — outside the SCP ceiling.'],
    },
    {
      level: 3, title: 'Writing least-privilege policies in practice',
      text: [
        'Start small and add what is needed. Tools help: the **policy editor** validates as you type, **IAM Access Analyzer** can generate a policy from 90 days of real activity and flags unused permissions, the **policy simulator** answers “would this be allowed?”, and **last accessed** data shows which services were really used.',
        'In CDK, prefer **grant** methods such as `bucket.grantRead(role)`, which write precise actions and ARNs — including KMS permissions when needed.',
      ],
      words: [
        ['Least privilege', 'Giving only the permissions actually needed.'],
        ['Access Analyzer', 'An IAM tool that finds external access and unused permissions and drafts policies.'],
        ['Policy simulator', 'A tool that evaluates policies against a sample request.'],
      ],
      example: 'Giving a house-sitter keys only to the front door and the kitchen, not the safe.',
      remember: 'Generate, simulate, trim.',
      check: ['Which tool drafts a policy from what a role really did?', 'IAM Access Analyzer policy generation.'],
    },
  ],
};
