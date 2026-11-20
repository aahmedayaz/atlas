export default {
  title: 'Your AWS account, the root user and IAM users',
  intro: 'Before you create a single server or bucket, you need to understand the box everything lives in (the account), the master key that opens it (the root user), and the badges you hand out to people and programs (IAM). This book starts from zero.',
  chapters: [
    {
      level: 1, title: 'What “the cloud” and an AWS account are',
      text: [
        '**The cloud** means renting computers, storage and services from someone else’s data centres over the internet, and paying only for what you use. **AWS** (Amazon Web Services) is the biggest cloud provider.',
        'When you sign up, AWS creates an **account**: a private container for everything you build, identified by a 12-digit number. Everything inside it is billed to that account, and nothing outside can see inside unless you allow it.',
      ],
      words: [
        ['Cloud', 'Computers and services you rent over the internet instead of owning.'],
        ['AWS account', 'Your private container in AWS, with a 12-digit ID and one bill.'],
        ['Resource', 'Anything you create in AWS: a storage bucket, a server, a database, a function.'],
      ],
      example: 'Renting a flat: you get your own address (account ID), your own electricity bill, and your neighbours can’t walk in.',
      remember: 'One account = one private box + one bill.',
      check: ['Can a resource belong to two accounts at once?', 'No. Every resource belongs to exactly one account (others can be *allowed* to use it).'],
    },
    {
      level: 1, title: 'Regions and Availability Zones',
      text: [
        'AWS has data centres all over the world, grouped into **Regions** (like `eu-west-1` in Ireland or `ap-south-1` in Mumbai). Most things you create live in one region, which affects speed (distance to users), price and data laws.',
        'Each region contains several **Availability Zones** — separate buildings with their own power and network — so one fire or power cut doesn’t take everything down.',
        'A few services are **global** and not tied to a region: IAM (identities), CloudFront (CDN), Route 53 (DNS).',
      ],
      words: [
        ['Region', 'A geographic area with AWS data centres, e.g. `us-east-1`.'],
        ['Availability Zone (AZ)', 'A separate data centre group inside a region.'],
        ['Global service', 'A service that is the same in every region, like IAM.'],
      ],
      example: 'A bank with branches in several cities (regions); in each city it has two or three separate buildings (AZs) so one burst pipe doesn’t close the bank.',
      remember: 'Pick a region close to your users; spread important things across AZs.',
      check: ['Is IAM regional?', 'No — IAM is global; a user you create works in every region.'],
    },
    {
      level: 1, title: 'The root user — the master key',
      text: [
        'The email and password you signed up with become the **root user**. It can do absolutely everything in the account, including closing it, and normal permission rules can’t restrict it.',
        'That makes it dangerous to use every day. If someone steals it, they own the account. So you use it only for the few jobs that require it, and lock it away the rest of the time.',
      ],
      words: [
        ['Root user', 'The account’s original identity (email + password) with unlimited power.'],
        ['Permission', 'Being allowed to do a specific action, such as reading a file.'],
      ],
      example: 'The master key of an apartment building: the owner keeps it in a safe and uses a normal key to enter their own flat.',
      remember: 'Root is for emergencies and a few special tasks, never for daily work.',
      check: ['Name one task only root can do.', 'Close the account / change the root email / enable MFA Delete on an S3 bucket / unlock a bucket whose policy denies everyone.'],
    },
    {
      level: 2, title: 'Locking root away: MFA and no keys',
      text: [
        '**MFA** means you need two proofs to sign in: something you know (password) and something you have (a phone app code, or better, a **passkey / security key**). AWS now *requires* MFA for every root user.',
        'Never create **access keys** for root — those are permanent passwords for programs that skip MFA entirely. Set up alerts so you get an email whenever root signs in.',
        'In companies with many accounts, **AWS Organizations** can delete the root password from member accounts completely (“centralized root access”) and perform root-only tasks from one central account.',
      ],
      words: [
        ['MFA', 'Multi-factor authentication: two different proofs of identity.'],
        ['Passkey / security key', 'A phishing-proof second factor using cryptography (e.g. a YubiKey or your phone’s passkey).'],
        ['Access key', 'A long-lived ID + secret that programs use to call AWS.'],
        ['AWS Organizations', 'A service that groups many AWS accounts under one management account.'],
      ],
      example: 'A bank vault needs both a key card and a fingerprint; nobody is allowed to make a copy of the master key.',
      remember: 'Root: MFA on, no access keys, alarm on use.',
      check: ['Does MFA protect requests made with root access keys?', 'No — access keys sign API calls without MFA. That’s why root must never have them.'],
    },
    {
      level: 2, title: 'IAM: users, groups, roles and policies',
      text: [
        '**IAM** (Identity and Access Management) is how you give out limited access. Its pieces:',
        '**Users** are long-lived identities for a person or program. **Groups** are collections of users that share permissions (e.g. Developers). **Roles** are identities without a password that others temporarily *take on*. **Policies** are JSON documents listing what is allowed or denied.',
        'The most important rule: **everything is denied by default**. A brand-new user can do nothing until a policy allows it.',
      ],
      words: [
        ['IAM user', 'A named identity inside your account, with optional password and keys.'],
        ['IAM group', 'A set of users that share the same policies.'],
        ['IAM role', 'An identity with permissions but no password, used by being “assumed”.'],
        ['Policy', 'A JSON rule sheet: Allow/Deny which actions on which resources.'],
        ['Default deny', 'If nothing says “Allow”, the answer is no.'],
      ],
      example: 'An office: staff badges (users), departments (groups), visitor passes (roles), and the rule book saying which doors each badge opens (policies).',
      remember: 'No policy = no access.',
      check: ['Can you sign in as a group?', 'No. Groups only hold policies for their member users.'],
    },
    {
      level: 2, title: 'Creating an IAM user for a person',
      text: [
        'In the IAM console: Users → Create user → give it a name → choose console access and a temporary password → put it in a group → create. The person signs in at your account’s **sign-in URL** (`https://<account-id>.signin.aws.amazon.com/console`), which you can make friendlier with an **account alias**.',
        'Then ask them to set up MFA on their own user, and set a **password policy** (minimum length, symbols, expiry) for the account.',
      ],
      words: [
        ['Console', 'The AWS website where you click to manage things.'],
        ['Sign-in URL', 'The account-specific web address where IAM users log in.'],
        ['Account alias', 'A friendly name replacing the account ID in the sign-in URL.'],
        ['Password policy', 'Account-wide rules for how strong IAM user passwords must be.'],
      ],
      example: 'Giving a new employee a badge, a temporary PIN they must change on day one, and a desk in the right department.',
      remember: 'User → group → MFA → sign in at the account URL.',
      check: ['Where does an IAM user sign in?', 'At the account sign-in URL (with the account ID or alias), not the root sign-in page.'],
    },
    {
      level: 2, title: 'Kinds of credentials',
      text: [
        'A **credential** is anything that proves who you are. AWS has three main kinds:',
        '**Password (+ MFA)** for people using the console. **Access keys** (ID starts with `AKIA`) for programs — permanent until deleted. **Temporary credentials** (ID starts with `ASIA`, plus a **session token**) that expire after minutes or hours and are handed out by a service called **STS**.',
        'Temporary credentials are far safer: if they leak, they stop working soon. Modern AWS gives people and programs temporary credentials wherever possible.',
      ],
      words: [
        ['Credential', 'Proof of identity: password, key or token.'],
        ['Session token', 'An extra value that comes with temporary credentials.'],
        ['STS', 'Security Token Service — issues temporary credentials.'],
      ],
      example: 'A permanent house key (access key) versus a hotel key card that stops working at checkout (temporary credentials).',
      remember: 'AKIA = permanent, risky. ASIA = temporary, preferred.',
      check: ['You find `AKIA…` in a public code repository. What do you do first?', 'Deactivate that access key immediately, then investigate what it did.'],
    },
    {
      level: 3, title: 'How access keys prove who you are (SigV4)',
      text: [
        'When a program uses an access key, it doesn’t send the secret. It builds a precise description of the request and computes a **signature** with the secret — a code that only someone with the secret could produce. This method is **Signature Version 4**.',
        'AWS has a copy of the secret, recomputes the signature and compares. A timestamp in the signature means a captured request expires within minutes.',
        'Because the key ID + secret are all an attacker needs, keys must never appear in code, logs or screenshots.',
      ],
      words: [
        ['Signature', 'A code computed from the request and a secret, proving the sender holds the secret.'],
        ['HMAC', 'The keyed hashing method used to compute the signature.'],
        ['Replay', 'Re-sending a captured request; timestamps limit it.'],
      ],
      example: 'A wax seal from your personal ring: the receiver recognises the seal without you ever sending the ring.',
      remember: 'The secret never travels; the signature does.',
      check: ['Why does a wrong computer clock break AWS calls?', 'The signature includes a timestamp; AWS rejects requests more than a few minutes off.'],
    },
    {
      level: 3, title: 'The modern way: sign in, don’t store keys',
      text: [
        'For people, AWS recommends **IAM Identity Center** (central login across many accounts) or the **`aws login`** command (use your normal console sign-in to get short-lived CLI credentials). Both avoid permanent keys on laptops.',
        'For programs running in AWS (Lambda, EC2, containers), use **roles** — AWS hands them temporary credentials automatically. For CI systems like GitHub Actions, use **OIDC** to swap a signed job token for temporary credentials.',
        'Keep IAM users with access keys only as a last resort, tightly limited and rotated.',
      ],
      words: [
        ['IAM Identity Center', 'AWS’s single sign-on service for people across accounts.'],
        ['`aws login`', 'CLI command (2025+) that turns a console sign-in into temporary credentials.'],
        ['OIDC', 'OpenID Connect — a standard for proving identity with signed tokens.'],
        ['Rotate', 'Replace a credential with a new one and retire the old one.'],
      ],
      example: 'Instead of every employee carrying a permanent master key, they tap a badge each morning and get access for the day.',
      remember: 'People: sign in. Workloads: roles. Keys: last resort.',
      check: ['Which is safer for a developer laptop: `aws configure` with keys or `aws login`?', '`aws login` — it caches short-lived, auto-refreshed credentials instead of a permanent secret.'],
    },
  ],
};
