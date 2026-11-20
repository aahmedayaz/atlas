import { n, e, f, z } from '../../engine/build.js';

const term = (o = {}) => n('cli', 130, 250, 'Terminal: aws …', { kind: 'cli', sub: o.sub || 'AWS CLI v2', ...o });
const api = (o = {}) => n('api', 870, 250, 'AWS API endpoint', { kind: 'aws', sub: o.sub || 'https://s3.us-east-1.amazonaws.com', ...o });

export default {
  id: 'aws-cli-credentials',
  title: 'The AWS CLI and credentials: how your terminal proves who it is',
  level: 'Beginner',
  minutes: 30,
  tags: ['AWS', 'CLI', 'Credentials', 'SSO'],
  summary: 'What the AWS CLI really sends, the order in which it looks for credentials, the two config files and their profiles, `aws configure` vs `aws configure sso` vs `aws login`, assuming roles from a profile, output and query tricks, and how to debug the classic credential errors.',
  learn: ['Command anatomy: service, operation, parameters — and the HTTPS call behind it', 'The credential provider chain, in order', '~/.aws/config vs ~/.aws/credentials and named profiles', 'Static keys vs IAM Identity Center vs `aws login`', 'Role profiles with MFA and `sts get-caller-identity`', '`--query`, `--output`, pagination, waiters and `--debug`'],
  steps: [
    {
      short: 'What the CLI is', title: 'Every command is one signed HTTPS request', tag: 'concept',
      scene: { nodes: [term(), n('sign', 500, 250, 'Find credentials + sign', { kind: 'kms', sub: 'SigV4' }), api()], edges: [e('cli', 'sign', 'aws s3api list-buckets'), e('sign', 'api', 'GET / (ListBuckets)')],
        flows: [f('cli>sign', '', { kind: 'cli', every: 2.6 }), f('sign>api', 'HTTPS', { kind: 'aws', every: 2.6, delay: 0.7 }), f('sign>api', 'XML/JSON', { kind: 'aws', every: 2.6, delay: 1.6, back: true })] },
      body: [
        'The AWS CLI is a Python program that turns a command into a call to an AWS **API**. `aws s3api list-buckets` becomes an HTTPS `GET` to the S3 endpoint, signed with your credentials (SigV4), and prints the response as JSON.',
        'Command anatomy: `aws <service> <operation> [--parameters]`. Operations map 1:1 to API actions, written in kebab-case: `ListBuckets` → `list-buckets`, `PutObject` → `put-object`. A few services also have friendly high-level commands, e.g. `aws s3 cp` / `aws s3 sync` on top of `aws s3api`.',
        'Use **v2** (the bundled installer; v1 is legacy). `aws --version` shows it. `aws help`, `aws s3api help`, `aws s3api put-object help` show every parameter.',
      ],
      code: { file: 'anatomy.sh', lang: 'bash', src: `
aws --version                     # aws-cli/2.x.y Python/3.x ...
aws s3api list-buckets            # low-level: one API call, JSON out
aws s3 ls                         # high-level wrapper around the same API
aws sts get-caller-identity       # "who am I?" — works with ANY valid creds
# {
#   "UserId": "AIDAEXAMPLE",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/ada"
# }`, hl: [5] },
      interview: '`aws sts get-caller-identity` needs no permissions and tells you exactly which identity and account your credentials resolve to — the first command to run when anything credential-related looks wrong.',
    },
    {
      short: 'Provider chain', title: 'The credential provider chain: where the CLI looks, in order', tag: 'internals',
      scene: { nodes: [term(),
        n('c1', 450, 80, '1 · flags & env vars', { kind: 'code', sub: '--profile · AWS_ACCESS_KEY_ID…' }),
        n('c2', 450, 190, '2 · profile settings', { kind: 'file', sub: 'role_arn · sso · login · keys' }),
        n('c3', 450, 300, '3 · container credentials', { kind: 'server', sub: 'ECS task / EKS pod identity' }),
        n('c4', 450, 410, '4 · EC2 instance metadata', { kind: 'server', sub: 'IMDSv2 role creds' }),
        api({ sub: 'first match wins' })],
        edges: [e('cli', 'c1', 'try'), e('c1', 'c2', 'none?', { style: 'dashed' }), e('c2', 'c3', 'none?', { style: 'dashed' }), e('c3', 'c4', 'none?', { style: 'dashed' }), e('c2', 'api', 'found → sign')],
        flows: [f('cli>c1', '', { kind: 'cli', every: 3 }), f('c1>c2', '', { kind: 'cli', every: 3, delay: 0.6 }), f('c2>api', 'creds', { kind: 'sts', every: 3, delay: 1.2 })] },
      body: [
        'The CLI and every AWS SDK use the same **[[cred-chain|credential provider chain]]** and stop at the first source that works:',
        '<ol><li><b>Command line / environment:</b> an explicit `--profile` is used as asked. Otherwise `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (+ `AWS_SESSION_TOKEN`) win over the files — even over `AWS_PROFILE`.</li><li><b>The selected profile</b> in `~/.aws/config` / `~/.aws/credentials`: assume a role (`role_arn`), web identity (`web_identity_token_file`), IAM Identity Center (`sso_session`), console login (`login_session`), static keys, or `credential_process`.</li><li><b>Container credentials</b> — ECS tasks and EKS Pod Identity expose role credentials at a local endpoint.</li><li><b>EC2 instance metadata (IMDSv2)</b> — the instance profile’s role.</li></ol>',
        'Consequence: a forgotten `export AWS_ACCESS_KEY_ID=…` in your shell silently overrides the profile you think you are using.',
      ],
      callout: { kind: 'warn', title: 'Classic trap', text: 'Exported key variables beat `AWS_PROFILE` and the default profile. If `aws sts get-caller-identity` shows the wrong account, run `env | grep AWS_` first.' },
    },
    {
      short: 'Config files', title: 'Two files, many profiles', tag: 'code',
      scene: { nodes: [n('cfg', 220, 150, '~/.aws/config', { kind: 'file', sub: 'region · output · sso · roles' }), n('cred', 220, 360, '~/.aws/credentials', { kind: 'key', sub: 'secrets only (static keys)' }), term({ sub: '--profile dev' }), api()],
        edges: [e('cfg', 'cli', 'settings'), e('cred', 'cli', 'keys'), e('cli', 'api', 'signed call')],
        flows: [f('cfg>cli', '', { kind: 'file', every: 3 }), f('cred>cli', '', { kind: 'key', every: 3, delay: 0.5 }), f('cli>api', '', { kind: 'cli', every: 3, delay: 1.2 })], keepSpacing: true },
      body: [
        'Settings live in `~/.aws/config`; long-term secrets (if any) in `~/.aws/credentials` (on Windows: `%USERPROFILE%\\.aws\\`). Each file holds **[[cli-profile|profiles]]**; the one named `default` is used when you don’t choose.',
        'Notice the header syntax differs: `[profile dev]` in **config**, but just `[dev]` in **credentials**. The CLI merges both by name.',
        'Choose a profile per command (`--profile dev`) or per shell (`export AWS_PROFILE=dev`, or `$env:AWS_PROFILE="dev"` in PowerShell). **Region** resolves as `--region` → `AWS_REGION` → `AWS_DEFAULT_REGION` → the profile’s `region`.',
      ],
      code: { file: '~/.aws/config', lang: 'toml', src: `
[default]
region = eu-west-1
output = json

[profile dev]
region = us-east-1
output = table

# ~/.aws/credentials  (note: no "profile" word here)
[default]
aws_access_key_id     = AKIAEXAMPLE111
aws_secret_access_key = wJalr...EXAMPLEKEY`, hl: [5, 9, 10] },
    },
    {
      short: 'aws configure', title: '`aws configure`: the classic (static key) setup', tag: 'code',
      scene: { nodes: [n('you', 130, 250, 'You', { kind: 'user', sub: 'paste key + secret' }), n('cred', 460, 160, '~/.aws/credentials', { kind: 'key', sub: 'AKIA… stored in plain text', state: 'upd' }), n('cfg', 460, 340, '~/.aws/config', { kind: 'file', sub: 'region, output' }), api({ sub: 'works until key is revoked' })],
        edges: [e('you', 'cred', 'aws configure'), e('you', 'cfg'), e('cred', 'api', 'sign')],
        flows: [f('you>cred', 'secret', { kind: 'key', every: 3 }), f('cred>api', '', { kind: 'key', every: 3, delay: 1 })] },
      body: [
        '`aws configure` asks four questions — access key ID, secret, default region, output format — and writes them into the two files. It is still how many tutorials start, and it works with any IAM user’s access keys.',
        'The problem: the secret sits in a plain-text file forever. Anything that can read your home folder (malware, a backup, a careless `git add ~`) can copy it. If you must use keys, scope them tightly, rotate them, and consider `credential_process` with a vault, or `aws-vault`.',
      ],
      code: { file: 'configure.sh', lang: 'bash', src: `
aws configure                         # default profile
# AWS Access Key ID [None]: AKIAEXAMPLE111
# AWS Secret Access Key [None]: ********
# Default region name [None]: eu-west-1
# Default output format [None]: json
aws configure --profile dev           # a second, named profile
aws configure list                    # where each value came from
aws configure get region --profile dev
aws configure set output yaml`, hl: [1, 7] },
    },
    {
      short: 'SSO profile', title: '`aws configure sso`: temporary credentials from Identity Center', tag: 'code',
      scene: { nodes: [term({ sub: 'aws sso login' }), n('br', 450, 120, 'Browser', { kind: 'browser', sub: 'sign in + MFA, approve device' }), n('cache', 450, 380, '~/.aws/sso/cache', { kind: 'file', sub: 'access token (hours)' }), n('sts', 700, 250, 'SSO → role creds', { kind: 'sts', sub: 'GetRoleCredentials' }), api({ sub: 'ASIA… + session token' })],
        edges: [e('cli', 'br', 'opens'), e('br', 'cache', 'token', { style: 'dashed' }), e('cache', 'sts'), e('sts', 'api')],
        flows: [f('cli>br', 'login', { kind: 'cli', every: 3.2 }), f('cache>sts', '', { kind: 'sts', every: 3.2, delay: 1 }), f('sts>api', 'temp creds', { kind: 'sts', every: 3.2, delay: 1.6 })] },
      body: [
        'With IAM Identity Center, run `aws configure sso` once. It records an **sso-session** (your portal URL and region) and a profile that names an account and a permission set (role).',
        '`aws sso login` opens the browser; you sign in with MFA; the CLI stores a token in `~/.aws/sso/cache`. Every command then exchanges it for **temporary role credentials** automatically. When the session ends, you just log in again — nothing long-lived is ever on disk.',
      ],
      code: { file: '~/.aws/config', lang: 'toml', src: `
[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = eu-west-1
sso_registration_scopes = sso:account:access

[profile prod-readonly]
sso_session = acme
sso_account_id = 210987654321
sso_role_name = ReadOnlyAccess
region = eu-west-1

# then:  aws sso login --sso-session acme
#        aws s3 ls --profile prod-readonly`, hl: [1, 7, 8, 9] },
    },
    {
      short: 'aws login', title: '`aws login`: console sign-in, CLI credentials', tag: 'code',
      scene: { nodes: [term({ sub: 'aws login' }), n('br', 450, 140, 'Console sign-in', { kind: 'browser', sub: 'root / IAM user / federation + MFA' }), n('cache', 450, 360, '~/.aws/login/cache', { kind: 'file', sub: 'refreshable session' }), api({ sub: 'auto-rotated temp creds' })],
        edges: [e('cli', 'br', 'OAuth 2.0 + PKCE'), e('br', 'cache', '', { style: 'dashed' }), e('cache', 'api', 'short-lived')],
        flows: [f('cli>br', '', { kind: 'cli', every: 3 }), f('cache>api', 'temp', { kind: 'sts', every: 3, delay: 1.2 })] },
      body: [
        'Since AWS CLI **2.32.0** (Nov 2025), `aws login` lets you reuse the way you already sign in to the console — root, IAM user or IAM federation — to get **short-lived, auto-refreshed** credentials for the CLI, SDKs and tools that use them. It is now AWS’s recommended way for local development when you are not using Identity Center.',
        'It writes a profile with a `login_session` setting; credentials are cached under `~/.aws/login/cache`. `aws logout` deletes them. Older SDKs that don’t understand login sessions can use the CLI as a `credential_process`.',
      ],
      code: { file: 'login.sh', lang: 'bash', src: `
aws login                       # browser opens → pick a console session or sign in
aws login --profile signin      # store it under a named profile
aws sts get-caller-identity --profile signin
aws logout --profile signin

# resulting ~/.aws/config entry (example)
[profile signin]
login_session = arn:aws:iam::123456789012:user/ada
region = eu-west-1`, hl: [1, 8] },
    },
    {
      short: 'Role profiles', title: 'Assuming a role from a profile (with MFA)', tag: 'code',
      scene: { zones: [z('a', 330, 60, 300, 400, 'Account A (identity)', 'iam'), z('b', 680, 60, 300, 400, 'Account B (prod)', 'aws')], nodes: [term({ sub: '--profile prod-admin' }), n('src', 480, 160, 'source_profile: ada', { kind: 'user', sub: 'keys or SSO' }), n('sts', 480, 350, 'STS AssumeRole', { kind: 'sts', sub: '+ MFA code' }), n('role', 830, 250, 'Role: Admin', { kind: 'iam', sub: 'trusts account A' })],
        edges: [e('cli', 'src'), e('src', 'sts', 'AssumeRole'), e('sts', 'role', 'temp creds as role')],
        flows: [f('src>sts', 'MFA', { kind: 'mfa', every: 3 }), f('sts>role', 'ASIA…', { kind: 'sts', every: 3, delay: 1 })] },
      body: [
        'A profile can say “start with these credentials, then assume this role”. The CLI calls `sts:AssumeRole`, caches the temporary credentials in `~/.aws/cli/cache`, and refreshes them when they expire.',
        'This is how people work across accounts: one identity, many roles. Adding `mfa_serial` makes the CLI prompt for an MFA code, so the role’s trust policy can require `aws:MultiFactorAuthPresent`.',
      ],
      code: { file: '~/.aws/config', lang: 'toml', src: `
[profile ada]
region = eu-west-1                       # keys for ada in ~/.aws/credentials

[profile prod-admin]
role_arn = arn:aws:iam::210987654321:role/Admin
source_profile = ada
mfa_serial = arn:aws:iam::123456789012:mfa/ada
role_session_name = ada-cli
duration_seconds = 3600

# aws s3 ls --profile prod-admin   → "Enter MFA code for arn:aws:iam::…:mfa/ada:"`, hl: [5, 6, 7] },
    },
    {
      short: 'Output & query', title: 'Shaping output: `--query`, `--output`, pagination, waiters', tag: 'code',
      scene: { nodes: [term(), n('json', 470, 250, 'Full JSON response', { kind: 'file', sub: 'hundreds of fields' }), n('out', 820, 250, 'Just what you need', { kind: 'code', sub: '--query + --output text' })],
        edges: [e('cli', 'json', 'call'), e('json', 'out', 'JMESPath filter')],
        flows: [f('cli>json', '', { kind: 'cli', every: 2.6 }), f('json>out', '', { kind: 'code', every: 2.6, delay: 0.8 })] },
      body: [
        '`--query` filters the response **client-side** with JMESPath; `--output` picks `json`, `yaml`, `text` (tab-separated, great for shell loops) or `table`.',
        'List commands paginate automatically: the CLI keeps calling the API until done. Control it with `--max-items`, `--page-size` (smaller pages avoid timeouts) and `--starting-token`. **Waiters** poll until a state is reached. `--cli-input-json` + `--generate-cli-skeleton` let you keep long requests in files.',
      ],
      code: { file: 'query.sh', lang: 'bash', src: `
aws s3api list-buckets --query "Buckets[].Name" --output text
aws s3api list-objects-v2 --bucket my-bucket --prefix logs/2026/ \\
  --query "Contents[?Size > \`1048576\`].[Key,Size]" --output table
aws s3api list-objects-v2 --bucket my-bucket --max-items 100 --page-size 50
aws s3api wait bucket-exists --bucket my-bucket
aws s3api put-bucket-tagging --generate-cli-skeleton > tagging.json
aws s3api put-bucket-tagging --cli-input-json file://tagging.json`, hl: [1, 3, 5] },
    },
    {
      short: 'Debugging', title: 'Debugging the four classic errors', tag: 'scenario',
      scene: { nodes: [term({ state: 'bad', sub: 'error!' }), n('e1', 520, 90, 'Unable to locate credentials', { kind: 'note', icon: false }), n('e2', 520, 200, 'ExpiredToken', { kind: 'note', icon: false }), n('e3', 520, 310, 'AccessDenied (… is not authorized)', { kind: 'note', icon: false }), n('e4', 520, 420, 'SignatureDoesNotMatch / TimeSkew', { kind: 'note', icon: false })],
        edges: [e('cli', 'e1', '', { style: 'dashed' }), e('cli', 'e2', '', { style: 'dashed' }), e('cli', 'e3', '', { style: 'dashed' }), e('cli', 'e4', '', { style: 'dashed' })] },
      body: [
        '<ul><li><b>Unable to locate credentials</b> — nothing in the chain matched: wrong profile name, empty `AWS_PROFILE`, or SSO/login never run.</li><li><b>ExpiredToken</b> — temporary credentials ran out: `aws sso login` / `aws login` again; for env-var sessions, fetch new ones.</li><li><b>AccessDenied … is not authorized to perform: s3:PutObject on resource …</b> — you are authenticated but a policy doesn’t allow it (or explicitly denies). The message names the identity ARN, action and resource; some services return an encoded message you decode with `aws sts decode-authorization-message`.</li><li><b>SignatureDoesNotMatch / RequestTimeTooSkewed</b> — wrong secret, or your computer’s clock is off by more than ~5 minutes.</li></ul>',
        '`--debug` prints the whole story: which provider supplied credentials, the canonical request, the endpoint and the raw response.',
      ],
      code: { file: 'debug.sh', lang: 'bash', src: `
env | grep AWS_                       # hidden overrides?
aws configure list --profile dev      # which source each value came from
aws sts get-caller-identity --profile dev
aws s3 ls --profile dev --debug 2>&1 | grep -i "credentials\\|endpoint"
aws sts decode-authorization-message --encoded-message <msg> \\
  --query DecodedMessage --output text | jq .`, hl: [1, 3, 4] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'How does the AWS CLI decide which credentials to use?', a: ['It walks the credential provider chain and uses the first source found: explicit profile/env vars, then the profile’s configuration (assume role, web identity, SSO, login session, static keys, credential_process), then container credentials, then EC2 instance metadata.'] },
    { lvl: 'J', q: 'Difference between ~/.aws/config and ~/.aws/credentials?', a: ['config holds settings (region, output, SSO, role_arn…) with `[profile name]` headers; credentials holds secrets with `[name]` headers. Both are merged by profile name.'] },
    { lvl: 'M', q: 'Why prefer `aws configure sso` or `aws login` over `aws configure`?', a: ['They produce temporary credentials tied to a real sign-in with MFA, cached for hours and refreshed or re-requested; nothing long-lived sits in plain text. `aws configure` stores a permanent access key on disk.'] },
    { lvl: 'M', q: 'How do you work in another account from the CLI?', a: ['Create a profile with role_arn (in the other account), source_profile (your identity) and optionally mfa_serial; the CLI calls AssumeRole and caches temporary credentials. The role’s trust policy must allow your account/identity.'] },
    { lvl: 'S', q: 'A CI job suddenly writes to the production account instead of staging. How could that happen and how do you prevent it?', a: ['Environment variables or a default profile on the runner overrode the intended profile; or a shared credentials file was reused. Prevent it with per-job OIDC roles (no stored keys), explicit `--profile`/role per stage, `aws sts get-caller-identity` checks that assert the account ID before deploying, and SCPs/permission boundaries that stop staging roles from touching production.'], why: 'Connects the provider chain to real incidents and defence in depth.' },
  ],
  history: {
    timeline: [
      { yr: '2013', title: 'AWS CLI v1', text: 'One unified Python CLI replaced separate per-service command-line tools.' },
      { yr: '2020', title: 'AWS CLI v2', text: 'Bundled installer, SSO support, auto-prompt, paginated output, YAML.', c: 'g' },
      { yr: '2022', title: 'sso-session configuration', text: 'Refreshable Identity Center tokens shared across profiles.' },
      { yr: 'Nov 2025', title: '`aws login`', text: 'Console credentials → short-lived CLI/SDK credentials, no access keys needed.', c: 'g' },
    ],
    alts: { cols: ['Method', 'Credential on disk', 'Best for'], rows: [['aws configure (keys)', 'permanent secret', 'legacy, last resort'], ['aws configure sso', 'refreshable token', 'companies with Identity Center'], ['aws login', 'refreshable session', 'single accounts, root/IAM users, learning'], ['Role profile (role_arn)', 'cached temp creds', 'cross-account work'], ['aws-vault / credential_process', 'OS keychain', 'when keys are unavoidable'], ['CloudShell', 'none (browser session)', 'quick tasks without installing anything']] },
  },
  quiz: [
    { q: '`AWS_ACCESS_KEY_ID` is exported and you run `aws s3 ls --profile dev`. Which credentials are used?', o: ['dev profile', 'the environment variables', 'both', 'it fails'], a: 0, why: 'An explicit --profile wins over environment credentials for that command; without --profile the env vars win over the default profile.' },
    { q: 'Profile header in ~/.aws/config for a profile named dev?', o: ['[dev]', '[profile dev]', '{dev}', 'profile: dev'], a: 1, why: 'Only the credentials file uses [dev].' },
    { q: 'Which command tells you which identity your credentials map to?', o: ['aws iam get-user', 'aws sts get-caller-identity', 'aws whoami', 'aws configure list'], a: 1, why: 'Works with any valid credentials and needs no permissions.' },
    { q: '“RequestTimeTooSkewed” usually means…', o: ['IAM denied you', 'your system clock is wrong', 'the bucket is in another region', 'expired MFA'], a: 1, why: 'Signatures include a timestamp.' },
    { q: 'Which keeps no long-term secret on disk?', o: ['aws configure', 'aws login', 'a credentials file', 'AKIA env vars'], a: 1, why: 'It caches short-lived, refreshable credentials.' },
  ],
  cheat: `<h3>Files</h3><pre>~/.aws/config        [profile dev]  region, output, sso_session, role_arn, login_session
~/.aws/credentials   [dev]          aws_access_key_id, aws_secret_access_key</pre>
  <h3>Choose identity</h3><pre>--profile dev   |  export AWS_PROFILE=dev   |  AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN
region: --region > AWS_REGION > AWS_DEFAULT_REGION > profile</pre>
  <h3>Sign in</h3><pre>aws configure           # static keys (avoid)
aws configure sso       # Identity Center → aws sso login
aws login / aws logout  # console credentials (CLI ≥ 2.32)
aws sts get-caller-identity</pre>
  <h3>Output</h3><pre>--query "Buckets[].Name" --output text|json|yaml|table
--max-items N --page-size N --starting-token T
aws s3api wait bucket-exists --bucket b
--debug</pre>`,
};
