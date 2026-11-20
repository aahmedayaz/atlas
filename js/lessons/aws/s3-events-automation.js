import { n, e, f, z } from '../../engine/build.js';

export default {
  id: 's3-events-automation',
  title: 'S3 events, lifecycle rules and scheduling',
  level: 'Intermediate',
  minutes: 40,
  tags: ['AWS', 'S3', 'Events', 'Lambda', 'EventBridge', 'CDK'],
  summary: 'React to every upload and delete with S3 Event Notifications or EventBridge, understand delivery guarantees (at-least-once, unordered, URL-encoded keys), build the S3 → SQS → Lambda pipeline without infinite loops, let lifecycle rules move and expire data automatically, and run things on a schedule with EventBridge Scheduler — in the console, CLI and CDK.',
  learn: ['Event types and prefix/suffix filters', 'Destinations and the permissions they need', 'At-least-once delivery, duplicates, ordering and the sequencer', 'S3 Event Notifications vs EventBridge', 'S3 → SQS → Lambda with retries, DLQ and no recursion', 'Lifecycle transitions, expirations and cleanups', 'Scheduling with EventBridge Scheduler and scheduled S3 features'],
  steps: [
    {
      short: 'Why events', title: 'Make S3 call you when something happens', tag: 'concept',
      scene: { nodes: [n('u', 120, 250, 'User uploads photo', { kind: 'user' }), n('b', 420, 250, 'uploads/ bucket', { kind: 's3' }), n('ev', 700, 250, 'ObjectCreated event', { kind: 'event', sub: 'within seconds' }), n('fn', 960, 250, 'Thumbnail Lambda', { kind: 'lambda' })],
        edges: [e('u', 'b', 'PUT'), e('b', 'ev'), e('ev', 'fn')], flows: [f('u>b', 'jpg', { kind: 'user', every: 3 }), f('b>ev', '', { kind: 'event', every: 3, delay: 0.8 }), f('ev>fn', '', { kind: 'event', every: 3, delay: 1.5 })] },
      body: [
        'Instead of polling a bucket (“anything new?”), let S3 **push** an event when objects are created, deleted, restored, replicated, transitioned or tagged. Typical uses: make thumbnails, scan uploads for malware, ingest CSVs into a database, index documents for search, notify a user.',
        'Two delivery mechanisms: **S3 Event Notifications** (S3 sends directly to Lambda, SQS or SNS) and **Amazon EventBridge** (S3 sends every event to the default event bus, and rules route them). Both are covered next.',
      ],
    },
    {
      short: 'Notifications', title: 'S3 Event Notifications: types, filters and destinations', tag: 'code',
      scene: { nodes: [n('b', 140, 250, 'Bucket', { kind: 's3', sub: 'notification configuration' }), n('r1', 460, 110, 'ObjectCreated:*  prefix uploads/ suffix .jpg', { kind: 'policy' }), n('r2', 460, 390, 'ObjectRemoved:*', { kind: 'policy' }), n('fn', 860, 110, 'Lambda', { kind: 'lambda', sub: 'resource policy: s3 may invoke' }), n('q', 860, 280, 'SQS', { kind: 'sqs', sub: 'queue policy' }), n('t', 860, 430, 'SNS', { kind: 'event', sub: 'topic policy' })],
        edges: [e('b', 'r1'), e('b', 'r2'), e('r1', 'fn'), e('r2', 'q'), e('r2', 't', '', { style: 'dashed' })], h: 500 },
      body: [
        '**Event types** include `s3:ObjectCreated:*` (Put, Post, Copy, CompleteMultipartUpload), `s3:ObjectRemoved:*` (Delete, DeleteMarkerCreated), `s3:ObjectRestore:*`, `s3:Replication:*`, `s3:LifecycleExpiration:*`, `s3:LifecycleTransition`, `s3:IntelligentTiering`, `s3:ObjectTagging:*` and `s3:ObjectAcl:Put`. **Filters**: one prefix and/or one suffix per rule; rules for the same event type must not overlap.',
        '**Destinations**: Lambda, SQS (standard; FIFO is not supported directly) or SNS. Each needs a **resource policy** letting `s3.amazonaws.com` call it, scoped with `aws:SourceArn` (your bucket) and `aws:SourceAccount`. When you save the configuration, S3 sends a test event to check it can deliver; if the permission is missing, saving fails.',
        'Console: bucket → *Properties* → *Event notifications* → *Create event notification*.',
      ],
      code: { file: 'notify.json', lang: 'json', src: `
{
  "QueueConfigurations": [{
    "Id": "new-jpgs",
    "QueueArn": "arn:aws:sqs:eu-west-1:123456789012:thumbs",
    "Events": ["s3:ObjectCreated:*"],
    "Filter": { "Key": { "FilterRules": [
      { "Name": "prefix", "Value": "uploads/" },
      { "Name": "suffix", "Value": ".jpg" } ] } }
  }]
}
// aws s3api put-bucket-notification-configuration --bucket acme-uploads \\
//   --notification-configuration file://notify.json`, hl: [5, 6, 8, 9] },
    },
    {
      short: 'Delivery rules', title: 'At-least-once, unordered, URL-encoded: handle it', tag: 'internals',
      scene: { nodes: [n('b', 140, 250, 'S3', { kind: 's3' }), n('e1', 480, 110, 'event #1 (seq 0055)', { kind: 'event' }), n('e2', 480, 250, 'event #1 again (duplicate)', { kind: 'event', state: 'upd' }), n('e3', 480, 390, 'event #0 (seq 0049, late)', { kind: 'event', state: 'upd' }), n('c', 850, 250, 'Idempotent consumer', { kind: 'lambda', sub: 'dedupe by key+versionId / sequencer', state: 'ok' })],
        edges: [e('b', 'e1'), e('b', 'e2'), e('b', 'e3'), e('e1', 'c'), e('e2', 'c'), e('e3', 'c')], flows: [f('b>e1', '', { kind: 'event', every: 3 }), f('b>e2', '', { kind: 'event', every: 3, delay: 0.5 }), f('b>e3', '', { kind: 'event', every: 3, delay: 1 })] },
      body: [
        'Events usually arrive within seconds, but S3 guarantees only **at-least-once** delivery: very rarely you get a **duplicate**, and events can arrive **out of order**. Design consumers to be [[idempotent]] (processing twice is harmless), and when order matters compare the `sequencer` field — for the same key, a larger sequencer is the later event.',
        'Two gotchas in the event JSON: the **object key is URL-encoded** (`my photo.jpg` arrives as `my+photo.jpg`; decode it before calling `GetObject`), and it contains `size`, `eTag` and `versionId`, so you often don’t need a `HeadObject`.',
      ],
      code: { file: 'handler.ts', lang: 'ts', src: `
import type { S3Event, SQSEvent } from 'aws-lambda';

export const handler = async (event: SQSEvent) => {
  for (const msg of event.Records) {
    const s3evt: S3Event = JSON.parse(msg.body);
    for (const r of s3evt.Records ?? []) {               // (s3:TestEvent has no Records)
      const bucket = r.s3.bucket.name;
      const key = decodeURIComponent(r.s3.object.key.replace(/\\+/g, ' '));
      const { versionId, sequencer, size } = r.s3.object;
      if (await alreadyDone(bucket, key, versionId)) continue;   // idempotency
      await makeThumbnail(bucket, key);
    }
  }
};`, hl: [9, 11] },
    },
    {
      short: 'EventBridge', title: 'S3 → EventBridge: richer filters, many targets', tag: 'concept',
      scene: { nodes: [n('b', 130, 250, 'Bucket', { kind: 's3', sub: 'EventBridge: ON' }), n('bus', 430, 250, 'default event bus', { kind: 'event', sub: 'every S3 event' }), n('r1', 740, 110, 'Rule: .pdf > 10 MB', { kind: 'policy' }), n('r2', 740, 390, 'Rule: Object Deleted in prod/', { kind: 'policy' }), n('t1', 1000, 110, 'Step Functions', { kind: 'cfn' }), n('t2', 1000, 390, 'SNS → Slack', { kind: 'event' })],
        edges: [e('b', 'bus'), e('bus', 'r1'), e('bus', 'r2'), e('r1', 't1'), e('r2', 't2')], flows: [f('b>bus', '', { kind: 'event', every: 2.4 }), f('bus>r1', '', { kind: 'event', every: 2.4, delay: 0.7 })] },
      body: [
        'Turn on *Properties → Amazon EventBridge → Send notifications to Amazon EventBridge* (or `eventBridgeEnabled: true` in CDK). S3 then sends **all** its events to the default bus with detail-types such as `Object Created`, `Object Deleted`, `Object Restore Completed`.',
        '[[eventbridge|EventBridge]] rules can filter on anything in the event — prefix, suffix, **object size**, requester, reason — send to 20+ target types, fan out to several targets per event, and **archive and replay** events. Choose plain notifications for the simplest, cheapest single-target case; EventBridge when you need flexible filtering, multiple consumers or overlapping rules.',
      ],
      code: { file: 'rule-pattern.json', lang: 'json', src: `
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": { "name": ["acme-uploads"] },
    "object": { "key": [{ "prefix": "reports/" }, { "suffix": ".pdf" }],
                "size": [{ "numeric": [">", 10485760] }] }
  }
}`, hl: [3, 6, 7] },
    },
    {
      short: 'S3 → SQS → Lambda', title: 'The robust pipeline: S3 → SQS → Lambda (and no infinite loops)', tag: 'concept',
      scene: { zones: [z('in', 60, 90, 330, 300, 'uploads/ (input)', 's3'), z('out', 760, 90, 300, 300, 'thumbs/ (output)', 's3')], nodes: [n('b', 220, 240, 'Upload bucket', { kind: 's3' }), n('q', 560, 140, 'SQS queue', { kind: 'sqs', sub: 'buffer · retries · batch' }), n('dlq', 560, 360, 'Dead-letter queue', { kind: 'sqs', sub: 'after 5 failures', state: 'bad' }), n('fn', 560, 250, 'Lambda', { kind: 'lambda', sub: 'batch of 10' }), n('o', 910, 240, 'Output bucket/prefix', { kind: 's3', state: 'ok' })],
        edges: [e('b', 'q', 'event'), e('q', 'fn', 'poll'), e('fn', 'o', 'write result'), e('q', 'dlq', 'poison msgs', { style: 'dashed' })],
        flows: [f('b>q', '', { kind: 'event', every: 1.2 }), f('q>fn', '', { kind: 'sqs', every: 2.4, delay: 0.4 }), f('fn>o', '', { kind: 'lambda', every: 2.4, delay: 1.2 })] },
      body: [
        'Putting [[sqs|SQS]] between S3 and Lambda absorbs bursts (10,000 uploads in a minute), lets Lambda process in batches, retries failures automatically, and moves messages that keep failing to a **dead-letter queue** instead of losing them. Set the queue’s visibility timeout to at least 6× the function timeout.',
        '**Never write output where your trigger listens.** A function triggered by `ObjectCreated` on `uploads/` that writes thumbnails back into `uploads/` triggers itself forever — a famous way to run up a large bill. Write to a different bucket, or a different prefix that the filter excludes.',
      ],
      callout: { kind: 'bad', title: 'Recursive loop', text: 'Trigger on prefix `incoming/`, write to `processed/` (or another bucket). Add a CloudWatch alarm on invocations, and a Budget alert as the last line of defence.' },
    },
    {
      short: 'Events in CDK', title: 'Wiring events in CDK', tag: 'code',
      scene: { nodes: [n('code', 130, 250, 'stack.ts', { kind: 'code' }), n('b', 430, 250, 'Bucket', { kind: 's3' }), n('q', 730, 120, 'Queue + DLQ', { kind: 'sqs' }), n('fn', 990, 120, 'Lambda', { kind: 'lambda' }), n('rule', 730, 380, 'EventBridge rule', { kind: 'event' })],
        edges: [e('code', 'b'), e('b', 'q', 'addEventNotification'), e('q', 'fn', 'SqsEventSource'), e('b', 'rule', 'eventBridgeEnabled')] },
      body: [
        '`bucket.addEventNotification(type, destination, filters)` writes the notification configuration *and* the destination’s resource policy (CDK uses a small custom resource to apply it). Destinations come from `aws-cdk-lib/aws-s3-notifications`: `LambdaDestination`, `SqsDestination`, `SnsDestination`.',
      ],
      code: { file: 'lib/pipeline.ts', lang: 'ts', src: `
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const uploads = new s3.Bucket(this, 'Uploads', { eventBridgeEnabled: true });
const dlq = new sqs.Queue(this, 'ThumbsDlq', { retentionPeriod: Duration.days(14) });
const queue = new sqs.Queue(this, 'Thumbs', {
  visibilityTimeout: Duration.minutes(3),
  deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
});
uploads.addEventNotification(s3.EventType.OBJECT_CREATED,
  new s3n.SqsDestination(queue), { prefix: 'incoming/', suffix: '.jpg' });

thumbFn.addEventSource(new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }));
uploads.grantRead(thumbFn, 'incoming/*');
outputBucket.grantWrite(thumbFn);                      // different bucket → no loop

new events.Rule(this, 'BigPdfs', {
  eventPattern: { source: ['aws.s3'], detailType: ['Object Created'],
    detail: { bucket: { name: [uploads.bucketName] }, object: { size: [{ numeric: ['>', 10485760] }] } } },
  targets: [new targets.SnsTopic(alertsTopic)],
});`, hl: [7, 13, 14, 16, 18] },
    },
    {
      short: 'Lifecycle', title: 'Lifecycle rules: move and delete data automatically', tag: 'concept',
      scene: { nodes: [n('d0', 120, 250, 'Day 0: Standard', { kind: 'obj', state: 'active' }), n('d30', 380, 250, 'Day 30: Standard-IA', { kind: 'obj' }), n('d90', 640, 250, 'Day 90: Glacier Flexible', { kind: 'obj' }), n('d365', 900, 250, 'Day 365: expire', { kind: 'obj', state: 'dim' }), n('nc', 510, 430, 'noncurrent versions: delete after 30 days · abort incomplete multipart after 7 days', { kind: 'note', icon: false })],
        edges: [e('d0', 'd30'), e('d30', 'd90'), e('d90', 'd365')], flows: [f('d0>d30', '', { kind: 'clock', every: 3 }), f('d30>d90', '', { kind: 'clock', every: 3, delay: 1 }), f('d90>d365', '', { kind: 'clock', every: 3, delay: 2 })], h: 500 },
      body: [
        'A [[lifecycle|lifecycle rule]] (filtered by prefix, tags and/or object size) can **transition** objects to cheaper [[storage-class|storage classes]] after N days, **expire** current versions, **expire noncurrent versions** (after N days, keeping the newest N), **delete expired delete markers** and **abort incomplete multipart uploads**. Up to 1,000 rules per bucket.',
        'Constraints: transitions go only “downhill” (Standard → IA → Glacier…); Standard-IA/One Zone-IA need objects to be at least 30 days old; objects smaller than **128 KB are not transitioned by default** (since 2024). Lifecycle runs asynchronously — typically once a day — so an expired object may stay visible briefly, but you stop paying from the eligible date.',
        'Console: bucket → *Management* → *Create lifecycle rule*.',
      ],
      code: { file: 'lib/lifecycle.ts', lang: 'ts', src: `
const logs = new s3.Bucket(this, 'Logs', {
  versioned: true,
  lifecycleRules: [
    { id: 'tiering', prefix: 'app/', transitions: [
        { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(30) },
        { storageClass: s3.StorageClass.GLACIER, transitionAfter: Duration.days(90) } ],
      expiration: Duration.days(365) },
    { id: 'versions', noncurrentVersionExpiration: Duration.days(30), noncurrentVersionsToRetain: 3 },
    { id: 'cleanup', abortIncompleteMultipartUploadAfter: Duration.days(7),
      expiredObjectDeleteMarker: true },
  ],
});`, hl: [5, 8, 9, 10] },
    },
    {
      short: 'Scheduling', title: 'Scheduling: EventBridge Scheduler and S3’s own schedules', tag: 'code',
      scene: { nodes: [n('sch', 140, 250, 'EventBridge Scheduler', { kind: 'clock', sub: 'cron(0 2 * * ? *) Asia/Karachi' }), n('fn', 470, 120, 'Lambda: nightly export', { kind: 'lambda' }), n('sf', 470, 380, 'Step Functions / Batch Ops job', { kind: 'cfn' }), n('b', 820, 250, 'Bucket', { kind: 's3' }), n('inv', 820, 440, 'S3 Inventory (daily/weekly)', { kind: 'file', sub: 'built-in schedule' })],
        edges: [e('sch', 'fn'), e('sch', 'sf'), e('fn', 'b'), e('sf', 'b'), e('b', 'inv', '', { style: 'dashed' })], flows: [f('sch>fn', '02:00', { kind: 'clock', every: 3 }), f('fn>b', '', { kind: 'lambda', every: 3, delay: 1 })], h: 500 },
      body: [
        'S3 itself has no cron. For “every night at 2 a.m., do X to the bucket” use **EventBridge Scheduler**: cron or rate expressions, **time zones**, one-time schedules, flexible windows, retries and a DLQ — targeting Lambda, Step Functions, ECS tasks, or directly an AWS API (e.g. start a Glue crawler). (Older code uses EventBridge *rules* with a schedule, which only support UTC.)',
        'Some S3 features are scheduled for you: **lifecycle** (daily), **S3 Inventory** (daily or weekly reports), **Storage Lens** (daily metrics) and **Glue crawlers** (their own schedule). A common pattern: Inventory lands → an event triggers a Lambda → it creates a **Batch Operations** job from the report.',
      ],
      code: { file: 'lib/schedule.ts', lang: 'ts', src: `
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedTargets from 'aws-cdk-lib/aws-scheduler-targets';

new scheduler.Schedule(this, 'NightlyExport', {
  schedule: scheduler.ScheduleExpression.cron({
    minute: '0', hour: '2', timeZone: TimeZone.ASIA_KARACHI }),
  target: new schedTargets.LambdaInvoke(exportFn, {
    input: scheduler.ScheduleTargetInput.fromObject({ bucket: data.bucketName, prefix: 'daily/' }),
    retryAttempts: 3,
  }),
});
// CLI equivalent:
// aws scheduler create-schedule --name nightly-export \\
//   --schedule-expression "cron(0 2 * * ? *)" --schedule-expression-timezone Asia/Karachi \\
//   --flexible-time-window Mode=OFF --target '{"Arn":"<lambda-arn>","RoleArn":"<role-arn>"}'`, hl: [5, 6, 7] },
    },
    {
      short: 'All together', title: 'Putting it together: an upload pipeline', tag: 'concept',
      scene: { nodes: [n('br', 90, 250, 'Browser', { kind: 'browser' }), n('api', 300, 110, 'API: presign', { kind: 'lambda' }), n('in', 300, 380, 'incoming/', { kind: 's3' }), n('q', 540, 380, 'SQS', { kind: 'sqs' }), n('fn', 760, 380, 'Process Lambda', { kind: 'lambda' }), n('out', 980, 380, 'processed bucket', { kind: 's3', sub: 'lifecycle → Glacier', state: 'ok' }), n('eb', 760, 140, 'EventBridge', { kind: 'event', sub: 'notify user' }), n('sch', 980, 140, 'Nightly schedule', { kind: 'clock', sub: 'report / cleanup' })],
        edges: [e('br', 'api', '1'), e('br', 'in', '2 PUT presigned'), e('in', 'q', '3 event'), e('q', 'fn', '4'), e('fn', 'out', '5'), e('out', 'eb', '6', { style: 'dashed' }), e('sch', 'out', '', { style: 'dashed' })],
        flows: [f('br>in', '', { kind: 'browser', every: 4 }), f('in>q', '', { kind: 'event', every: 4, delay: 1 }), f('q>fn', '', { kind: 'sqs', every: 4, delay: 1.7 }), f('fn>out', '', { kind: 'lambda', every: 4, delay: 2.4 })], h: 500 },
      body: [
        'A production upload flow uses everything from the S3 lessons: (1) the API checks the user and returns a **presigned URL**; (2) the browser uploads straight to `incoming/`; (3) an **event notification** puts a message on **SQS**; (4) a Lambda processes it **idempotently** with retries and a DLQ; (5) it writes to a **separate bucket** (no loop), encrypted with KMS + **Bucket Keys**, **versioned**, **replicated** to another region; (6) EventBridge notifies the user; **lifecycle** archives old files; a **nightly schedule** produces reports and cleans up.',
      ],
    },
  ],
  interview: [
    { lvl: 'J', q: 'How do you run code when a file is uploaded to S3?', a: ['Configure an S3 Event Notification for s3:ObjectCreated:* (optionally with prefix/suffix) to Lambda, SQS or SNS, or enable EventBridge and create a rule. The destination needs a resource policy allowing S3 to deliver.'] },
    { lvl: 'M', q: 'What delivery guarantees do S3 events have?', a: ['At-least-once and usually within seconds; rare duplicates and out-of-order delivery are possible. Make consumers idempotent and use the sequencer to order events for the same key.'] },
    { lvl: 'M', q: 'Event Notifications vs EventBridge?', a: ['Notifications: direct, cheap, simple prefix/suffix filters, Lambda/SQS/SNS targets, no overlapping rules. EventBridge: all events to a bus, rich content filtering (size, metadata), many targets and multiple rules per event, archive/replay, slightly more latency and cost.'] },
    { lvl: 'M', q: 'Why put SQS between S3 and Lambda?', a: ['Buffering bursts, batching, controlled concurrency, automatic retries with visibility timeout, and a dead-letter queue for poison messages, so no event is lost when processing fails.'] },
    { lvl: 'S', q: 'Design storage for 5 years of app logs with frequent queries in the first week and rare audits later.', a: ['Partitioned keys (app/yyyy/mm/dd/), Standard for 30 days then Standard-IA, Glacier Instant/Flexible after 90 days, Deep Archive after a year, expire at 5 years; Object Lock if audits require immutability; abort-incomplete-multipart and noncurrent-version rules; Glue crawler + Athena for queries; Inventory for audits; Intelligent-Tiering if access is unpredictable.'], why: 'Tests lifecycle, storage classes and querying together.' },
  ],
  history: {
    timeline: [
      { yr: '2014', title: 'S3 Event Notifications', text: 'S3 could notify SNS, SQS and (preview) Lambda — the birth of event-driven serverless.', c: 'g' },
      { yr: '2015–2019', title: 'Storage classes grow', text: 'Standard-IA (2015), One Zone-IA and Intelligent-Tiering (2018), Glacier Deep Archive (2019).' },
      { yr: '2019', title: 'EventBridge', text: 'An event bus with rich routing; scheduled rules.' },
      { yr: '2021', title: 'S3 events in EventBridge', text: 'All S3 events to the default bus with content filtering.' },
      { yr: '2022', title: 'EventBridge Scheduler', text: 'Time-zone-aware, one-time and recurring schedules at scale.', c: 'g' },
    ],
    alts: { cols: ['Need', 'Use', 'Why'], rows: [['React to uploads, one consumer', 'S3 Event Notification → SQS → Lambda', 'simple, cheap, reliable'], ['Many consumers / rich filters', 'EventBridge rules', 'fan-out, size filters, replay'], ['Ordered processing per object', 'sequencer + FIFO SQS behind EventBridge', 'notifications can’t target FIFO directly'], ['Archive / delete old data', 'Lifecycle rules', 'no code, runs daily'], ['Do something on a timetable', 'EventBridge Scheduler', 'cron with time zones, retries'], ['Bulk change after a report', 'Inventory → Batch Operations', 'managed at billions of objects']] },
  },
  quiz: [
    { q: 'An uploaded key `my photo.jpg` arrives in the event as…', o: ['my photo.jpg', 'my+photo.jpg (URL-encoded)', 'base64', 'an ARN'], a: 1, why: 'Decode before calling GetObject.' },
    { q: 'Which can NOT be a direct S3 Event Notification destination?', o: ['Lambda', 'SQS standard queue', 'SNS', 'SQS FIFO queue'], a: 3, why: 'Route through EventBridge for FIFO.' },
    { q: 'Lambda triggered on uploads/ writes its output to uploads/. Result?', o: ['Fine', 'Infinite loop', 'AccessDenied', 'Events disabled'], a: 1, why: 'Write to another bucket or prefix.' },
    { q: 'Smallest objects lifecycle transitions by default?', o: ['any size', '≥ 128 KB', '≥ 1 MB', '≥ 5 GB'], a: 1, why: 'Since 2024, smaller ones need an explicit size filter.' },
    { q: 'Best tool for “every day at 02:00 Karachi time, run an export”?', o: ['S3 lifecycle', 'EventBridge Scheduler', 'S3 Event Notification', 'CloudTrail'], a: 1, why: 'Cron with time zones and retries.' },
  ],
  cheat: `<h3>Events</h3><pre>s3:ObjectCreated:* · s3:ObjectRemoved:* · s3:ObjectRestore:* · s3:Replication:* · s3:LifecycleExpiration:* · s3:ObjectTagging:*
Filter: prefix + suffix (no overlap) · Destinations: Lambda · SQS (standard) · SNS
EventBridge: eventBridgeEnabled → detail-type "Object Created" … size/key filters</pre>
  <h3>Consumer rules</h3><ul><li>At-least-once, maybe out of order → idempotent, use sequencer</li><li>Key is URL-encoded → decodeURIComponent(key.replace(/\\+/g,' '))</li><li>S3 → SQS (+DLQ) → Lambda · never write back to the trigger prefix</li></ul>
  <h3>Lifecycle</h3><pre>transitions · expiration · noncurrentVersionExpiration · abortIncompleteMultipartUpload · expiredObjectDeleteMarker
IA ≥ 30 days · default min 128 KB for transitions · runs ~daily</pre>
  <h3>Scheduling</h3><pre>EventBridge Scheduler: cron(0 2 * * ? *) + timezone → Lambda / Step Functions / API
Built-in: lifecycle (daily) · Inventory (daily/weekly) · Glue crawler schedules</pre>`,
};
