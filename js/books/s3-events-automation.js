export default {
  title: 'S3 events, lifecycle and scheduling',
  intro: 'A bucket doesn’t have to be passive. It can tell your code when files arrive, move old data to cheaper storage by itself, and work with schedulers to run nightly jobs. This book explains event-driven design from scratch, plus the traps (duplicates, loops, time zones).',
  chapters: [
    {
      level: 1, title: 'Polling vs events',
      text: [
        '**Polling** means asking again and again: “anything new?”. It wastes requests and reacts slowly. **Event-driven** design means the system tells you when something happens. S3 can send an **event** whenever an object is created, deleted, restored, replicated, tagged or moved by lifecycle.',
      ],
      words: [
        ['Polling', 'Repeatedly checking for changes.'],
        ['Event', 'A message saying something happened, with details.'],
        ['Event-driven', 'A design where code runs in response to events.'],
      ],
      example: 'Checking the door every minute for a parcel versus having a doorbell.',
      remember: 'Let S3 ring the doorbell.',
      check: ['Name two downsides of polling a bucket.', 'Wasted requests/cost and slow reaction.'],
    },
    {
      level: 1, title: 'Event Notifications',
      text: [
        'An **event notification** rule on a bucket says: for these **event types** (e.g. `s3:ObjectCreated:*`), with this **prefix/suffix** filter (e.g. `uploads/` and `.jpg`), send a message to this **destination**: a Lambda function, an SQS queue or an SNS topic.',
        'The destination must allow S3 to send to it (a resource policy). S3 sends a test event when you save the rule.',
      ],
      words: [
        ['Event type', 'Which kind of change triggers the event.'],
        ['Filter', 'Prefix/suffix rules limiting which keys trigger it.'],
        ['Destination', 'Where the event is delivered.'],
      ],
      example: '“Ring my phone when a .jpg arrives in the uploads tray.”',
      remember: 'Type + filter + destination + permission.',
      check: ['Can two rules for the same event type overlap in prefix?', 'No — overlapping rules for the same event type aren’t allowed.'],
    },
    {
      level: 1, title: 'Lambda, SQS and SNS',
      text: [
        '**Lambda** runs your function code when an event arrives. **SQS** is a queue: messages wait until a worker processes them. **SNS** fans one message out to many subscribers (email, queues, functions).',
        'Putting **SQS** between S3 and Lambda absorbs bursts, enables batching and retries, and parks failing messages in a **dead-letter queue**.',
      ],
      words: [
        ['Lambda', 'Serverless functions that run on events.'],
        ['SQS', 'A message queue service.'],
        ['SNS', 'A publish/subscribe notification service.'],
        ['Dead-letter queue', 'A queue for messages that failed processing too many times.'],
      ],
      example: 'A waiting room (SQS) in front of a doctor (Lambda); patients who can’t be helped go to a special desk (DLQ).',
      remember: 'S3 → SQS → Lambda is the robust default.',
      check: ['Why not send S3 events straight to Lambda at very high volume?', 'A queue smooths bursts, batches work and keeps failures instead of losing them.'],
    },
    {
      level: 2, title: 'Duplicates, order and encoded keys',
      text: [
        'S3 delivers events **at least once**: rarely the same event arrives twice, and events may arrive out of order. So consumers must be **idempotent** — processing twice must be harmless. The `sequencer` field orders events for the same key.',
        'Keys in events are **URL-encoded**: `my photo.jpg` arrives as `my+photo.jpg`. Decode before using it.',
      ],
      words: [
        ['At-least-once', 'Delivered one or more times, never zero.'],
        ['Idempotent', 'Safe to repeat.'],
        ['URL-encoding', 'Writing special characters in a URL-safe form, e.g. space as `+`.'],
      ],
      example: 'A postman who sometimes delivers the same letter twice — you check “already paid?” before paying a bill again.',
      remember: 'Dedupe and decode.',
      check: ['How can you make an email sender idempotent?', 'Record a key (bucket+key+versionId) with a conditional write and skip if it already exists.'],
    },
    {
      level: 2, title: 'EventBridge',
      text: [
        'If you enable **EventBridge** on a bucket, every S3 event goes to an **event bus**. **Rules** on the bus filter events by any field — prefix, suffix, size, requester — and send them to many kinds of targets. Several rules can match the same event, and events can be archived and replayed.',
      ],
      words: [
        ['Event bus', 'A router that receives events and passes them to rules.'],
        ['Rule', 'A filter plus targets on an event bus.'],
        ['Target', 'The service that receives matching events.'],
      ],
      example: 'A switchboard operator who can forward one call to several departments based on what was said.',
      remember: 'Simple single target → notifications. Rich routing → EventBridge.',
      check: ['Which can filter by object size: notifications or EventBridge?', 'EventBridge.'],
    },
    {
      level: 2, title: 'Avoiding infinite loops',
      text: [
        'If a function triggered by new files in `uploads/` writes its output back into `uploads/`, each output triggers the function again — forever. This **recursive loop** can run millions of invocations and a large bill.',
        'Always write outputs to a **different bucket** or a **different prefix** that your filter doesn’t match, and add alarms on invocation counts and spending.',
      ],
      words: [
        ['Recursive loop', 'A process that triggers itself again and again.'],
        ['Invocation', 'One run of a function.'],
      ],
      example: 'A microphone placed next to its own speaker: the sound feeds back until it screeches.',
      remember: 'Input prefix ≠ output prefix.',
      check: ['Trigger: `images/`. Output: `images/thumbs/`. Safe?', 'No — `images/thumbs/` starts with `images/`, so it re-triggers.'],
    },
    {
      level: 3, title: 'Lifecycle rules',
      text: [
        'A **lifecycle rule** automatically **transitions** objects to cheaper storage classes after a number of days and **expires** (deletes) them later. It can also clean noncurrent versions, expired delete markers and incomplete multipart uploads.',
        'S3 applies rules asynchronously, about once a day. By default, objects smaller than 128 KB aren’t transitioned, and some classes need a minimum age (e.g. 30 days before Standard-IA).',
      ],
      words: [
        ['Transition', 'Moving an object to another storage class.'],
        ['Expiration', 'Automatic deletion after a number of days.'],
      ],
      example: 'An automatic office cleaner who moves last year’s files to the basement and shreds ten-year-old ones.',
      remember: 'Lifecycle = automatic cost control.',
      check: ['Why does a lifecycle rule skip tiny files by default?', 'Cold classes have minimum billable sizes; moving tiny files would cost more.'],
    },
    {
      level: 3, title: 'Scheduling work',
      text: [
        'S3 has no clock. To run a job at a set time — a nightly export, a weekly cleanup — use **EventBridge Scheduler**: write a **cron** or rate expression, choose a **time zone**, set retries and a dead-letter queue, and target a Lambda, Step Functions workflow or an AWS API.',
        'Some S3 features are scheduled for you: lifecycle (daily), **S3 Inventory** (daily or weekly), Storage Lens, and Glue crawlers with their own schedule.',
      ],
      words: [
        ['Cron expression', 'A text pattern describing a repeating time, e.g. `0 2 * * ? *`.'],
        ['Time zone', 'The local time a schedule follows, e.g. Asia/Karachi.'],
        ['Step Functions', 'An AWS service for multi-step workflows.'],
      ],
      example: 'An alarm clock set to 2 a.m. local time that also knows about daylight saving.',
      remember: 'Scheduler + time zone; older rules use UTC only.',
      check: ['A rule `cron(0 2 * * ? *)` runs at 7 a.m. in Karachi. Why?', 'EventBridge rule schedules use UTC; Karachi is UTC+5.'],
    },
  ],
};
