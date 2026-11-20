export default {
  title: 'AWS CDK: infrastructure written in TypeScript',
  intro: 'Clicking in the console doesn’t scale and can’t be reviewed. The AWS CDK lets you describe your cloud setup in TypeScript and deploy it repeatably. This book explains infrastructure as code, every file in a CDK project, bootstrapping and what really happens during a deploy.',
  chapters: [
    {
      level: 1, title: 'Infrastructure as code',
      text: [
        '**Infrastructure** is everything your app runs on: storage buckets, databases, functions, networks, permissions. **Infrastructure as code (IaC)** means describing all of it in files instead of clicking buttons.',
        'Files can be reviewed in pull requests, versioned in git, tested, and applied to many environments identically. If production breaks, you can see exactly what changed.',
      ],
      words: [
        ['Infrastructure', 'The cloud resources an application needs.'],
        ['IaC', 'Infrastructure as code — defining resources in files.'],
        ['Environment', 'A separate copy of your system, e.g. dev, staging, prod.'],
      ],
      example: 'A cooking recipe versus improvising: with a recipe, anyone can cook the same dish again tomorrow.',
      remember: 'If it isn’t in code, it can’t be reviewed or repeated.',
      check: ['Name one benefit of IaC over the console.', 'Reviewable changes / repeatable environments / history in git / testing.'],
    },
    {
      level: 1, title: 'CloudFormation, the engine underneath',
      text: [
        '**CloudFormation** is AWS’s own IaC service. You give it a **template** — a JSON or YAML list of resources — and it creates them as a **stack**, in the right order. Next time you change the template, it updates only what changed; if something fails, it **rolls back** to the last working state.',
        'Templates are powerful but long and repetitive, which is why the CDK exists.',
      ],
      words: [
        ['Template', 'A JSON/YAML file listing resources and their settings.'],
        ['Stack', 'The set of resources created from one template, managed together.'],
        ['Rollback', 'Automatically undoing a failed change.'],
      ],
      example: 'A builder who follows the blueprint exactly and, if a wall can’t be built, undoes the day’s work rather than leaving a half-house.',
      remember: 'CloudFormation does the creating; CDK writes the template.',
      check: ['Does the CDK create resources directly?', 'No. It generates CloudFormation templates and CloudFormation creates the resources.'],
    },
    {
      level: 1, title: 'The CDK and its two packages',
      text: [
        'The **AWS CDK** (Cloud Development Kit) lets you write infrastructure in TypeScript (or Python, Java…). Your code creates **constructs** — objects like `new s3.Bucket(…)` — and the CDK turns them into a CloudFormation template.',
        'There are two npm packages: **`aws-cdk-lib`**, the library your code imports, and **`aws-cdk`**, the `cdk` command-line tool. Since 2025 they have separate version numbers; keep the CLI at least as new as the library.',
      ],
      words: [
        ['Construct', 'A CDK building block representing one or more cloud resources.'],
        ['npm package', 'A reusable JavaScript/TypeScript library you install with npm.'],
        ['CLI tool', 'The `cdk` command you run in a terminal.'],
      ],
      example: 'LEGO instructions written in TypeScript; the CDK prints the parts list (template) for the builder.',
      remember: 'aws-cdk-lib = what you import. aws-cdk = the `cdk` command.',
      check: ['Which package does `import * as s3 from …` use?', '`aws-cdk-lib/aws-s3`.'],
    },
    {
      level: 2, title: 'The project files `cdk init` creates',
      text: [
        '`cdk init app --language typescript` creates: **`bin/`** (the entry file that creates the app and stacks), **`lib/`** (your stack classes with resources), **`test/`** (automated tests), **`cdk.json`** (how to run the app plus feature flags), **`package.json`** (dependencies and scripts) and **`tsconfig.json`** (TypeScript settings).',
        'Later a **`cdk.context.json`** appears, saving lookups (like your network IDs). Commit it so everyone gets the same result.',
      ],
      words: [
        ['Entry point', 'The first file that runs when the program starts.'],
        ['Feature flags', 'Switches in cdk.json that opt into newer CDK behaviours.'],
        ['Dependencies', 'Libraries your project needs, listed in package.json.'],
      ],
      example: 'A new kitchen fitted with labelled drawers: cutlery (bin), pots (lib), thermometer (test), instructions on the fridge (cdk.json).',
      remember: 'bin = which stacks; lib = what’s in them.',
      check: ['Should `cdk.out` be committed to git?', 'No — it is generated output (it’s in .gitignore). Commit cdk.context.json instead.'],
    },
    {
      level: 2, title: 'App, stacks, constructs and IDs',
      text: [
        'Your code builds a tree: the **App** at the top, **Stacks** under it (each becomes one CloudFormation stack), and constructs inside stacks. Every construct gets `(scope, id, props)`: who its parent is, a name unique among siblings, and its settings.',
        'The CDK turns the path of IDs into a **logical ID** in the template. If you rename or move a construct, the logical ID changes and CloudFormation thinks it is a different resource — it may delete the old one. For data stores that means data loss.',
      ],
      words: [
        ['Scope', 'The parent construct something is created inside.'],
        ['Props', 'The settings object passed to a construct.'],
        ['Logical ID', 'The resource’s name inside a CloudFormation template.'],
      ],
      example: 'Addresses: country → city → street → house. Change the street name and the post office thinks it’s a new house.',
      remember: 'Keep construct IDs stable for anything holding data.',
      check: ['Why can moving a bucket construct into a new parent be dangerous?', 'Its path, and so its logical ID, changes; CloudFormation may replace (delete and recreate) it.'],
    },
    {
      level: 2, title: 'Synth: from code to template',
      text: [
        '`cdk synth` runs your app and writes the **cloud assembly** into `cdk.out/`: the templates, the **assets** (local files such as Lambda code, zipped) and a manifest describing how to deploy.',
        'Nothing in AWS changes during synth (except read-only lookups). It is a safe way to see exactly what would be deployed.',
      ],
      words: [
        ['Synthesis', 'Turning CDK code into CloudFormation templates.'],
        ['Cloud assembly', 'The cdk.out folder that the CLI deploys from.'],
        ['Asset', 'A local file or Docker image your stack needs uploaded to AWS.'],
      ],
      example: 'Printing the final blueprint and packing list before the trucks leave.',
      remember: 'synth = preview, deploy = change.',
      check: ['Where does Lambda code end up after synth?', 'As an asset folder/zip in cdk.out, referenced by the template.'],
    },
    {
      level: 2, title: 'Bootstrapping: preparing an account',
      text: [
        'CloudFormation can only read Lambda code from S3 and images from ECR, inside your account and region. So before deploying, the CDK needs somewhere to upload assets and roles to do it safely. `cdk bootstrap` creates these once per **account + region**, in a stack called **CDKToolkit**:',
        'an **S3 staging bucket** (`cdk-hnb659fds-assets-<account>-<region>`), an **ECR repository** for Docker images, **five IAM roles** (deploy, file-publishing, image-publishing, lookup, CloudFormation execution) and an **SSM parameter** storing the bootstrap version. `hnb659fds` is a fixed default *qualifier*.',
      ],
      words: [
        ['Bootstrap', 'One-time setup of the resources CDK deployments need.'],
        ['ECR', 'Elastic Container Registry — AWS’s Docker image storage.'],
        ['SSM parameter', 'A small named value stored in AWS Systems Manager.'],
        ['Qualifier', 'A short string in bootstrap resource names that lets several setups coexist.'],
      ],
      example: 'Before shipping furniture to a new city, you rent a warehouse there and hire staff to receive deliveries.',
      remember: 'Bootstrap once per account and region.',
      check: ['You deploy to two regions. How many bootstraps?', 'Two — one per region.'],
    },
    {
      level: 3, title: 'What happens during `cdk deploy`',
      text: [
        '1) Synth. 2) Check the bootstrap version. 3) Assume the **publishing roles** and upload assets to the staging bucket/ECR. 4) Assume the **deploy role** and ask CloudFormation for a **change set** — a preview of additions, modifications and replacements. If permissions or security groups change, the CLI asks you to confirm. 5) CloudFormation executes the change set using the **execution role**, creating resources in order, and prints progress. 6) Outputs are shown.',
        'Your own credentials only need to assume the bootstrap roles; the heavy lifting is done by roles inside the account.',
      ],
      words: [
        ['Change set', 'CloudFormation’s preview of what an update will change.'],
        ['Execution role', 'The role CloudFormation uses to create your resources.'],
        ['Output', 'A value a stack prints after deploying, such as a URL.'],
      ],
      example: 'Delivery staff unload the parts, the site manager reviews the plan, then the builders build while you watch progress.',
      remember: 'Assets → change set → execute → outputs.',
      check: ['Which role actually creates your resources?', 'The CloudFormation execution role (cfn-exec role) from bootstrap.'],
    },
    {
      level: 3, title: 'Diff, destroy and staying safe',
      text: [
        '`cdk diff` compares your code with what is deployed. Watch for **replacement**: it means delete-and-recreate. `cdk destroy` deletes a stack; buckets and tables are kept by default (**RETAIN**) so data isn’t lost.',
        'Safety habits: read diffs in pull requests, keep RETAIN and **termination protection** in production, keep construct IDs stable, write tests with `aws-cdk-lib/assertions`, and restrict the bootstrap execution role in serious environments.',
      ],
      words: [
        ['Replacement', 'CloudFormation deleting a resource and creating a new one.'],
        ['RemovalPolicy', 'What happens to a resource when its stack is deleted (RETAIN / DESTROY / SNAPSHOT).'],
        ['Termination protection', 'A stack setting that blocks accidental deletion.'],
      ],
      example: 'Before renovating, compare the old and new floor plans and mark which walls get knocked down.',
      remember: 'Never ship a REPLACE on a data store without understanding it.',
      check: ['What does RETAIN do on `cdk destroy`?', 'Leaves the resource (and its data) in the account, no longer managed by the stack.'],
    },
  ],
};
