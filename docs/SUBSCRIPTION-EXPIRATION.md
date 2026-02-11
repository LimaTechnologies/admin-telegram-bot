# Subscription Expiration System

## Overview

Automated system that manages subscription lifecycle: sends expiration warnings and deletes content when subscriptions expire.

**Active Since:** 2026-02-11

## Architecture

```
User purchases subscription
  ↓
Purchase record created with accessExpiresAt
  ↓
Content delivered (photos/videos)
  ↓
sentMessages array populated with message IDs
  ↓
BullMQ Worker Service (3 scheduled jobs)
  ├─ 7-day warning (daily 9 AM)
  ├─ 1-day warning (daily 9 AM)
  └─ Expiration cleanup (every hour)
```

## Components

### 1. PurchaseModel Updates

**New Fields:**
- `accessExpiresAt: Date` - When subscription expires
- `sentMessages: Array<{chatId, messageIds}>` - Content messages sent to user
- `expirationNotified7Days: Boolean` - 7-day warning sent flag
- `expirationNotified1Day: Boolean` - 1-day warning sent flag

**New Indexes:**
```typescript
purchaseSchema.index({ status: 1, accessExpiresAt: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified7Days: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified1Day: 1 });
```

### 2. Worker Service

**File:** `services/worker/src/index.ts`

Registers subscription check worker with 3 repeatable jobs:

```typescript
// Job 1: 7-day check (daily at 9 AM)
await subscriptionCheckQueue.add(
  'check-expiring-7days',
  { type: 'check-expiring-7days' },
  { repeat: { pattern: '0 9 * * *' }, jobId: 'subscription-7days-check' }
);

// Job 2: 1-day check (daily at 9 AM)
await subscriptionCheckQueue.add(
  'check-expiring-1day',
  { type: 'check-expiring-1day' },
  { repeat: { pattern: '0 9 * * *' }, jobId: 'subscription-1day-check' }
);

// Job 3: Expiration processing (every hour)
await subscriptionCheckQueue.add(
  'process-expired',
  { type: 'process-expired' },
  { repeat: { pattern: '0 * * * *' }, jobId: 'subscription-expired-check' }
);
```

**Worker Config:**
- Concurrency: 2 (low to avoid Telegram rate limits)
- Retries: 3 attempts with exponential backoff (5s initial)
- Auto-cleanup: Remove completed jobs after 1000 count

### 3. Processor Logic

**File:** `services/worker/src/processors/subscription.processor.ts`

Three handler functions:

#### checkExpiringIn7Days()
```typescript
// Query: status='completed' AND type='subscription' AND now < accessExpiresAt <= now+7d
// For each found:
//   1. Send Telegram notification: "Your subscription expires in 7 days"
//   2. Set expirationNotified7Days = true
//   3. Wait 100ms (rate limit)
```

#### checkExpiringIn1Day()
```typescript
// Query: status='completed' AND type='subscription' AND now < accessExpiresAt <= now+1d
// For each found:
//   1. Send Telegram notification: "Your subscription expires tomorrow"
//   2. Set expirationNotified1Day = true
//   3. Wait 100ms (rate limit)
```

#### processExpiredSubscriptions()
```typescript
// Query: status='completed' AND type='subscription' AND accessExpiresAt <= now
// For each found:
//   1. For each message in sentMessages:
//      - Delete message from Telegram API
//      - Wait 50ms (rate limit)
//      - Log failures but continue
//   2. Set status = 'expired'
//   3. Clear sentMessages = []
//   4. Save purchase record
```

## Subscription Lifecycle

### User Perspective

1. **Day 1:** User purchases 30-day subscription
   - Receives content (photos/videos)
   - `accessExpiresAt` set to Day 31

2. **Day 24:** Worker sends 7-day warning
   - User receives: "Your subscription expires in 7 days!"
   - `expirationNotified7Days` set to true

3. **Day 30:** Worker sends final warning
   - User receives: "Your subscription expires tomorrow!"
   - `expirationNotified1Day` set to true

4. **Day 31 at any hour:** Worker processes expiration
   - All content messages deleted from Telegram
   - User can see the messages were deleted
   - `status` changed to 'expired'
   - `sentMessages` cleared for privacy

### Database Changes

```
Before expiration:
{
  _id: ObjectId,
  status: 'completed',
  accessExpiresAt: 2026-03-13T10:00:00Z,
  sentMessages: [
    { chatId: 123456789, messageIds: [101, 102, 103, 104] },
    { chatId: 123456789, messageIds: [105, 106] }
  ],
  expirationNotified7Days: true,
  expirationNotified1Day: false
}

After expiration (hourly check):
{
  _id: ObjectId,
  status: 'expired',  // ← changed
  accessExpiresAt: 2026-03-13T10:00:00Z,
  sentMessages: [],   // ← cleared
  expirationNotified7Days: true,
  expirationNotified1Day: true  // ← set just before expiration
}
```

## Implementation Details

### Rate Limiting

**Why needed:** Telegram API has per-user limits to prevent spam/abuse.

**Applied:**
- Message sends: 100ms between each (safe for concurrent processing)
- Message deletes: 50ms between each (lower risk operation)

**Implementation:**
```typescript
// Rate limit: wait between operations
await new Promise((resolve) => setTimeout(resolve, 100));
```

### Error Handling

**Scenario 1: Notification send fails**
- Logged with error details
- Job continues to next user
- Does not mark `expirationNotified*` = true
- Job will retry (up to 3 attempts)

**Scenario 2: Message delete fails**
- Logged at debug level (expected - message may already be deleted)
- Job continues deleting other messages
- Does not rethrow or fail job
- Purchase marked as 'expired' anyway

**Scenario 3: Job fails completely**
- Logged at error level
- Job requeued (max 3 retries)
- Exponential backoff: 5s, 25s, 125s
- If all retries fail, job moves to dead-letter queue

### Performance Considerations

**Query Optimization:**
- Uses database indexes on `(status, accessExpiresAt, notificationFlag)`
- Only processes 'completed' subscriptions (filters out pending/failed)
- Skips users already notified (checks `expirationNotified*` flags)

**Concurrency:**
- Worker concurrency set to 2 (low) to prevent Telegram rate limits
- Each job processed serially within its concurrency slot
- Total processing time depends on number of users

**Memory:**
- Jobs are stateless (no data cached in memory)
- Large result sets paginated (Mongoose cursor by default)
- Cleared after job completes

### Cron Patterns

| Pattern | Meaning |
|---------|---------|
| `0 9 * * *` | Every day at 9:00 AM UTC |
| `0 * * * *` | Every hour at :00 minutes |

**Timezone:** All cron patterns in UTC (Redis/BullMQ default)

If different timezone needed, adjust pattern:
- 9 AM EST = 2 PM UTC → pattern `0 14 * * *`
- 9 AM BRT = 1 PM UTC → pattern `0 13 * * *`

## Configuration

### Environment Variables

None required. Uses defaults:

```typescript
// In subscription.processor.ts
// Notifications sent via getBotApi() (Telegram bot API)
// Redis connection from BullMQ setup
```

### Customization

To change notification schedule:

```typescript
// services/worker/src/index.ts

// Modify cron patterns
await subscriptionCheckQueue.add(
  'check-expiring-7days',
  { type: 'check-expiring-7days' },
  {
    repeat: { pattern: '0 8 * * *' }, // Changed from 9 AM to 8 AM
    jobId: 'subscription-7days-check',
  }
);
```

To change notification messages:

```typescript
// services/worker/src/processors/subscription.processor.ts

// In checkExpiringIn7Days()
const message = `<b>Your subscription expires soon!</b>\n...`; // Customize
```

To change rate limiting:

```typescript
// In checkExpiringIn7Days()
await new Promise((resolve) => setTimeout(resolve, 200)); // Changed from 100ms to 200ms
```

## Testing

### Local Testing (without Telegram)

1. Set `ARKAMA_API_KEY` to empty string (activates local fallback mode)
2. Mock Telegram API in tests
3. Run processor directly:

```typescript
import { processSubscriptionCheck } from './subscription.processor';

const job = {
  data: { type: 'check-expiring-7days' }
};

await processSubscriptionCheck(job);
// Check logs for notification attempts
```

### Integration Testing (with Telegram)

1. Create test subscription with `accessExpiresAt` = 8 days from now
2. Manually trigger job:

```bash
# Connect to Redis
redis-cli

# Add job to queue
LPUSH subscription-check '{"type":"check-expiring-7days"}'

# Monitor worker logs
tail -f worker.log
```

3. Verify Telegram message received
4. Check database: `expirationNotified7Days` should be `true`

### Full Lifecycle Test

1. Create subscription with `accessExpiresAt` = 2 days from now
2. Run `check-expiring-1day` job → notification sent
3. Wait or update DB: `accessExpiresAt` = now
4. Run `process-expired` job → messages deleted
5. Verify status = 'expired'

## Troubleshooting

### Issue: Notifications not sent

**Checklist:**
- [ ] Worker service running? `docker compose ps` should show worker
- [ ] Redis connected? Check worker logs for "Connected to Redis"
- [ ] Jobs scheduled? Check BullMQ dashboard at `/api/queues`
- [ ] Bot API configured? Check `TELEGRAM_BOT_TOKEN` env var

**Debug:**
```bash
# Check queue jobs
redis-cli LRANGE subscription-check:* 0 -1

# Check failed jobs
redis-cli LRANGE subscription-check:failed 0 -1
```

### Issue: Messages not deleted

**Checklist:**
- [ ] sentMessages array populated? Check purchase record in DB
- [ ] Telegram messages still exist? They may have been manually deleted
- [ ] Bot has permission? Add bot to group/chat if needed
- [ ] Message IDs correct? Should be integers, not strings

**Debug:**
```typescript
// In processor, add logging
logger.info('Deleting message', { chatId, messageId, method: 'deleteMessage' });

// Check for permission errors
// Error: "Message to delete not found" (expected for deleted messages)
// Error: "Bot is not a member" (permission issue)
```

### Issue: Worker crashes

**Common causes:**
- Database connection lost
- Redis connection lost
- Telegram API timeout

**Fix:**
- Check logs: `docker compose logs worker`
- Restart worker: `docker compose restart worker`
- Verify Redis/MongoDB: `docker compose logs redis` / `docker compose logs mongo`

## Monitoring

### BullMQ Dashboard

Access at `http://localhost:3000/api/queues` (if enabled):

- View all jobs (completed, active, failed)
- Manually requeue failed jobs
- Check job progress and logs

### Logs

```bash
# Follow worker logs
docker compose logs -f worker

# Filter for subscription jobs
docker compose logs worker | grep -i subscription

# Check for errors
docker compose logs worker | grep -i error
```

### Metrics

To add monitoring:

```typescript
// In subscription.processor.ts
subscriptionWorker.on('completed', (job) => {
  metrics.increment('subscription.job.completed', { type: job.data.type });
});

subscriptionWorker.on('failed', (job, err) => {
  metrics.increment('subscription.job.failed', { type: job.data.type });
  metrics.increment('subscription.job.error', { error: err.code });
});
```

## Future Enhancements

### Potential Features

1. **Configurable notification schedule**
   - Allow models to set custom notification times
   - User preference for notification frequency

2. **Renewal links in notifications**
   - Include direct purchase link in warning messages
   - Track if user renewed within notification window

3. **Partial content preservation**
   - Keep some content (e.g., preview) after expiration
   - Only delete premium content

4. **Subscription renewal**
   - Auto-renew on payment (recurring billing)
   - Extend accessExpiresAt instead of creating new purchase

5. **Analytics**
   - Track expiration rates
   - Identify high-value churning users
   - A/B test notification messages

## See Also

- `SETUP-PURCHASE-SYSTEM.md` - Full purchase system setup
- `.claude/skills/codebase-knowledge/domains/bot-purchase.md` - Architecture details
- `common/models/purchase.model.ts` - Database schema
- `services/worker/src/processors/subscription.processor.ts` - Implementation code
