import { n, e, f, z } from '../../engine/build.js';

const reg = (id, x, y, w, h, label) => z(id, x, y, w, h, label, 'aws');

export default {
  id: 'aws-regions',
  title: 'Regions, Availability Zones & the global footprint',
  level: 'Beginner',
  minutes: 35,
  tags: ['AWS', 'Regions', 'Availability Zones', 'Resilience', 'CDK'],
  summary: 'Where your resources physically run: partitions, Regions, Availability Zones and the edge. You learn region codes and AZ IDs, opt-in Regions, which services are global and why so much points at us-east-1, how to choose a Region, how the CLI, SDK and CDK pick one, how to block Regions with an SCP, and when to go multi-AZ or multi-Region.',
  learn: [
    'Partition → Region → Availability Zone → data centre, and today’s numbers',
    'Region codes, AZ names vs AZ IDs, and where the Region appears in ARNs and endpoints',
    'Opt-in Regions: enabling them in the console and CLI, and the STS token gotcha',
    'Partitions (aws, aws-cn, aws-us-gov, aws-eusc) and the European Sovereign Cloud',
    'Global vs regional services, and the us-east-1 quirks every engineer hits',
    'Local Zones, Wavelength Zones, Outposts and CloudFront edge locations',
    'Choosing a Region: latency, law, features, price',
    'Region in the CLI, SDK and CDK (`env`, per-Region bootstrap) and blocking Regions with an SCP',
    'Multi-AZ vs multi-Region and the four disaster-recovery strategies',
  ],
  steps: [
    {
      short: 'The map', title: 'The building blocks: partition → Region → AZ → data centre', tag: 'concept',
      scene: { zones: [reg('r', 330, 60, 560, 380, 'Region eu-west-1 (Ireland)')], nodes: [
        n('you', 110, 250, 'Your users', { kind: 'user', sub: 'Dublin, London, Paris' }),
        n('a', 470, 130, 'AZ eu-west-1a', { kind: 'server', sub: 'own power + network' }),
        n('b', 760, 130, 'AZ eu-west-1b', { kind: 'server', sub: 'kilometres away' }),
        n('c', 615, 350, 'AZ eu-west-1c', { kind: 'server', sub: 'own power + network' })],
        edges: [e('you', 'a', 'internet'), e('a', 'b', 'private fibre', { dir: 'both' }), e('b', 'c', '', { dir: 'both' }), e('c', 'a', '', { dir: 'both' })],
        flows: [f('you>a', 'request', { kind: 'user', every: 2.6 }), f('a>b', 'sync', { kind: 'net', every: 2.6, delay: 0.7 }), f('b>c', '', { kind: 'net', every: 2.6, delay: 1.2 })] },
      facts: [['Regions', '39'], ['Availability Zones', '124'], ['AZs per Region', '≥ 3'], ['announced', 'Saudi Arabia, Chile']],
      body: [
        'AWS’s hardware is organised in four nested levels. A **[[partition]]** is a completely separate copy of AWS (the normal one is called `aws`). Inside it are **[[region|Regions]]** — geographic areas such as Ireland (`eu-west-1`) or Mumbai (`ap-south-1`). Each Region has at least three **[[az|Availability Zones]]** (AZs), and each AZ is one or more **data centres** with their own power, cooling and network.',
        'As of November 2026 AWS lists **39 Regions and 124 AZs**, with Regions in Saudi Arabia and Chile announced. Recent arrivals include Mexico (Central), Thailand, Taipei (`ap-east-2`) and New Zealand (`ap-southeast-6`), and London gained a fourth AZ. These numbers change a few times a year, so treat any count (including this one) as a snapshot.',
        'Regions are **isolated from each other on purpose**: a problem in one Region should not spread to another, and your data stays in the Region you chose unless *you* copy it out. AZs inside a Region are close enough for fast synchronous replication but far enough apart that a flood, fire or power cut hits only one.',
      ],
      callout: { kind: 'tip', title: 'Think of it as', text: 'A bank (partition) with branches in many cities (Regions). In each city it runs three or more separate buildings (AZs) on different power grids, linked by its own private cables.' },
    },
    {
      short: 'Inside a Region', title: 'Why AZs exist: surviving a data-centre failure', tag: 'concept',
      scene: { zones: [reg('r', 300, 50, 600, 400, 'Region eu-west-1')], nodes: [
        n('you', 110, 250, 'Users', { kind: 'user' }),
        n('lb', 430, 250, 'Load balancer', { kind: 'lb', sub: 'spans all AZs' }),
        n('a', 760, 110, 'App in AZ a', { kind: 'server', state: 'bad', sub: 'power cut' }),
        n('b', 760, 250, 'App in AZ b', { kind: 'server', state: 'ok' }),
        n('c', 760, 390, 'App in AZ c', { kind: 'server', state: 'ok' })],
        edges: [e('you', 'lb', 'HTTPS'), e('lb', 'a', 'health check ✗'), e('lb', 'b'), e('lb', 'c')],
        flows: [f('you>lb', '', { kind: 'user', every: 1.6 }), f('lb>a', '', { kind: 'lb', every: 2.4, fail: true }), f('lb>b', 'traffic', { kind: 'lb', every: 1.6, delay: 0.3 }), f('lb>c', 'traffic', { kind: 'lb', every: 1.6, delay: 0.8 })] },
      facts: [['AZ distance', 'within ~100 km'], ['latency', 'single-digit ms'], ['blast radius', 'one AZ'], ['data transfer', 'cross-AZ costs extra']],
      body: [
        'An AZ is the unit of failure you design for. AWS places the AZs of a Region physically apart (many kilometres, but within roughly 100 km / 60 miles) and joins them with redundant private fibre, so round trips between AZs stay in the low single-digit milliseconds.',
        '**Multi-AZ** is the default answer for high availability: run copies of your app in two or three AZs behind a load balancer, use RDS/Aurora Multi-AZ, and let regional services do it for you — S3 Standard, DynamoDB, SQS and Lambda already spread data and compute across several AZs.',
        'Some things are **zonal** and live in exactly one AZ: an EC2 instance, an EBS volume, a subnet, an S3 Express One Zone directory bucket. If that AZ fails, they fail. Also note that traffic *between* AZs is billed per GB, so chatty services spread across AZs cost a little more.',
      ],
      interview: 'If asked “how do you make this highly available?”, start with “multi-AZ”: at least two AZs behind a load balancer, a Multi-AZ database, and regional managed services. Only then talk about multi-Region, which is a much bigger cost and complexity step.',
    },
    {
      short: 'AZ name vs ID', title: 'AZ names (us-east-1a) vs AZ IDs (use1-az1)', tag: 'internals',
      scene: { nodes: [
        n('acA', 150, 140, 'Account A', { kind: 'aws', sub: 'sees “us-east-1a”' }),
        n('acB', 150, 360, 'Account B', { kind: 'aws', sub: 'sees “us-east-1a”' }),
        n('z1', 640, 140, 'Physical AZ use1-az1', { kind: 'server' }),
        n('z4', 640, 360, 'Physical AZ use1-az4', { kind: 'server' })],
        edges: [e('acA', 'z1', 'us-east-1a →'), e('acB', 'z4', 'us-east-1a →')],
        flows: [f('acA>z1', '', { kind: 'aws', every: 2.6 }), f('acB>z4', '', { kind: 'aws', every: 2.6, delay: 0.8 })] },
      body: [
        'Every AZ has two labels. The **AZ name** (`us-east-1a`) is what consoles and most APIs show. The **[[az-id|AZ ID]]** (`use1-az1`) is the stable, physical identifier. In many Regions AWS maps names to physical AZs differently per account, so *your* `us-east-1a` and a partner’s `us-east-1a` can be different buildings. The AZ ID is the same for everyone.',
        'Use AZ IDs whenever two accounts must line up: sharing subnets with AWS RAM, placing a service next to a vendor’s endpoint for low latency, or naming S3 Express One Zone directory buckets (their names include the AZ ID, e.g. `logs--use1-az4--x-s3`).',
      ],
      code: { file: 'azs.sh', lang: 'bash', src: `
aws ec2 describe-availability-zones --region us-east-1 \\
  --query "AvailabilityZones[].[ZoneName,ZoneId,ZoneType]" --output table
# ------------------------------------------------
# |  us-east-1a | use1-az1 | availability-zone |
# |  us-east-1b | use1-az2 | availability-zone |
# ...
# add --all-availability-zones to also list Local Zones and Wavelength Zones` , hl: [1, 2] },
      callout: { kind: 'warn', title: 'Common mistake', text: 'Two teams agree to “put everything in us-east-1a” to avoid cross-AZ latency and end up in different buildings. Agree on the AZ ID, not the name.' },
    },
    {
      short: 'Codes & ARNs', title: 'Region codes, endpoints and where the Region hides in an ARN', tag: 'concept',
      scene: { nodes: [
        n('code', 160, 120, 'eu-central-1', { kind: 'aws', sub: 'area-direction-number', mono: true }),
        n('name', 160, 260, 'Europe (Frankfurt)', { kind: 'note', icon: false, sub: 'console display name' }),
        n('ep', 600, 120, 's3.eu-central-1.amazonaws.com', { kind: 'net', sub: 'regional endpoint', mono: true }),
        n('arn', 600, 260, 'arn:aws:lambda:eu-central-1:…', { kind: 'policy', sub: 'Region inside the ARN', mono: true }),
        n('arn2', 600, 400, 'arn:aws:s3:::my-bucket', { kind: 's3', sub: 'empty Region field', mono: true })],
        edges: [e('code', 'ep', 'used in'), e('code', 'arn', 'used in')],
        flows: [f('code>ep', '', { kind: 'aws', every: 2.6 }), f('code>arn', '', { kind: 'policy', every: 2.6, delay: 0.7 })] },
      body: [
        'A Region code reads **area-direction-number**: `us-east-1`, `eu-west-2`, `ap-south-1`, `me-central-1`, `il-central-1`, `mx-central-1`. The number just counts Regions in that area (`ap-east-2` is Taipei, a different country from `ap-east-1` Hong Kong). Consoles show a friendly name like *Europe (Frankfurt)*; code and IAM always use the code.',
        'Every regional service has a **regional endpoint** like `dynamodb.eu-central-1.amazonaws.com`. The SDK builds it from the Region you configure, and SigV4 signs the Region into each request, so a request signed for one Region is rejected by another.',
        'ARNs carry the Region too: `arn:partition:service:region:account-id:resource`. Global services leave the Region empty (`arn:aws:iam::123456789012:role/Deploy`), and S3 bucket ARNs leave both Region and account empty (`arn:aws:s3:::my-bucket`) because, historically, bucket names were globally unique.',
      ],
      code: { file: 'arns.txt', lang: 'text', src: `
arn:aws:lambda:eu-central-1:123456789012:function:resize   # regional
arn:aws:dynamodb:eu-central-1:123456789012:table/Orders   # regional
arn:aws:iam::123456789012:role/Deploy                    # global: no Region
arn:aws:s3:::my-bucket                                    # no Region, no account
arn:aws:s3:::my-bucket/reports/2026/*                     # objects
arn:aws-cn:s3:::my-bucket                                 # China partition` , hl: [1, 3, 4] },
    },
    {
      short: 'Opt-in Regions', title: 'Opt-in Regions: switched off until you enable them', tag: 'code',
      scene: { zones: [z('acct', 300, 60, 600, 380, 'Your AWS account', 'aws')], nodes: [
        n('you', 110, 250, 'Admin', { kind: 'user', sub: 'account:EnableRegion' }),
        n('def', 470, 150, 'us-east-1, eu-west-1, …', { kind: 'aws', sub: 'enabled by default', state: 'ok' }),
        n('opt', 470, 350, 'ap-east-2 (Taipei)', { kind: 'aws', sub: 'opt-in: disabled', state: 'dim' }),
        n('iam', 790, 250, 'IAM + STS', { kind: 'iam', sub: 'copies identities in' })],
        edges: [e('you', 'opt', 'enable-region'), e('iam', 'opt', 'propagate', { style: 'dashed' }), e('iam', 'def', '', { style: 'dashed' })],
        flows: [f('you>opt', 'enable', { kind: 'user', every: 3 }), f('iam>opt', 'minutes–hours', { kind: 'iam', every: 3, delay: 1 })] },
      body: [
        'Regions that launched **before 20 March 2019** are enabled in every account and cannot be disabled. Regions launched after that date are **[[opt-in-region|opt-in Regions]]**: disabled by default, and IAM data and credentials do not even exist there until you enable them. Examples: Cape Town, Hong Kong, Bahrain, Milan, Jakarta, Hyderabad, Melbourne, Zurich, Spain, UAE, Tel Aviv, Calgary, Malaysia, Mexico, Thailand, Taipei, New Zealand.',
        '**Console:** account menu → *Account* → *AWS Regions* → select the Region → *Enable*. **CLI:** `aws account enable-region`. Enabling takes from minutes to a few hours while IAM copies your users and roles there. Disabling later does not delete resources; they simply become unreachable (and keep billing).',
        'One classic gotcha: session tokens from the old **global STS endpoint** (`sts.amazonaws.com`) are only valid in opt-in Regions if the account issues **v2 tokens**. Modern SDKs and CLI v2 call the regional STS endpoint by default, which avoids it.',
      ],
      code: { file: 'regions.sh', lang: 'bash', src: `
# which Regions can I use?
aws account list-regions --region-opt-status-contains ENABLED ENABLED_BY_DEFAULT \\
  --query "Regions[].RegionName"

aws account get-region-opt-status --region-name ap-east-2   # DISABLED
aws account enable-region          --region-name ap-east-2   # → ENABLING → ENABLED

# tokens from the global STS endpoint valid in every Region
aws iam set-security-token-service-preferences \\
  --global-endpoint-token-version v2Token` , hl: [2, 6, 9, 10] },
      callout: { kind: 'insight', title: 'Organizations', text: 'From the management account you can enable or disable Regions for member accounts with `--account-id`, and guard the rest with an SCP (later in this lesson).' },
    },
    {
      short: 'Partitions', title: 'Partitions: separate copies of AWS', tag: 'concept',
      scene: { nodes: [
        n('aws', 200, 120, 'aws', { kind: 'aws', sub: 'commercial: 30+ Regions', mono: true }),
        n('cn', 640, 120, 'aws-cn', { kind: 'aws', sub: 'China: Beijing, Ningxia', mono: true }),
        n('gov', 200, 380, 'aws-us-gov', { kind: 'lock', sub: 'GovCloud (US)', mono: true }),
        n('eusc', 640, 380, 'aws-eusc', { kind: 'lock', sub: 'European Sovereign Cloud', mono: true }),
        n('wall', 420, 250, 'No shared accounts, IAM or keys', { kind: 'note', icon: false })],
        edges: [], flows: [] },
      facts: [['commercial', 'aws'], ['China', 'aws-cn'], ['US government', 'aws-us-gov'], ['EU sovereign', 'aws-eusc']],
      body: [
        'A **[[partition]]** is a group of Regions with its own accounts, IAM, endpoints and console. Credentials from one partition do nothing in another, and you cannot replicate or peer across them with normal features.',
        '<ul><li><b>`aws`</b> — the commercial Regions almost everyone uses.</li><li><b>`aws-cn`</b> — China (`cn-north-1` Beijing, `cn-northwest-1` Ningxia), run by local partners; separate sign-up, `.amazonaws.com.cn` endpoints.</li><li><b>`aws-us-gov`</b> — AWS GovCloud (US) for regulated US workloads.</li><li><b>`aws-eusc`</b> — the **AWS European Sovereign Cloud**, generally available since January 2026 with Region `eusc-de-east-1` in Germany, run by EU-resident staff and independent of the other Regions.</li></ul>',
        'In code, never hard-code `arn:aws:`. Use the partition the stack is deployed to, so the same CDK app works in GovCloud, China or the sovereign cloud.',
      ],
      code: { file: 'lib/partition.ts', lang: 'ts', src: `
import { Aws, Stack, Arn } from 'aws-cdk-lib';

// ✗ breaks in aws-cn / aws-us-gov / aws-eusc
const bad = 'arn:aws:s3:::my-bucket';

// ✓ partition-aware (inside a Construct)
const good = \`arn:\${Aws.PARTITION}:s3:::my-bucket\`;
const roleArn = Arn.format({ service: 'iam', region: '', resource: 'role',
  resourceName: 'Deploy' }, Stack.of(this));` , hl: [7, 8] },
    },
    {
      short: 'Global vs regional', title: 'Global services and the us-east-1 quirks', tag: 'concept',
      scene: { zones: [z('g', 60, 50, 380, 400, 'Global', 'iam'), reg('use1', 500, 50, 400, 180, 'us-east-1'), reg('euw1', 500, 280, 400, 170, 'eu-west-1')], nodes: [
        n('iam', 250, 120, 'IAM · Organizations', { kind: 'iam' }),
        n('cf', 250, 250, 'CloudFront · Route 53', { kind: 'cdn' }),
        n('waf', 250, 380, 'Billing · Budgets', { kind: 'aws' }),
        n('acm', 700, 140, 'ACM cert for CloudFront', { kind: 'lock', sub: 'must live here' }),
        n('s3', 700, 365, 'S3 · Lambda · DynamoDB', { kind: 's3', sub: 'regional' })],
        edges: [e('cf', 'acm', 'uses cert from'), e('cf', 's3', 'origin')],
        flows: [f('cf>acm', '', { kind: 'cdn', every: 2.8 }), f('cf>s3', 'cache miss', { kind: 'cdn', every: 2.8, delay: 0.9 })] },
      body: [
        'Most services are **regional**: a Lambda in `eu-west-1` is invisible from the `us-east-1` console. A few are **global**: IAM, Organizations, Route 53, CloudFront, Global Accelerator, and the billing tools. Their identities and settings work in every Region.',
        '“Global” services still have a home: many of their control planes (the APIs that *change* things) run in **us-east-1**. That is why you meet us-east-1 even when you never deploy there:',
        '<ul><li>ACM certificates and WAF web ACLs used by **CloudFront** must be created in `us-east-1`.</li><li>**Lambda@Edge** functions are authored in `us-east-1`.</li><li>CloudWatch **billing** metrics and alarms live in `us-east-1`.</li><li>Creating an S3 bucket anywhere else needs a `LocationConstraint`; omit it and the bucket lands in `us-east-1`.</li></ul>',
        'S3 is the odd one: buckets are regional, but the console lists all of them in one view, and (unless you use the account regional namespace) names are unique across the whole partition.',
      ],
      callout: { kind: 'bad', title: 'Classic CDK error', text: 'A stack in `eu-west-1` creates an ACM certificate for CloudFront and the deploy fails. Put the certificate in a small `us-east-1` stack and pass it across with `crossRegionReferences: true`.' },
    },
    {
      short: 'The edge', title: 'Beyond Regions: Local Zones, Wavelength, Outposts and edge locations', tag: 'concept',
      scene: { zones: [reg('r', 320, 60, 300, 380, 'Parent Region us-west-2')], nodes: [
        n('reg', 470, 150, 'Region AZs', { kind: 'server', sub: 'full service list' }),
        n('lz', 470, 360, 'Local Zone us-west-2-lax-1a', { kind: 'server', sub: 'Los Angeles', mono: false }),
        n('wl', 800, 360, 'Wavelength Zone', { kind: 'phone', sub: 'inside a 5G network' }),
        n('op', 800, 150, 'Outposts rack', { kind: 'server', sub: 'in your data centre' }),
        n('pop', 130, 250, 'CloudFront edge location', { kind: 'cdn', sub: 'cache near users' })],
        edges: [e('reg', 'lz', 'extends', { style: 'dashed' }), e('reg', 'wl', 'extends', { style: 'dashed' }), e('reg', 'op', 'managed from', { style: 'dashed' }), e('pop', 'reg', 'origin fetch')],
        flows: [f('pop>reg', '', { kind: 'cdn', every: 2.6 }), f('reg>lz', '', { kind: 'net', every: 3, delay: 0.6 })] },
      facts: [['Wavelength Zones', '33'], ['Regional edge caches', '15'], ['Local Zones', '30+ metros'], ['edge locations', 'hundreds']],
      body: [
        '<ul><li><b>[[local-zone|Local Zones]]</b> put a small set of services (EC2, EBS, some databases) in a big city, attached to a **parent Region**, for single-digit-millisecond latency or local data rules. They are opt-in (EC2 console → *Zones*, or `ModifyAvailabilityZoneGroup`) and since May 2026 the console Region selector has a *Local Zones* tab.</li><li><b>Wavelength Zones</b> sit inside telecom 5G networks for mobile apps that need very low latency.</li><li><b>Outposts</b> are AWS racks installed in your own data centre, managed from a parent Region. **Dedicated Local Zones** are built for one customer or government.</li><li><b>[[edge-location|Edge locations]]</b> are CloudFront and Route 53 points of presence in hundreds of cities. They cache and route; you cannot run your own servers there (apart from CloudFront Functions and Lambda@Edge).</li></ul>',
        'Rule of thumb: start in a normal Region; add CloudFront for global users; reach for a Local Zone only when a specific city needs it.',
      ],
    },
    {
      short: 'Choosing', title: 'How to choose a Region', tag: 'scenario',
      scene: { nodes: [
        n('law', 160, 80, '1 · Law & data residency', { kind: 'lock', sub: 'where may data live?' }),
        n('lat', 160, 190, '2 · Latency to users', { kind: 'user', sub: 'closest Region' }),
        n('svc', 160, 300, '3 · Services & features', { kind: 'aws', sub: 'is X available there?' }),
        n('px', 160, 410, '4 · Price', { kind: 'key', sub: 'varies by Region' }),
        n('pick', 600, 245, 'eu-central-1', { kind: 'aws', state: 'ok', sub: 'chosen Region', mono: true })],
        edges: [e('law', 'pick'), e('lat', 'pick'), e('svc', 'pick'), e('px', 'pick')],
        flows: [f('law>pick', '', { kind: 'lock', every: 3 }), f('lat>pick', '', { kind: 'user', every: 3, delay: 0.4 }), f('svc>pick', '', { kind: 'aws', every: 3, delay: 0.8 }), f('px>pick', '', { kind: 'key', every: 3, delay: 1.2 })] },
      body: [
        'Work through the questions **in this order** — the first one can veto everything else:',
        '<ol><li><b>Compliance:</b> does a law or contract say where data must stay (GDPR guidance, banking rules, government work)? That may force a country, GovCloud or the European Sovereign Cloud.</li><li><b>Latency:</b> pick the Region nearest most users (test with ping tools or CloudWatch Internet Monitor). Add CloudFront for everyone else.</li><li><b>Service availability:</b> new services and instance types reach big Regions first. Check with the **AWS Capabilities by Region** tool, the Regional Services List, or the SSM public parameters below.</li><li><b>Price:</b> the same service can cost noticeably more in some Regions (São Paulo and some Asia-Pacific Regions are pricier than us-east-1, us-east-2 or us-west-2).</li></ol>',
        'Also think about **blast radius**: us-east-1 is the oldest and largest Region and gets features first, but its outages are also the most visible (October 2025). Many teams choose us-east-2 or us-west-2 when they are free to.',
      ],
      code: { file: 'availability.sh', lang: 'bash', src: `
# every service available in a Region
aws ssm get-parameters-by-path \\
  --path /aws/service/global-infrastructure/regions/ap-east-2/services \\
  --query "Parameters[].Value" --output text

# every Region where a service runs
aws ssm get-parameters-by-path \\
  --path /aws/service/global-infrastructure/services/bedrock/regions \\
  --query "Parameters[].Value" --output text` , hl: [3, 4, 8, 9] },
    },
    {
      short: 'Region in code', title: 'Choosing the Region in the CLI, SDK and CDK', tag: 'code',
      scene: { nodes: [
        n('flag', 140, 80, '--region flag', { kind: 'cli', state: 'active' }),
        n('env', 140, 190, 'AWS_REGION env', { kind: 'cli' }),
        n('denv', 140, 300, 'AWS_DEFAULT_REGION', { kind: 'cli', sub: 'CLI only' }),
        n('prof', 140, 410, '~/.aws/config region', { kind: 'file' }),
        n('call', 520, 245, 'Request to eu-west-1', { kind: 'aws', sub: 'endpoint + SigV4 scope' }),
        n('cdk', 800, 245, 'CDK env', { kind: 'cfn', sub: 'account + region' })],
        edges: [e('flag', 'call', '1st'), e('env', 'call', '2nd'), e('denv', 'call', '3rd'), e('prof', 'call', '4th'), e('call', 'cdk', '', { style: 'dashed' })],
        flows: [f('flag>call', 'wins', { kind: 'cli', every: 2.8 })] },
      body: [
        'The CLI resolves the Region in this order: `--region` flag → `AWS_REGION` → `AWS_DEFAULT_REGION` → the profile’s `region` in `~/.aws/config`. The JavaScript SDK v3 reads `AWS_REGION` and the profile, or the `region` you pass to the client. No Region at all is an error for regional services.',
        'In the CDK, every stack has an **environment**. Give it an explicit `env` so lookups (VPCs, AMIs, hosted zones) work and you cannot deploy to the wrong place by accident. Leaving `env` out makes the stack *environment-agnostic*: `this.region` becomes a token resolved by CloudFormation at deploy time.',
        'Remember the bootstrap rule from the CDK lesson: **bootstrap once per account *and* Region** you deploy to, e.g. `cdk bootstrap aws://123456789012/eu-west-1 aws://123456789012/us-east-1`.',
      ],
      code: { file: 'bin/app.ts', lang: 'ts', src: `
const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;

// certificate for CloudFront must be in us-east-1
const certs = new CertStack(app, 'Certs', {
  env: { account, region: 'us-east-1' },
  crossRegionReferences: true,
});

new SiteStack(app, 'Site', {
  env: { account, region: 'eu-west-1' },
  crossRegionReferences: true,
  certificate: certs.certificate,   // passed across Regions
});` , hl: [6, 7, 11, 12, 13] },
      callout: { kind: 'tip', title: 'Default region', text: '`CDK_DEFAULT_REGION` comes from your CLI profile. In a multi-Region app, write each Region explicitly instead of relying on it.' },
    },
    {
      short: 'Block Regions', title: 'Guardrail: deny every Region you don’t use', tag: 'code',
      scene: { zones: [z('org', 300, 60, 600, 380, 'Organization: SCP on the root', 'iam')], nodes: [
        n('dev', 120, 250, 'Developer (admin)', { kind: 'user' }),
        n('ok', 600, 150, 'eu-west-1 / eu-central-1', { kind: 'aws', state: 'ok', sub: 'allowed' }),
        n('no', 600, 350, 'ap-southeast-1', { kind: 'aws', state: 'bad', sub: 'denied by SCP' }),
        n('glob', 820, 250, 'IAM, CloudFront…', { kind: 'iam', sub: 'exempt (global)' })],
        edges: [e('dev', 'ok', 'RunInstances'), e('dev', 'no', 'RunInstances')],
        flows: [f('dev>ok', 'allowed', { kind: 'user', every: 2.6 }), f('dev>no', 'AccessDenied', { kind: 'user', every: 2.6, delay: 0.8, fail: true })] },
      body: [
        'Unused Regions are where leaked keys mine crypto unnoticed. In an organization, attach an **[[scp|SCP]]** that denies requests whose `aws:RequestedRegion` is not on your list. IAM policies can use the same condition key in a single account.',
        'Global services must be **exempted** with `NotAction`, because their requests are signed for `us-east-1` (IAM, Organizations, CloudFront, Route 53, STS, Support, billing and a few more). Copy the current list from the AWS example policy rather than memorising it. **AWS Control Tower** offers the same as a ready-made *Region deny* control.',
      ],
      code: { file: 'deny-regions-scp.json', lang: 'json', src: `
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOutsideApprovedRegions",
    "Effect": "Deny",
    "NotAction": [
      "iam:*", "organizations:*", "sts:*", "support:*",
      "cloudfront:*", "route53:*", "budgets:*", "ce:*", "health:*"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] }
    }
  }]
}` , hl: [6, 7, 13] },
      interview: 'Mention the `NotAction` exemption for global services. Without it, the SCP also blocks IAM and CloudFront, because their requests are signed for us-east-1.',
    },
    {
      short: 'Multi-Region', title: 'Multi-AZ vs multi-Region, and the four DR strategies', tag: 'scenario',
      scene: { zones: [reg('p', 300, 50, 270, 400, 'eu-west-1 (primary)'), reg('s', 630, 50, 270, 400, 'eu-central-1 (standby)')], nodes: [
        n('r53', 120, 250, 'Route 53', { kind: 'net', sub: 'health-checked failover' }),
        n('app1', 435, 150, 'App (3 AZs)', { kind: 'server', state: 'active' }),
        n('db1', 435, 360, 'Primary DB', { kind: 'db' }),
        n('app2', 765, 150, 'App (scaled down)', { kind: 'server', state: 'dim' }),
        n('db2', 765, 360, 'Replica DB', { kind: 'db', sub: 'async, seconds behind' })],
        edges: [e('r53', 'app1', 'primary'), e('r53', 'app2', 'failover', { style: 'dashed' }), e('db1', 'db2', 'async replication'), e('app1', 'db1')],
        flows: [f('r53>app1', 'traffic', { kind: 'net', every: 2.2 }), f('db1>db2', 'changes', { kind: 'db', every: 2.4, delay: 0.6 })] },
      body: [
        'A whole Region failing is rare; an AZ failing is not. So **multi-AZ is the baseline**, and multi-Region is a deliberate choice for very strict uptime goals, for users on several continents, or for rules that demand a second Region.',
        'Pick a strategy by **RTO** (how long you may be down) and **RPO** (how much recent data you may lose):',
        '<ul><li><b>Backup & restore</b> — copy backups to another Region; hours to recover. Cheapest.</li><li><b>Pilot light</b> — data replicated, core infrastructure ready but switched off; tens of minutes.</li><li><b>Warm standby</b> — a scaled-down copy running all the time; minutes.</li><li><b>Multi-site active/active</b> — full capacity in two or more Regions; near zero, most expensive.</li></ul>',
        'Building blocks: S3 Cross-Region Replication and Multi-Region Access Points, DynamoDB global tables, Aurora Global Database, Route 53 health checks and failover, and Application Recovery Controller. Replication between Regions is **asynchronous** (data lag) and billed as inter-Region data transfer.',
      ],
      callout: { kind: 'insight', title: 'Static stability', text: 'Fail over using the *data plane* (Route 53 health checks already in place, capacity already running), not by calling control-plane APIs during the outage — those may be the thing that is broken.' },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What is the difference between a Region and an Availability Zone?', a: ['A Region is a geographic area (e.g. eu-west-1, Ireland) that is isolated from other Regions. An AZ is one or more data centres inside a Region with independent power and networking; every Region has at least three, linked by low-latency private fibre. You spread across AZs for high availability and across Regions for disaster recovery or global reach.'] },
    { lvl: 'J', q: 'Name some global services and explain why you meet us-east-1 even if you deploy elsewhere.', a: ['IAM, Organizations, Route 53, CloudFront, Global Accelerator and billing are global. Their control planes and some related resources are anchored in us-east-1: ACM certificates and WAF ACLs for CloudFront, Lambda@Edge, and billing metrics must be created there, and an S3 bucket created without a LocationConstraint lands there.'] },
    { lvl: 'M', q: 'What is an opt-in Region and what can go wrong with it?', a: ['Regions launched after 20 March 2019 are disabled by default; you enable them per account (console or `aws account enable-region`), which takes minutes to hours while IAM data propagates. Gotchas: tools fail with auth errors before enabling finishes, and tokens from the global STS endpoint are invalid there unless the account uses v2 tokens — use regional STS endpoints.'] },
    { lvl: 'M', q: 'Why do AZ IDs exist?', a: ['AZ names like us-east-1a can map to different physical AZs in different accounts. AZ IDs (use1-az1) identify the physical AZ consistently, so use them when coordinating across accounts (RAM-shared subnets, latency-sensitive placement, S3 Express directory bucket names).'] },
    { lvl: 'M', q: 'How do you stop anyone using Regions you do not operate in?', a: ['An SCP with Effect Deny, a NotAction list exempting global services (IAM, Organizations, STS, CloudFront, Route 53, Support, billing…), and a Condition StringNotEquals on aws:RequestedRegion with the approved Regions. Control Tower offers it as the Region deny control. Also disable unused opt-in Regions.'] },
    { lvl: 'S', q: 'Design a multi-Region setup for a payments API with RTO 5 minutes and RPO under a minute.', a: ['Warm standby (or active/active if budgets allow): the app runs in two Regions, the database replicates asynchronously (Aurora Global Database or DynamoDB global tables), Route 53 health checks / ARC routing controls switch traffic, and everything is deployed by the same CDK pipeline to both Regions. Avoid control-plane calls during failover, rehearse it regularly, make writes idempotent so retries after failover are safe, and account for replication lag in the RPO.'], why: 'Tests RTO/RPO vocabulary, async replication and static stability.' },
  ],
  history: {
    timeline: [
      { yr: '2006', title: 'One Region: us-east-1', text: 'S3 and EC2 launch in Northern Virginia.' },
      { yr: '2008', title: 'Availability Zones and a second Region', text: 'EC2 adds AZs; Europe (Ireland) opens in December.', c: 'g' },
      { yr: '2011', title: 'GovCloud (US)', text: 'The first separate partition for regulated US government workloads.' },
      { yr: '2013–2016', title: 'China partition', text: 'Beijing (2013, preview → GA 2016) and later Ningxia, operated by local partners.' },
      { yr: '2019', title: 'Opt-in Regions', text: 'New Regions are disabled by default from 20 March 2019; Local Zones start in Los Angeles.' },
      { yr: '2025', title: 'Mexico, Thailand, Taipei, New Zealand', text: 'Four new Regions in one year. In October a DynamoDB DNS failure in us-east-1 disrupts many services for hours.' },
      { yr: 'Jan 2026', title: 'AWS European Sovereign Cloud', text: 'Partition `aws-eusc`, Region `eusc-de-east-1`, independent of other Regions.', c: 'g' },
      { yr: '2026', title: '39 Regions · 124 AZs', text: 'London adds a fourth AZ; Saudi Arabia and Chile announced; Local Zones appear in the console Region selector.' },
    ],
    alts: { cols: ['Placement', 'Latency to users', 'Use it for'], rows: [['Single AZ', 'n/a', 'dev/test, zonal-only resources'], ['Multi-AZ in one Region', 'regional', 'the default for production'], ['Region + CloudFront', 'low worldwide (cached)', 'websites, APIs with cacheable reads'], ['Local Zone', 'single-digit ms in one city', 'gaming, media, local data rules'], ['Multi-Region', 'low in each continent', 'strict DR, global users, regulation'], ['Outposts', 'on-premises', 'data that must stay in your building']] },
  },
  quiz: [
    { q: 'Minimum number of AZs in an AWS Region today?', o: ['1', '2', '3', '6'], a: 2, why: 'Every Region has at least three isolated AZs.' },
    { q: 'Your `us-east-1a` and a partner’s `us-east-1a`…', o: ['are always the same building', 'may be different physical AZs — compare AZ IDs', 'are in different Regions', 'cannot both exist'], a: 1, why: 'Names can be mapped per account; AZ IDs are stable.' },
    { q: 'An ACM certificate for CloudFront must be created in…', o: ['the bucket’s Region', 'any Region', 'us-east-1', 'eu-west-1'], a: 2, why: 'CloudFront reads certificates from us-east-1.' },
    { q: 'A Region launched in 2025 is, in a new account…', o: ['enabled by default', 'disabled until you opt in', 'only for enterprises', 'read-only'], a: 1, why: 'Regions after 20 March 2019 are opt-in.' },
    { q: 'Which ARN is partition-safe in CDK?', o: ['`arn:aws:s3:::b`', '`arn:${Aws.PARTITION}:s3:::b`', '`arn:*:s3:::b`', '`s3://b`'], a: 1, why: 'Aws.PARTITION resolves to aws, aws-cn, aws-us-gov or aws-eusc.' },
    { q: 'Cheapest DR strategy, with the longest recovery time?', o: ['Active/active', 'Warm standby', 'Pilot light', 'Backup & restore'], a: 3, why: 'Only backups are copied; everything is rebuilt after the disaster.' },
  ],
  cheat: `<h3>Hierarchy</h3><p>Partition → Region (≥ 3 AZs) → AZ (1+ data centres) · 39 Regions / 124 AZs (Nov 2026)</p>
  <h3>Partitions</h3><table class="t"><tr><td><code>aws</code></td><td>commercial</td></tr><tr><td><code>aws-cn</code></td><td>China</td></tr><tr><td><code>aws-us-gov</code></td><td>GovCloud (US)</td></tr><tr><td><code>aws-eusc</code></td><td>European Sovereign Cloud (<code>eusc-de-east-1</code>)</td></tr></table>
  <h3>us-east-1 quirks</h3><ul><li>ACM certs + WAF for CloudFront · Lambda@Edge · billing metrics</li><li>S3 bucket without LocationConstraint lands there</li></ul>
  <h3>CLI</h3><pre>aws account list-regions --region-opt-status-contains ENABLED ENABLED_BY_DEFAULT
aws account enable-region --region-name ap-east-2
aws ec2 describe-availability-zones --query "AvailabilityZones[].[ZoneName,ZoneId]"
aws ssm get-parameters-by-path --path /aws/service/global-infrastructure/regions/eu-west-1/services</pre>
  <h3>Region resolution</h3><p><code>--region</code> &gt; <code>AWS_REGION</code> &gt; <code>AWS_DEFAULT_REGION</code> &gt; profile · CDK: explicit <code>env</code>, bootstrap per account+Region</p>
  <h3>DR</h3><p>Backup &amp; restore → Pilot light → Warm standby → Active/active (cost ↑, RTO/RPO ↓)</p>`,
};
