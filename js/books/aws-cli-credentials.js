export default {
  title: 'The AWS CLI and credentials, from zero',
  intro: 'The AWS Command Line Interface lets you control AWS by typing commands. To do that safely it must prove who you are on every request. This book explains commands, profiles, the order in which credentials are found, and how to fix the errors everyone meets.',
  chapters: [
    {
      level: 1, title: 'What a command-line tool is',
      text: [
        'A **terminal** is a window where you type commands instead of clicking. The **AWS CLI** is a program you install that understands commands like `aws s3 ls` (“list my storage buckets”).',
        'Every AWS action — creating a bucket, reading a file — is an **API call**: a request sent over the internet to an AWS address. The CLI builds that request for you and prints the answer.',
      ],
      words: [
        ['Terminal', 'A text window for typing commands (PowerShell, Terminal, bash).'],
        ['CLI', 'Command Line Interface — a program you use by typing commands.'],
        ['API call', 'A request one program sends to another to ask it to do something.'],
      ],
      example: 'Ordering food by phone with exact instructions (CLI) instead of pointing at pictures in the shop (console).',
      remember: 'One CLI command ≈ one API call.',
      check: ['What does the CLI actually send to AWS?', 'An HTTPS API request, signed with your credentials.'],
    },
    {
      level: 1, title: 'Reading a command',
      text: [
        'Commands follow a pattern: `aws <service> <action> --options`. For example `aws s3api list-buckets` or `aws iam create-user --user-name ada`.',
        'The action names mirror AWS API names written in lowercase with hyphens: `ListBuckets` becomes `list-buckets`. Add `help` to anything to see every option.',
        'The first command to learn is `aws sts get-caller-identity`: it simply answers “who am I and which account am I in?”',
      ],
      words: [
        ['Service', 'An AWS product, such as s3, iam, ec2.'],
        ['Option / flag', 'Extra settings after the action, written `--name value`.'],
        ['sts get-caller-identity', 'A command that shows which identity your credentials belong to.'],
      ],
      example: 'Like an address: country (service), street (action), house number (options).',
      remember: 'When in doubt: `aws sts get-caller-identity`.',
      check: ['What would the CLI action for the API `PutObject` be?', '`put-object` (e.g. `aws s3api put-object`).'],
    },
    {
      level: 1, title: 'Profiles and the two config files',
      text: [
        'The CLI keeps settings in two files in a hidden `.aws` folder in your home directory. `config` stores settings such as the default **region** and output format. `credentials` stores secret keys (if you use them).',
        'Each file can hold several **profiles** — named sets of settings — so you can switch between accounts with `--profile dev` or by setting the `AWS_PROFILE` variable. The profile called `default` is used when you don’t choose.',
      ],
      words: [
        ['Profile', 'A named group of CLI settings and credentials.'],
        ['Region (setting)', 'Which AWS region commands go to by default.'],
        ['Environment variable', 'A named value your terminal passes to programs, like `AWS_PROFILE=dev`.'],
      ],
      example: 'Several saved Wi-Fi networks on your phone — you pick which one to connect to.',
      remember: '`~/.aws/config` = settings. `~/.aws/credentials` = secrets.',
      check: ['How is a profile header written in the config file?', '`[profile dev]` (but just `[dev]` in the credentials file).'],
    },
    {
      level: 2, title: 'Where the CLI looks for credentials',
      text: [
        'Every time you run a command, the CLI searches for credentials in a fixed order and uses the **first** it finds — the **credential provider chain**:',
        '1) an explicit `--profile`, or key variables in your terminal (`AWS_ACCESS_KEY_ID` etc.); 2) the chosen profile’s settings (roles, SSO, login session, stored keys); 3) container credentials (when running in ECS/EKS); 4) the EC2 instance’s role.',
        'This is why a forgotten variable in one terminal tab can make commands run against a different account than you expect.',
      ],
      words: [
        ['Credential provider chain', 'The ordered list of places the CLI/SDK checks for credentials.'],
        ['Instance metadata', 'A local address inside an EC2 server that hands out its role credentials.'],
      ],
      example: 'Checking your pockets for keys in the same order every time: jacket, trousers, bag — first set found is used.',
      remember: 'First match wins. Check `env | grep AWS_` when confused.',
      check: ['You exported key variables and also set AWS_PROFILE. Which wins?', 'The exported key variables (an explicit `--profile` on the command would win over them).'],
    },
    {
      level: 2, title: 'Three ways to sign in',
      text: [
        '**`aws configure`** asks for an access key and secret and saves them permanently in the credentials file. Simple, but the secret sits on disk forever.',
        '**`aws configure sso`** + **`aws sso login`** use IAM Identity Center: you log in through the browser with MFA and get temporary credentials for hours.',
        '**`aws login`** (CLI 2.32+) uses your normal AWS console sign-in to give the CLI short-lived, auto-refreshing credentials — no access keys at all.',
      ],
      words: [
        ['SSO', 'Single sign-on — one login for many systems.'],
        ['Temporary credentials', 'Credentials that expire automatically.'],
        ['Cache', 'A saved copy kept for a while so you don’t repeat work (here: tokens in `~/.aws/sso/cache` or `~/.aws/login/cache`).'],
      ],
      example: 'A permanent house key under the doormat (configure) versus a hotel card that expires each day (sso/login).',
      remember: 'Prefer `aws login` or SSO over stored keys.',
      check: ['After your SSO session expires, what do you run?', '`aws sso login` again.'],
    },
    {
      level: 2, title: 'Working in other accounts with roles',
      text: [
        'A profile can say: “use my normal credentials, then switch into this **role** in another account”. It contains `role_arn` (which role), `source_profile` (who you start as) and optionally `mfa_serial` (ask for an MFA code).',
        'The CLI then calls STS **AssumeRole**, receives temporary credentials for the role, caches them, and uses them for your commands.',
      ],
      words: [
        ['ARN', 'Amazon Resource Name — the full unique ID of something in AWS.'],
        ['AssumeRole', 'The STS action that swaps your identity for a role’s temporary credentials.'],
        ['Source profile', 'The profile whose credentials are used to assume the role.'],
      ],
      example: 'Using your company badge at reception to get a guest pass for a partner’s office.',
      remember: 'role_arn + source_profile (+ mfa_serial) = cross-account profile.',
      check: ['What must the role’s trust policy allow?', 'Your account or identity to call sts:AssumeRole on it.'],
    },
    {
      level: 3, title: 'Shaping output and paging through results',
      text: [
        'AWS replies in JSON, which can be long. `--query` filters it using a language called **JMESPath** (e.g. `"Buckets[].Name"`), and `--output text|table|yaml|json` changes the format.',
        'Lists come in **pages** (often 1,000 items). The CLI fetches all pages automatically; `--max-items` and `--page-size` control how many and how big. **Waiters** like `aws s3api wait bucket-exists` pause until something is ready.',
      ],
      words: [
        ['JSON', 'A text format for structured data with `{}` objects and `[]` lists.'],
        ['JMESPath', 'A small query language for picking parts of JSON.'],
        ['Pagination', 'Splitting a long list into pages fetched one after another.'],
      ],
      example: 'Asking a librarian for “just the titles of books by this author” instead of the whole catalogue.',
      remember: '`[]` maps over a list: `Contents[].Key`.',
      check: ['Does `--query` reduce what AWS sends?', 'No, it filters on your computer after the response arrives.'],
    },
    {
      level: 3, title: 'Fixing the four classic errors',
      text: [
        '**Unable to locate credentials** — nothing in the chain: wrong profile name or you never logged in. **ExpiredToken** — temporary credentials ran out; log in again. **AccessDenied** — you’re known, but a policy doesn’t allow that action (the message names the action and resource). **SignatureDoesNotMatch / RequestTimeTooSkewed** — wrong secret or your clock is off.',
        '`--debug` shows everything: which credentials were found, the endpoint, the exact request and response.',
      ],
      words: [
        ['Authentication', 'Proving who you are.'],
        ['Authorization', 'Deciding what you’re allowed to do.'],
        ['Debug output', 'Extra detail a program prints to help find problems.'],
      ],
      example: '“Wrong key” (authentication) versus “right key, but this door isn’t yours” (authorization).',
      remember: 'Unable to locate → who? AccessDenied → what is allowed?',
      check: ['Is AccessDenied an authentication or authorization problem?', 'Authorization — AWS knows who you are but no policy allows the action.'],
    },
  ],
};
