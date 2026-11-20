export default {
  title: 'IAM roles and STS: borrowing permissions safely',
  intro: 'Roles are how modern AWS avoids permanent passwords and keys: services, people and pipelines borrow a role for a short time. This book explains roles, the two policies they carry, how temporary credentials work, and the security traps around them.',
  chapters: [
    {
      level: 1, title: 'Why roles exist',
      text: [
        'Permanent credentials leak: they end up in code, laptops and logs. A **role** is an identity with permissions but **no password and no keys**. Someone trusted “puts it on” — **assumes** it — and receives credentials that expire automatically.',
        'Lambda functions, servers, other accounts, people signing in through a company login, and CI pipelines all use roles.',
      ],
      words: [
        ['Role', 'An identity without its own credentials, used temporarily by trusted principals.'],
        ['Assume', 'To take on a role and get its temporary credentials.'],
      ],
      example: 'A uniform in a locker room: whoever is on duty wears it during their shift and hands it back afterwards.',
      remember: 'Roles = permissions without permanent secrets.',
      check: ['Can you set a password on a role?', 'No. Roles have no password or access keys.'],
    },
    {
      level: 1, title: 'The two policies on every role',
      text: [
        'The **trust policy** says *who* may assume the role (its Principal: a service, an account, a user, an identity provider). The **permissions policies** say *what* the role can do once assumed.',
        'Both must be right: a role nobody can assume is useless, and a role anyone can assume is dangerous.',
      ],
      words: [
        ['Trust policy', 'The resource policy on a role listing who may assume it.'],
        ['Permissions policy', 'An identity policy listing what the role can do.'],
      ],
      example: 'The guest list on a door (trust) and the list of rooms the guest pass opens (permissions).',
      remember: 'Trust = who. Permissions = what.',
      check: ['Lambda can’t use your role. Which policy do you check first?', 'The trust policy — it must trust `lambda.amazonaws.com`.'],
    },
    {
      level: 1, title: 'Temporary credentials from STS',
      text: [
        'When a role is assumed, **STS** (Security Token Service) returns an access key ID starting with `ASIA`, a secret and a **session token**, plus an **expiration** time — by default one hour, configurable from 15 minutes up to the role’s maximum (up to 12 hours).',
        'While using them, AWS sees the caller as `assumed-role/RoleName/SessionName`. CloudTrail still records who assumed the role, so actions remain traceable.',
      ],
      words: [
        ['STS', 'The service that issues temporary credentials.'],
        ['Session token', 'The third piece of temporary credentials, required with every request.'],
        ['Session name', 'A label you choose when assuming a role, visible in logs.'],
      ],
      example: 'A hotel key card: it opens your room until checkout, then stops working by itself.',
      remember: 'ASIA + secret + token, with an expiry.',
      check: ['Default session length for AssumeRole?', 'One hour.'],
    },
    {
      level: 2, title: 'Roles for AWS services',
      text: [
        'A **Lambda execution role** is assumed by Lambda each time your function runs; your code gets the credentials automatically through environment variables and the SDK uses them. An **EC2 instance profile** puts a role on a server; the SDK fetches credentials from the instance metadata service (use **IMDSv2**).',
        'This is why application code should never contain AWS keys.',
      ],
      words: [
        ['Execution role', 'The role a Lambda function runs as.'],
        ['Instance profile', 'The container that attaches a role to an EC2 instance.'],
        ['IMDSv2', 'The safer instance metadata service that needs a session token.'],
      ],
      example: 'A company car comes with its own fuel card; the driver never needs to carry the company credit card.',
      remember: 'Workloads get credentials from their role, not from code.',
      check: ['A Lambda needs S3 write access. Where do you add it?', 'To the Lambda’s execution role.'],
    },
    {
      level: 2, title: 'iam:PassRole — handing a role to a service',
      text: [
        'To give a service a role (set a Lambda’s execution role, attach an instance profile, pass a role to CloudFormation), you need permission `iam:PassRole` on that role.',
        'Without this rule, anyone who can create a Lambda could attach a powerful admin role and run code as admin — a **privilege escalation**. Scope PassRole to specific roles and services.',
      ],
      words: [
        ['iam:PassRole', 'Permission to assign a role to an AWS service.'],
        ['Privilege escalation', 'Gaining more power than you were meant to have.'],
      ],
      example: 'You may only lend a company car if you’re authorised to lend *that* car.',
      remember: 'Creating resources with roles needs PassRole on those roles.',
      check: ['Who needs PassRole — Lambda or the person creating the function?', 'The person (or pipeline) creating/configuring the function.'],
    },
    {
      level: 2, title: 'Roles across accounts',
      text: [
        'To work in another account, that account creates a role trusting your account (or a specific role/user). You assume it from the console (*Switch role*) or CLI (a profile with `role_arn`).',
        'Third-party vendors use the same pattern plus an **external ID** in the trust policy, preventing the **confused deputy** problem (another customer tricking the vendor into using your role).',
      ],
      words: [
        ['Switch role', 'Console feature for assuming a role in another account.'],
        ['External ID', 'A unique value a third party must present when assuming your role.'],
        ['Confused deputy', 'When a trusted middleman is tricked into misusing its access.'],
      ],
      example: 'A cleaning company has keys to many offices; your office only opens if the cleaner also says your secret code word.',
      remember: 'Cross-account: role in the target account + trust + caller permission.',
      check: ['What does the external ID protect against?', 'The confused deputy problem.'],
    },
    {
      level: 3, title: 'CI without stored keys: OIDC',
      text: [
        'CI systems like GitHub Actions can prove their identity with a signed **OIDC token** describing the repository, branch and environment. You register GitHub as an **identity provider** in IAM and create a role that trusts it; STS exchanges the token for temporary credentials (`AssumeRoleWithWebIdentity`).',
        'The trust policy must check the token’s **`sub`** claim (repo and branch/environment). Checking only the audience lets *any* GitHub repository assume your role.',
      ],
      words: [
        ['OIDC token', 'A signed JSON Web Token proving who a workload is.'],
        ['Identity provider', 'An external system AWS trusts to vouch for identities.'],
        ['Claim', 'A field inside a token, such as `sub` or `aud`.'],
      ],
      example: 'A signed letter from GitHub saying “this job is from acme/web on main”, swapped at the front desk for a one-hour visitor pass.',
      remember: 'Pin `sub` to your repo and environment.',
      check: ['Which claim identifies the repository?', '`sub` (e.g. `repo:acme/web:environment:prod`).'],
    },
    {
      level: 3, title: 'Revoking and limiting sessions',
      text: [
        'Temporary credentials can’t be deleted one by one. If they leak, use **Revoke active sessions** on the role: AWS adds a policy denying any session issued before now. You can also narrow a single session with a **session policy**, shorten the maximum session duration, or attach a **permissions boundary**.',
        '**Role chaining** (assuming a role while already in a role) is limited to one hour.',
      ],
      words: [
        ['Revoke sessions', 'Deny all sessions of a role issued before a given time.'],
        ['Session policy', 'A policy passed when assuming a role to restrict that session.'],
        ['Role chaining', 'Using role credentials to assume another role.'],
      ],
      example: 'Changing a building’s door codes so every visitor pass printed before 3 p.m. stops working.',
      remember: 'Leaked session? Revoke older sessions.',
      check: ['Max duration when chaining roles?', 'One hour.'],
    },
  ],
};
