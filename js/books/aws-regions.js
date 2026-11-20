export default {
  title: 'Regions, Availability Zones and where AWS really lives',
  intro: '“The cloud” sounds like it floats somewhere. It doesn’t: it is buildings full of computers in real cities. This book explains how AWS organises those buildings, why it matters for speed, cost, law and outages, and how to pick and control where your things run.',
  chapters: [
    {
      level: 1, title: 'The cloud is real buildings',
      text: [
        'Every bucket, function and database you create in AWS runs on physical machines inside a **data centre** — a large, guarded building with racks of servers, backup generators and cooling.',
        'AWS groups those buildings into **Regions**. A Region is a geographic area such as Ireland, Frankfurt, Mumbai or Northern Virginia. When you create something, you choose the Region, and your data stays there unless you copy it elsewhere.',
      ],
      words: [
        ['Data centre', 'A building full of servers, power and network equipment.'],
        ['Region', 'A geographic area where AWS runs several separate groups of data centres, e.g. `eu-west-1` (Ireland).'],
        ['Server', 'A computer that runs programs for other computers over a network.'],
      ],
      example: 'A supermarket chain has stores in many cities. You shop at the one in your city — that is your Region.',
      remember: 'Every resource lives in a real place, and you choose the Region.',
      check: ['If you create a bucket in Ireland, is the data copied to the US automatically?', 'No. Data stays in the Region you chose unless you set up copying (e.g. replication).'],
    },
    {
      level: 1, title: 'Availability Zones: not putting all eggs in one building',
      text: [
        'Inside each Region, AWS runs at least **three Availability Zones (AZs)**. An AZ is one or more data centres with its own power, cooling and network. AZs are kilometres apart, so a flood or power cut usually hits only one.',
        'The AZs of a Region are joined by fast private cables, so copying data between them takes only a few milliseconds. That lets you run copies of your app in two or three AZs at the same time.',
        'If one AZ goes down, the copies in the others keep serving users. This is called **high availability**, and “multi-AZ” is the normal way to get it.',
      ],
      words: [
        ['Availability Zone (AZ)', 'An isolated group of data centres inside a Region.'],
        ['High availability', 'The app keeps working even when a part of it fails.'],
        ['Millisecond (ms)', 'One thousandth of a second.'],
      ],
      example: 'A hospital with three separate buildings on different power lines: if one loses power, patients are treated in the other two.',
      remember: 'Regions are far apart; AZs are close but separate. Production apps use at least two AZs.',
      check: ['What is the minimum number of AZs in a Region?', 'Three.'],
    },
    {
      level: 1, title: 'Reading Region codes',
      text: [
        'Regions have a friendly name and a **code**. *Europe (Frankfurt)* is `eu-central-1`; *US East (N. Virginia)* is `us-east-1`; *Asia Pacific (Mumbai)* is `ap-south-1`. The pattern is **area-direction-number**.',
        'Code always uses the short code: the CLI’s `--region eu-central-1`, the SDK’s `region` option, endpoints like `s3.eu-central-1.amazonaws.com`, and the Region part of an ARN.',
        'AZ names add a letter: `eu-central-1a`, `eu-central-1b`, `eu-central-1c`.',
      ],
      words: [
        ['Region code', 'The short identifier of a Region used in code, e.g. `eu-central-1`.'],
        ['Endpoint', 'The web address you send requests to, e.g. `dynamodb.eu-central-1.amazonaws.com`.'],
        ['ARN', 'Amazon Resource Name: the full unique name of a resource, which includes its Region when it has one.'],
      ],
      example: 'Airport codes: travellers say “Frankfurt”, but the luggage tag says FRA.',
      remember: 'Humans read names; code uses Region codes.',
      check: ['Which Region does `arn:aws:lambda:ap-south-1:123456789012:function:x` live in?', 'ap-south-1 (Mumbai).'],
    },
    {
      level: 2, title: 'Global services and why us-east-1 keeps appearing',
      text: [
        'Most services are **regional**: you see them only when the console is switched to that Region. A few are **global**: IAM (users and roles), Organizations, Route 53 (DNS), CloudFront (CDN) and billing. An IAM role you create works in every Region.',
        'Global services still need a home for their management APIs, and that home is mostly **us-east-1** (Northern Virginia), AWS’s first Region. So some things must be created there even if your app runs elsewhere: certificates and WAF rules for CloudFront, Lambda@Edge functions, and billing alarms.',
      ],
      words: [
        ['Global service', 'A service whose settings apply in every Region, like IAM.'],
        ['Control plane', 'The APIs that create, change and delete resources.'],
        ['Data plane', 'The part that does the actual work, e.g. serving files or answering requests.'],
        ['ACM', 'AWS Certificate Manager — issues HTTPS certificates.'],
      ],
      example: 'A company with offices worldwide, but its legal paperwork must always be filed at head office.',
      remember: 'CloudFront certificate? Create it in us-east-1.',
      check: ['Your site runs in eu-west-1 behind CloudFront. Where does the CloudFront certificate go?', 'us-east-1.'],
    },
    {
      level: 2, title: 'Opt-in Regions: locked until you ask',
      text: [
        'Regions launched **after 20 March 2019** are **opt-in**. In a new account they are switched off, and your users and roles don’t exist there yet. Older Regions are always on.',
        'To use one, an administrator enables it (console: *Account → AWS Regions*, or `aws account enable-region --region-name ap-east-2`). AWS then copies your IAM data into that Region, which can take minutes to a few hours.',
        'Until it finishes, every call fails with an “invalid token” error — a common surprise.',
      ],
      words: [
        ['Opt-in Region', 'A newer Region that is disabled until you enable it.'],
        ['Propagate', 'Spread a change to every place that needs it, which takes time.'],
      ],
      example: 'A gym chain opens a new branch; your membership card only works there after head office adds you to its system.',
      remember: 'New Region, odd auth errors? Check that it is enabled.',
      check: ['Can you disable us-east-1 in your account?', 'No. Regions enabled by default can’t be disabled — block them with an SCP instead.'],
    },
    {
      level: 2, title: 'AZ names vs AZ IDs',
      text: [
        'To spread customers evenly, AWS can map AZ *names* to physical AZs differently in each account. Your `us-east-1a` might be building 4 while your partner’s `us-east-1a` is building 6.',
        'Each physical AZ also has a fixed **AZ ID** like `use1-az4` that is the same for everyone. When two accounts must be in the same building, compare AZ IDs.',
      ],
      words: [
        ['AZ name', 'The label you see, e.g. `us-east-1a`; may differ between accounts.'],
        ['AZ ID', 'The fixed label of the physical AZ, e.g. `use1-az4`.'],
      ],
      example: 'Two friends both say “meet at the café on Main Street”, but each lives in a different town with its own Main Street. A full address (AZ ID) avoids the mix-up.',
      remember: 'Across accounts, talk in AZ IDs.',
      check: ['Which command shows both?', '`aws ec2 describe-availability-zones` — fields ZoneName and ZoneId.'],
    },
    {
      level: 2, title: 'Closer to users: CloudFront, Local Zones, Wavelength, Outposts',
      text: [
        'Distance adds delay. Light in fibre needs roughly 5 ms per 1,000 km each way, and real routes are longer. Users far from your Region feel it.',
        '**CloudFront** keeps cached copies of your content at **edge locations** in hundreds of cities. **Local Zones** are small AWS sites in big cities attached to a parent Region. **Wavelength Zones** sit inside 5G mobile networks. **Outposts** are AWS racks installed in your own building.',
      ],
      words: [
        ['Latency', 'The delay between asking and getting an answer.'],
        ['Edge location', 'A small CloudFront site near users that serves cached content.'],
        ['Local Zone', 'A mini AWS site in a city, linked to a parent Region.'],
        ['CDN', 'Content delivery network: servers worldwide that keep copies of content close to users.'],
      ],
      example: 'A bakery (Region) bakes in one city, but sends bread every morning to small kiosks (edge locations) around the country.',
      remember: 'Start with a Region + CloudFront; use Local Zones only for specific cities.',
      check: ['Can you run your own EC2 server in a CloudFront edge location?', 'No — only CloudFront Functions and Lambda@Edge code run there. Use a Local Zone or Region for servers.'],
    },
    {
      level: 3, title: 'Partitions and sovereign clouds',
      text: [
        'A **partition** is a fully separate AWS with its own accounts and logins. The normal one is `aws`. Others: `aws-cn` (China, run by local partners), `aws-us-gov` (GovCloud for US government work) and `aws-eusc` — the **AWS European Sovereign Cloud**, generally available since January 2026 in Germany (`eusc-de-east-1`), operated independently by EU-resident staff.',
        'Accounts, keys and roles never cross partitions. ARNs start with the partition (`arn:aws-cn:…`), so good code never hard-codes `arn:aws:` — in CDK use `Aws.PARTITION`.',
      ],
      words: [
        ['Partition', 'A separate copy of AWS with its own accounts, IAM and endpoints.'],
        ['Data sovereignty', 'The rule that data is controlled by the laws of the country or region where it is kept.'],
      ],
      example: 'Different countries’ passports: yours works at home, but another country issues its own.',
      remember: 'Partition = separate world. Write partition-aware ARNs.',
      check: ['Can an IAM user from `aws` sign in to `aws-cn`?', 'No. You need a separate account in the China partition.'],
    },
    {
      level: 3, title: 'Choosing and controlling Regions',
      text: [
        'Choose in this order: **law** (where may the data live?), **latency** (near most users), **services** (is everything you need available? Check *AWS Capabilities by Region*), then **price**.',
        'In code, set the Region explicitly: the CLI uses `--region` → `AWS_REGION` → `AWS_DEFAULT_REGION` → your profile. CDK stacks get an `env` with account and Region, and you bootstrap each account+Region pair once.',
        'Lock down the rest with an **SCP** that denies requests where `aws:RequestedRegion` isn’t on your list — exempting global services like IAM and CloudFront, whose calls go to us-east-1.',
      ],
      words: [
        ['SCP', 'Service control policy: an Organizations guardrail that limits what accounts can do.'],
        ['`aws:RequestedRegion`', 'The IAM condition key holding the Region a request is sent to.'],
        ['Bootstrap', 'One-time CDK setup (buckets, roles) in an account and Region.'],
      ],
      example: 'A franchise rulebook: “Shops may only open in these two cities.” Head office still handles HR for everyone.',
      remember: 'Law → latency → services → price. Deny the rest.',
      check: ['Why must the Region-deny SCP exempt `iam:*`?', 'IAM requests are signed for us-east-1, so without the exemption the SCP would block IAM everywhere.'],
    },
    {
      level: 3, title: 'When one Region is not enough',
      text: [
        'Most apps are fine with **multi-AZ** in one Region. Go **multi-Region** only for strict uptime goals, users on several continents, or rules that require it — it is much more work and money.',
        'Two numbers decide how far to go: **RTO** (how long you may be down) and **RPO** (how much recent data you may lose). From cheapest to most resilient: **backup & restore**, **pilot light**, **warm standby**, **active/active**.',
        'Data between Regions is copied **asynchronously**, so the second Region is always a little behind. Practise failover regularly, and fail over with tools that are already running (e.g. Route 53 health checks) rather than creating things during an outage.',
      ],
      words: [
        ['RTO', 'Recovery Time Objective: the longest acceptable outage.'],
        ['RPO', 'Recovery Point Objective: the most data (in time) you can afford to lose.'],
        ['Asynchronous replication', 'Copying changes shortly after they happen, so the copy lags a little.'],
        ['Failover', 'Switching traffic from a broken place to a healthy one.'],
      ],
      example: 'A spare key at a neighbour’s (backup), a second flat with the heating off (pilot light), a second flat ready to live in (warm standby), or living in two flats at once (active/active).',
      remember: 'Multi-AZ first. Multi-Region when RTO/RPO or law demand it.',
      check: ['RTO of 5 minutes — is backup & restore enough?', 'No. Restoring from backup takes hours; you need warm standby or active/active.'],
    },
  ],
};
