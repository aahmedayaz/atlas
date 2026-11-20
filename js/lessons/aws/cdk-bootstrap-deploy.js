import { n, e, f, z } from '../../engine/build.js';

const legend = ['your code|#64728a', 'CloudFormation|#c2306f', 'bootstrap resources|#d9822b', 'created resources|#3f8f3a'];

export default {
  id: 'cdk-bootstrap-deploy',
  title: 'AWS CDK in TypeScript: boilerplate, bootstrap and deploy',
  level: 'Intermediate',
  minutes: 40,
  tags: ['AWS', 'CDK', 'CloudFormation', 'TypeScript', 'IaC'],
  summary: 'Every file `cdk init` creates and why, how your TypeScript becomes a CloudFormation template (`cdk synth`), exactly what `cdk bootstrap` creates in your account (the S3 staging bucket, ECR repository, five IAM roles and a version parameter), what `cdk deploy` does step by step, and how to diff, destroy and test safely.',
  learn: ['How CDK, CloudFormation and the CLI fit together', 'The TypeScript boilerplate, file by file', 'Constructs (L1/L2/L3), construct IDs and logical IDs', '`cdk synth` and the cloud assembly (cdk.out)', 'What bootstrapping creates — names, roles, why each exists', 'The `cdk deploy` pipeline, `cdk diff`, `cdk destroy`, removal policies and tests'],
  steps: [
    {
      short: 'The big picture', title: 'CDK writes CloudFormation for you', tag: 'concept', legend,
      scene: { nodes: [n('ts', 120, 250, 'TypeScript app', { kind: 'code', sub: 'new s3.Bucket(…)' }), n('synth', 380, 250, 'cdk synth', { kind: 'cli', sub: 'runs your code' }), n('tpl', 620, 250, 'CloudFormation template', { kind: 'file', sub: 'JSON in cdk.out' }), n('cfn', 870, 150, 'CloudFormation', { kind: 'cfn', sub: 'stack engine' }), n('res', 870, 360, 'Real resources', { kind: 's3', sub: 'bucket, roles, functions' })],
        edges: [e('ts', 'synth'), e('synth', 'tpl'), e('tpl', 'cfn', 'cdk deploy'), e('cfn', 'res', 'create / update')],
        flows: [f('ts>synth', '', { kind: 'code', every: 3.2 }), f('synth>tpl', '', { kind: 'cli', every: 3.2, delay: 0.6 }), f('tpl>cfn', 'upload', { kind: 'cfn', every: 3.2, delay: 1.2 }), f('cfn>res', '', { kind: 's3', every: 3.2, delay: 1.9 })] },
      body: [
        '[[cloudformation|CloudFormation]] is AWS’s infrastructure engine: give it a template (a JSON/YAML list of resources) and it creates them, in the right order, as one [[cfn-stack|stack]] — and on the next change updates only what differs, rolling back if something fails.',
        'Templates get long and repetitive. The [[cdk|AWS CDK]] lets you write TypeScript instead: real classes, loops, types and sensible defaults. **The CDK never creates resources itself** — it *generates* CloudFormation ([[synth|synthesis]]) and asks CloudFormation to deploy it.',
        'Two separate npm packages: **`aws-cdk-lib`** (the construct library your code imports) and **`aws-cdk`** (the `cdk` command-line tool). Since February 2025 they are versioned separately: the CLI jumped to `2.1000.0`+. Rule: the CLI must be at least as new as the library.',
      ],
    },
    {
      short: 'cdk init', title: '`cdk init`: the TypeScript boilerplate, file by file', tag: 'code',
      scene: { nodes: [n('bin', 160, 110, 'bin/my-app.ts', { kind: 'code', sub: 'entry: creates App + stacks' }), n('lib', 160, 250, 'lib/my-app-stack.ts', { kind: 'code', sub: 'your resources' }), n('test', 160, 390, 'test/my-app.test.ts', { kind: 'code', sub: 'jest assertions' }), n('cdkj', 560, 110, 'cdk.json', { kind: 'file', sub: 'how to run the app + flags' }), n('pkg', 560, 250, 'package.json', { kind: 'file', sub: 'aws-cdk-lib · constructs · aws-cdk' }), n('tsc', 560, 390, 'tsconfig.json', { kind: 'file', sub: 'strict TypeScript' })],
        edges: [e('cdkj', 'bin', 'app: npx ts-node bin/…', { style: 'dashed' }), e('bin', 'lib', 'new MyAppStack()')] },
      body: [
        'Install the CLI once (`npm install -g aws-cdk`, or use `npx cdk`), then in an empty folder run `cdk init app --language typescript`. It creates a git repo, installs dependencies and these files:',
        '<ul><li>`bin/my-app.ts` — the **entry point**: creates the `App` and your stacks.</li><li>`lib/my-app-stack.ts` — your **stack class**; resources go here.</li><li>`test/my-app.test.ts` — Jest tests using `aws-cdk-lib/assertions`.</li><li>`cdk.json` — tells the CLI how to run the app (`"app": "npx ts-node --prefer-ts-exts bin/my-app.ts"`), which files `cdk watch` observes, and **feature flags** in `context`.</li><li>`package.json` — `aws-cdk-lib` and `constructs` (runtime), `aws-cdk`, `typescript`, `ts-node`, `jest` (dev). Scripts: `build`, `watch`, `test`, `cdk`.</li><li>`tsconfig.json`, `jest.config.js`, `.gitignore` (ignores `cdk.out`), `.npmignore`, `README.md`.</li></ul>',
        'Later a `cdk.context.json` appears, caching lookups like VPC IDs or AZ lists. **Commit it**, so synth gives the same result on every machine.',
      ],
      code: { file: 'terminal', lang: 'bash', src: `
npm install -g aws-cdk          # the CLI (aws-cdk), version 2.1xxx
mkdir my-app && cd my-app
cdk init app --language typescript
tree -I node_modules
# .
# ├── bin/my-app.ts
# ├── lib/my-app-stack.ts
# ├── test/my-app.test.ts
# ├── cdk.json  jest.config.js  package.json  tsconfig.json
# └── README.md  .gitignore  .npmignore`, hl: [3] },
    },
    {
      short: 'bin/ entry', title: 'bin/my-app.ts: the App and the environment', tag: 'code',
      scene: { zones: [z('app', 330, 90, 560, 330, 'App (root of the construct tree)', 'cfn')], nodes: [n('bin', 120, 250, 'bin/my-app.ts', { kind: 'code' }), n('s1', 610, 180, 'MyAppStack', { kind: 'cfn', sub: 'env: 1234…/eu-west-1' }), n('s2', 610, 330, 'MyAppStack-Prod', { kind: 'cfn', sub: 'env: 9876…/us-east-1' })],
        edges: [e('bin', 's1', 'new'), e('bin', 's2', 'new')] },
      body: [
        '`new cdk.App()` is the root of a tree of **[[construct|constructs]]**. Each `new SomeStack(app, \'Id\', props)` adds a stack under it; each stack becomes one CloudFormation stack.',
        'The `env` prop pins a stack to an **account and region**. Without it the stack is *environment-agnostic*: it deploys wherever your current credentials point, but cannot look up things like existing VPCs. `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` are filled in by the CLI from your profile.',
      ],
      code: { file: 'bin/my-app.ts', lang: 'ts', src: `
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyAppStack } from '../lib/my-app-stack';

const app = new cdk.App();

new MyAppStack(app, 'MyAppStack', {
  // uses the account/region of the profile you deploy with
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new MyAppStack(app, 'MyAppStack-Prod', {
  env: { account: '987654321098', region: 'us-east-1' },   // pinned
  terminationProtection: true,
});

cdk.Tags.of(app).add('project', 'my-app');                 // tags every resource`, hl: [6, 8, 10, 14] },
    },
    {
      short: 'lib/ stack', title: 'lib/my-app-stack.ts: constructs, IDs and levels', tag: 'code',
      scene: { zones: [z('st', 300, 70, 640, 380, 'MyAppStack', 'cfn')], nodes: [n('code', 110, 250, 'my-app-stack.ts', { kind: 'code' }), n('l2', 470, 160, 'Bucket (L2)', { kind: 's3', sub: 'id: "Uploads"' }), n('l1', 470, 340, 'CfnBucket (L1)', { kind: 'cfn', sub: 'logical ID UploadsA1B2C3D4' }), n('pol', 790, 160, 'BucketPolicy', { kind: 'policy', sub: 'auto-created (enforceSSL)' }), n('fn', 790, 340, 'Function (L2)', { kind: 'lambda', sub: 'grantRead → IAM policy' })],
        edges: [e('l2', 'l1', 'wraps', { style: 'dashed' }), e('l2', 'pol', 'adds'), e('fn', 'l2', 'reads')] },
      body: [
        'Constructs come in three levels: **L1** (`CfnBucket`) — exactly the CloudFormation resource, every property, no defaults; **L2** (`s3.Bucket`) — a friendly class with secure defaults and helper methods like `grantRead()`; **L3** patterns — several resources wired together (e.g. `LambdaRestApi`).',
        'Every construct gets `(scope, id, props)`. The **id** must be unique among siblings; CDK turns the path into a CloudFormation **logical ID** plus a hash (`UploadsA1B2C3D4`). Change the id and CloudFormation sees a *different* resource: it deletes the old one and creates a new one — for a bucket or database that can mean data loss.',
      ],
      code: { file: 'lib/my-app-stack.ts', lang: 'ts', src: `
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class MyAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const uploads = new s3.Bucket(this, 'Uploads', {      // L2
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,                 // keep data on stack delete
    });

    const fn = new lambda.Function(this, 'Thumbnailer', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/thumbnailer'),   // an ASSET → needs bootstrap
      timeout: Duration.seconds(30),
    });
    uploads.grantRead(fn);                                 // writes the IAM policy for you

    new CfnOutput(this, 'BucketName', { value: uploads.bucketName });
  }
}`, hl: [10, 13, 19, 22] },
    },
    {
      short: 'cdk synth', title: '`cdk synth`: from TypeScript to cdk.out', tag: 'internals', legend,
      scene: { nodes: [n('cli', 120, 250, 'cdk synth', { kind: 'cli', sub: 'reads cdk.json "app"' }), n('run', 390, 250, 'ts-node bin/my-app.ts', { kind: 'code', sub: 'builds construct tree' }),
        n('out', 700, 250, 'cdk.out/', { kind: 'file', sub: 'the cloud assembly' }), n('tpl', 960, 110, 'MyAppStack.template.json', { kind: 'file' }), n('ast', 960, 250, 'asset.9f2c…/ (lambda code)', { kind: 'file' }), n('man', 960, 390, 'manifest.json · tree.json', { kind: 'file' })],
        edges: [e('cli', 'run'), e('run', 'out', 'app.synth()'), e('out', 'tpl'), e('out', 'ast'), e('out', 'man')],
        flows: [f('cli>run', '', { kind: 'cli', every: 3 }), f('run>out', '', { kind: 'code', every: 3, delay: 0.7 })] },
      body: [
        '`cdk synth` runs the `app` command from `cdk.json`. Your code builds the construct tree; then the App **synthesises** it into the [[cloud-assembly|cloud assembly]] — the `cdk.out` folder:',
        '<ul><li>one `*.template.json` per stack (pure CloudFormation)</li><li>`asset.<hash>` folders/zips for local files (Lambda code) and Docker contexts</li><li>`manifest.json` (stacks, environments, which bootstrap roles and bucket to use, required bootstrap version) and `tree.json`</li></ul>',
        'Nothing has touched AWS yet. Synth is also where validation runs: missing props, aspects such as cdk-nag, and context lookups (which *do* call AWS through the lookup role and are cached in `cdk.context.json`).',
      ],
      code: { file: 'cdk.out/MyAppStack.template.json (excerpt)', lang: 'json', src: `
{
  "Resources": {
    "UploadsA1B2C3D4": {
      "Type": "AWS::S3::Bucket",
      "Properties": { "VersioningConfiguration": { "Status": "Enabled" } },
      "UpdateReplacePolicy": "Retain",
      "DeletionPolicy": "Retain"
    },
    "ThumbnailerE7F8A9B0": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
          "S3Bucket": "cdk-hnb659fds-assets-123456789012-eu-west-1",
          "S3Key": "9f2c…e1.zip"
        }
      }
    }
  }
}`, hl: [3, 13, 14] },
      interview: 'Notice the Lambda code points at a bucket called `cdk-hnb659fds-assets-…`. That bucket does not exist until you bootstrap — which is exactly why bootstrapping is needed.',
    },
    {
      short: 'Why bootstrap', title: 'Why the account must be bootstrapped first', tag: 'concept', legend,
      scene: { nodes: [n('cli', 120, 250, 'cdk deploy', { kind: 'cli', sub: 'has a 40 MB lambda.zip' }), n('q', 450, 250, 'Where do I put it?', { kind: 'note', icon: false }), n('cfn', 790, 250, 'CloudFormation', { kind: 'cfn', sub: 'only reads code from S3/ECR', state: 'dim' })],
        edges: [e('cli', 'q', '', { style: 'dashed' }), e('q', 'cfn', '?', { style: 'dashed' })] },
      body: [
        'CloudFormation can only take Lambda code from **S3** and container images from **ECR**, and templates above 51 KB must also be uploaded to S3. So before deploying, the CDK needs a bucket and a repository *in the target account and region* — plus IAM roles that allow the CLI (and CI pipelines in other accounts) to use them safely.',
        'Creating those once per **account + region** is called [[bootstrap|bootstrapping]]. Bootstrap every combination you deploy to: `aws://123456789012/eu-west-1` and `aws://123456789012/us-east-1` are separate environments.',
      ],
      code: { file: 'terminal', lang: 'bash', src: `
cdk bootstrap                                   # current profile's account/region
cdk bootstrap aws://123456789012/eu-west-1 --profile dev
# Pipelines: let account 111111111111 deploy into this one
cdk bootstrap aws://222222222222/eu-west-1 \\
  --trust 111111111111 \\
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess`, hl: [1, 2, 5] },
    },
    {
      short: 'What it creates', title: 'Inside the CDKToolkit stack', tag: 'internals', legend,
      scene: { zones: [z('tk', 260, 50, 760, 430, 'CloudFormation stack: CDKToolkit (qualifier hnb659fds)', 'aws')], nodes: [
        n('b', 450, 120, 'S3 staging bucket', { kind: 's3', sub: 'cdk-hnb659fds-assets-<acct>-<region>', state: 'active' }),
        n('ecr', 450, 230, 'ECR repository', { kind: 'aws', sub: 'cdk-hnb659fds-container-assets-…' }),
        n('ssm', 450, 340, 'SSM parameter', { kind: 'file', sub: '/cdk-bootstrap/hnb659fds/version' }),
        n('dep', 830, 90, 'deploy-role', { kind: 'iam', sub: 'assumed by the CLI' }), n('fp', 830, 180, 'file-publishing-role', { kind: 'iam', sub: 'write to the bucket' }), n('ip', 830, 270, 'image-publishing-role', { kind: 'iam', sub: 'push to ECR' }), n('lk', 830, 360, 'lookup-role', { kind: 'iam', sub: 'read-only context lookups' }), n('ex', 830, 450, 'cfn-exec-role', { kind: 'iam', sub: 'CloudFormation creates resources' }),
        n('cli', 110, 250, 'cdk bootstrap', { kind: 'cli' })],
        edges: [e('cli', 'b', 'CloudFormation creates')], flows: [f('cli>b', '', { kind: 'cli', every: 3 })], h: 520 },
      body: [
        '`cdk bootstrap` deploys a CloudFormation stack named **CDKToolkit** containing:',
        '<ul><li><b>Staging bucket</b> `cdk-hnb659fds-assets-<account>-<region>` — encrypted, versioned, Block Public Access on, lifecycle rule that deletes old (noncurrent) versions. Holds file assets and large templates.</li><li><b>ECR repository</b> `cdk-hnb659fds-container-assets-<account>-<region>` for Docker image assets.</li><li><b>Five IAM roles</b> (`cdk-hnb659fds-<name>-role-<account>-<region>`): **deploy-role** (the CLI assumes it to run CloudFormation), **file-publishing-role** (upload to the bucket), **image-publishing-role** (push to ECR), **lookup-role** (read-only lookups during synth), **cfn-exec-role** (passed to CloudFormation, which uses it to create your resources — `AdministratorAccess` by default, restrict it with `--cloudformation-execution-policies`).</li><li><b>SSM parameter</b> `/cdk-bootstrap/hnb659fds/version` — the template version. Apps declare a minimum; if yours is older, deploy says “run cdk bootstrap”.</li></ul>',
        '`hnb659fds` is the default **qualifier**, a fixed string that lets several bootstrap stacks coexist (`--qualifier dev2026`).',
      ],
      callout: { kind: 'warn', title: 'Don’t delete it', text: 'Deleting CDKToolkit (or emptying its bucket) breaks every CDK stack in that environment that references assets. Re-running `cdk bootstrap` is safe and upgrades it in place.' },
    },
    {
      short: 'cdk deploy', title: '`cdk deploy`, step by step', tag: 'internals', legend,
      scene: { nodes: [n('cli', 100, 250, 'cdk deploy', { kind: 'cli', sub: 'your profile' }), n('dep', 330, 120, 'deploy-role', { kind: 'iam', sub: 'AssumeRole' }), n('fp', 330, 380, 'file-publishing-role', { kind: 'iam' }),
        n('b', 590, 380, 'staging bucket', { kind: 's3', sub: 'assets + template' }), n('cfn', 620, 120, 'CloudFormation', { kind: 'cfn', sub: 'change set → execute' }), n('ex', 880, 120, 'cfn-exec-role', { kind: 'iam' }), n('res', 900, 360, 'Your resources', { kind: 's3', sub: 'bucket · lambda · roles', state: 'ok' })],
        edges: [e('cli', 'dep', '1 assume'), e('cli', 'fp', '2 assume'), e('fp', 'b', '3 upload assets'), e('dep', 'cfn', '4 create change set'), e('cfn', 'ex', '5 uses'), e('ex', 'res', '6 create/update'), e('b', 'cfn', 'reads', { style: 'dashed' })],
        flows: [f('cli>dep', '', { kind: 'cli', every: 4 }), f('fp>b', 'zip', { kind: 'file', every: 4, delay: 0.6 }), f('dep>cfn', '', { kind: 'cfn', every: 4, delay: 1.3 }), f('ex>res', '', { kind: 's3', every: 4, delay: 2.2 })], h: 500 },
      body: [
        '<ol><li><b>Synth</b> (unless you pass `--app cdk.out`).</li><li><b>Check bootstrap</b> version via the SSM parameter.</li><li><b>Publish assets</b>: assume the file-/image-publishing roles; upload zips to the staging bucket and push images to ECR (skipped if the hash already exists).</li><li><b>Create a [[changeset|change set]]</b> through the deploy role. If IAM or security-group changes are present, the CLI shows them and asks for approval (`--require-approval never` in CI).</li><li><b>Execute</b>: CloudFormation, using the cfn-exec role, creates/updates/deletes resources in dependency order, streaming events to your terminal.</li><li><b>Outputs</b> (`CfnOutput`) are printed; `--outputs-file out.json` saves them.</li></ol>',
        'If any resource fails, CloudFormation **rolls back** the whole stack to the previous state. Your credentials only need permission to assume the bootstrap roles — the powerful work is done by roles inside the account.',
      ],
      code: { file: 'terminal', lang: 'bash', src: `
cdk list                         # stacks in the app
cdk diff MyAppStack              # what would change (vs deployed template)
cdk deploy MyAppStack --profile dev
cdk deploy --all --require-approval never --outputs-file out.json   # CI
cdk deploy --hotswap             # dev only: patch Lambda code directly, skips CFN
cdk watch                        # re-deploys on file save (dev)`, hl: [2, 3] },
    },
    {
      short: 'Diff & destroy', title: 'Changes, replacements and `cdk destroy`', tag: 'concept',
      scene: { nodes: [n('diff', 140, 250, 'cdk diff', { kind: 'cli', sub: '[~] modify  [-/+] REPLACE' }), n('cfn', 470, 250, 'CloudFormation', { kind: 'cfn' }), n('keep', 820, 140, 'Bucket (RETAIN)', { kind: 's3', sub: 'kept after destroy', state: 'ok' }), n('gone', 820, 360, 'Lambda, roles', { kind: 'lambda', sub: 'deleted', state: 'dim' })],
        edges: [e('diff', 'cfn', 'cdk destroy'), e('cfn', 'keep', 'skips'), e('cfn', 'gone', 'deletes')] },
      body: [
        '**Always read `cdk diff`.** `[~]` means modified in place; `[-]`/`[+]` or *requires replacement* means delete-and-recreate — e.g. renaming a construct id or changing a bucket name. For stateful resources that is data loss.',
        '`cdk destroy` deletes the stack. Stateful resources default to **RETAIN** (S3 buckets, DynamoDB tables): they are left behind, orphaned. For throwaway dev stacks use `removalPolicy: RemovalPolicy.DESTROY` plus `autoDeleteObjects: true` (CDK adds a custom resource that empties the bucket first). Never on production data.',
        'Production stacks: enable `terminationProtection`, keep `RETAIN`, and add CloudFormation stack policies if needed.',
      ],
      callout: { kind: 'bad', title: 'Common mistake', text: 'Refactoring a construct into a new parent changes its path → new logical ID → CloudFormation replaces it. Keep IDs stable or override logical IDs before moving stateful constructs. `cdk refactor` (still in preview: run it with `--unstable=refactor`) can move resources to new logical IDs without replacing them.' },
    },
    {
      short: 'Testing', title: 'Testing infrastructure with assertions', tag: 'code',
      scene: { nodes: [n('t', 160, 250, 'jest test', { kind: 'code', sub: 'Template.fromStack(stack)' }), n('tpl', 520, 250, 'synthesised template', { kind: 'file', sub: 'in memory' }), n('ok', 860, 250, 'pass / fail', { kind: 'build', sub: 'npm test in CI', state: 'ok' })],
        edges: [e('t', 'tpl', 'synth'), e('tpl', 'ok', 'assert')], flows: [f('t>tpl', '', { kind: 'code', every: 2.6 }), f('tpl>ok', '', { kind: 'build', every: 2.6, delay: 0.8 })] },
      body: [
        'Because stacks are code, you can unit-test the generated template without deploying: assert a bucket is encrypted and versioned, count resources, check an IAM policy. Snapshot tests catch accidental changes. Run them in CI with `npm test` before `cdk deploy`.',
      ],
      code: { file: 'test/my-app.test.ts', lang: 'ts', src: `
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { MyAppStack } from '../lib/my-app-stack';

test('uploads bucket is versioned and private', () => {
  const t = Template.fromStack(new MyAppStack(new App(), 'Test'));
  t.resourceCountIs('AWS::S3::Bucket', 1);
  t.hasResourceProperties('AWS::S3::Bucket', {
    VersioningConfiguration: { Status: 'Enabled' },
  });
  t.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  t.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: { Statement: Match.arrayWith([
      Match.objectLike({ Action: Match.arrayWith(['s3:GetObject*']) }),
    ]) },
  });
});`, hl: [6, 8, 12] },
    },
  ],
  interview: [
    { lvl: 'J', q: 'What does `cdk synth` produce?', a: ['A cloud assembly in cdk.out: one CloudFormation template per stack, asset folders/zips, a manifest and tree.json. It does not deploy anything.'] },
    { lvl: 'J', q: 'Why do you need `cdk bootstrap`?', a: ['CloudFormation needs assets (Lambda code, Docker images, large templates) in S3/ECR inside the target account/region, and the CDK needs roles to publish and deploy. Bootstrapping creates the CDKToolkit stack with the staging bucket, ECR repo, five roles and a version parameter, once per account+region.'] },
    { lvl: 'M', q: 'Name the bootstrap roles and their purpose.', a: ['deploy-role (CLI assumes it to manage CloudFormation), file-publishing-role (uploads file assets to the staging bucket), image-publishing-role (pushes images to ECR), lookup-role (read-only context lookups), cfn-exec-role (passed to CloudFormation to create resources; AdministratorAccess by default, can be restricted).'] },
    { lvl: 'M', q: 'L1 vs L2 vs L3 constructs?', a: ['L1 (Cfn*) map 1:1 to CloudFormation resources with no defaults; L2 add sensible defaults, types and helpers like grant methods; L3 compose several resources into a pattern.'] },
    { lvl: 'M', q: 'Why can renaming a construct ID destroy data?', a: ['The logical ID is derived from the construct path. A new ID means CloudFormation sees a new resource and an old one to delete, so a bucket/table is replaced. Check `cdk diff` for replacements, keep IDs stable, use RETAIN, or the preview `cdk refactor --unstable=refactor`.'] },
    { lvl: 'S', q: 'Design a safe multi-account CDK deployment setup.', a: ['Separate dev/staging/prod accounts in Organizations; bootstrap each target with `--trust` for a tools/CI account and a restricted `--cloudformation-execution-policies` (or a permissions boundary); CI authenticates with OIDC to a role in the tools account and assumes the target deploy roles; pipelines run tests and `cdk diff`, require approval for IAM/security changes and prod; termination protection and RETAIN for stateful resources; cdk.context.json committed.'], why: 'Shows you understand that bootstrap roles are the security boundary of CDK deployments.' },
  ],
  history: {
    timeline: [
      { yr: '2011', title: 'CloudFormation', text: 'Declarative JSON templates; YAML support came in 2016.' },
      { yr: '2019', title: 'AWS CDK v1 GA', text: 'Infrastructure in TypeScript/Python/Java/C# synthesising CloudFormation; one npm package per service.', c: 'g' },
      { yr: '2021', title: 'CDK v2', text: 'All stable constructs in one package, aws-cdk-lib; modern bootstrap required.' },
      { yr: 'Feb 2025', title: 'CLI and library split', text: 'The `aws-cdk` CLI moved to its own repo and version line (2.1000.0+).' },
      { yr: 'Sep 2025', title: 'cdk refactor (preview)', text: 'Move/rename constructs while keeping the deployed resources; still needs `--unstable=refactor`.', c: 'g' },
    ],
    alts: { cols: ['Tool', 'Language', 'Engine', 'Pick it when'], rows: [['CloudFormation', 'YAML/JSON', 'CloudFormation', 'simple stacks, no build step'], ['AWS CDK', 'TS, Python, Java, C#, Go', 'CloudFormation', 'AWS-only, want real code and L2 defaults'], ['AWS SAM', 'YAML', 'CloudFormation', 'serverless apps with local testing'], ['Terraform / OpenTofu', 'HCL', 'own state file', 'multi-cloud, large existing modules'], ['Pulumi', 'TS, Python, Go…', 'own engine', 'multi-cloud with real languages'], ['SST', 'TypeScript', 'Pulumi/Terraform', 'full-stack serverless web apps']] },
  },
  quiz: [
    { q: 'Which package does your stack code import?', o: ['aws-cdk', 'aws-cdk-lib', 'aws-sdk', 'cdk-cli'], a: 1, why: 'aws-cdk is the CLI; aws-cdk-lib is the construct library.' },
    { q: 'The default bootstrap stack is called…', o: ['CDKToolkit', 'CdkBootstrap', 'cdk.out', 'AWSCDK'], a: 0, why: 'Stack name CDKToolkit, qualifier hnb659fds.' },
    { q: 'Which role does CloudFormation use to actually create your resources?', o: ['deploy-role', 'lookup-role', 'cfn-exec-role', 'your IAM user'], a: 2, why: 'The deploy role passes the execution role to CloudFormation.' },
    { q: 'What does `RemovalPolicy.RETAIN` on a bucket do on `cdk destroy`?', o: ['Deletes it', 'Empties it', 'Leaves it in the account', 'Moves it to Glacier'], a: 2, why: 'The bucket is orphaned, data kept.' },
    { q: 'You deploy to eu-west-1 and us-east-1 in one account. How many bootstraps?', o: ['1', '2', 'none', 'one per stack'], a: 1, why: 'Per account + region.' },
  ],
  cheat: `<h3>Commands</h3><pre>cdk init app --language typescript
cdk synth | cdk list | cdk diff | cdk deploy [--all] [--profile p]
cdk bootstrap aws://ACCOUNT/REGION [--trust ACCT] [--cloudformation-execution-policies ARN] [--qualifier q]
cdk destroy | cdk watch | cdk deploy --hotswap | cdk doctor</pre>
  <h3>Bootstrap (CDKToolkit, qualifier hnb659fds)</h3><ul><li>S3: cdk-hnb659fds-assets-ACCOUNT-REGION</li><li>ECR: cdk-hnb659fds-container-assets-ACCOUNT-REGION</li><li>Roles: deploy · file-publishing · image-publishing · lookup · cfn-exec</li><li>SSM: /cdk-bootstrap/hnb659fds/version</li></ul>
  <h3>Files</h3><table class="t"><tr><td>bin/app.ts</td><td>new App(), new Stack(app, id, {env})</td></tr><tr><td>lib/*-stack.ts</td><td>constructs (scope, id, props)</td></tr><tr><td>cdk.json</td><td>"app" command, watch, feature flags</td></tr><tr><td>cdk.context.json</td><td>cached lookups — commit it</td></tr><tr><td>cdk.out/</td><td>cloud assembly — gitignored</td></tr></table>
  <h3>Safety</h3><ul><li>Read cdk diff for REPLACE · keep construct IDs stable · RETAIN stateful · termination protection in prod</li></ul>`,
};
