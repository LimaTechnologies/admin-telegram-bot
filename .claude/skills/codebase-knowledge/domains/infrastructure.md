# Domain: Infrastructure

## Last Update
- **Date:** 2026-02-14
- **Commit:** a923cae
- **Summary:** Added subscription expiration system and bulk message deletion worker processors

## Files

### Docker
- `docker-compose.yml` - Service orchestration
- `docker/dashboard/Dockerfile` - Next.js dashboard
- `docker/bot/Dockerfile` - Telegram bot service
- `docker/worker/Dockerfile` - BullMQ workers

### Configuration
- `.env` - Production environment variables
- `.env.local` - Development environment variables
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration

### Scripts
- `scripts/create-s3-bucket.ts` - Creates S3 bucket for file storage
- `scripts/test-connections.ts` - Tests MongoDB and S3 connectivity
- `scripts/seed-demo-model.ts` - NEW: Creates demo model with preview photos and products for purchase flow testing

### Services
- `services/bot/` - grammY Telegram bot (handlers directory)
  - `handlers/purchase.handler.ts` - Purchase flow (models, packs, checkout)
- `services/worker/` - BullMQ job processors
  - `processors/bot-tasks.processor.ts` - Telegram API operations (send, delete, sync)
  - `processors/subscription.processor.ts` - Subscription expiration and notifications
  - `index.ts` - Worker initialization and job registration

### Queue System
- `common/queue/connection.ts` - Redis connection
- `common/queue/queues.ts` - Queue definitions

## Connections
- **database** - All services connect to MongoDB
- **api** - Dashboard exposes tRPC API
- **authentication** - Bot and workers share auth context

## Recent Commits
- a923cae - feat: add subscription expiration system and image cropper
- 25f97e0 - feat: add clickable model name to open detail page
- (2026-02-10) - feat: add seed-demo-model.ts script for purchase flow testing
- Initial Docker and infrastructure setup

## Attention Points

### Docker Services
```yaml
services:
  dashboard:  # Next.js on :3001 (changed from 3000)
  bot:        # grammY bot (webhook mode)
  worker:     # BullMQ processors (scalable)
  redis:      # Queue backend on :6379 (local)
  # mongodb:  # EXTERNAL: sparksglee.dental:8000
  # minio:    # EXTERNAL: s3.sparksglee.dental
```

### Queue Architecture
```
Per-Group Queues (Rate Limited)
├── post:group:{groupId} → 1 msg per cooldown

Per-Bot Queues (API Limited)
├── post:bot:{botId} → 30 msgs/second

System Queues
├── audit:log → Async audit logging
├── analytics:aggregate → Hourly aggregation
└── campaign:check → Status checks
```

### Environment Variables
```env
# Database (External MongoDB)
MONGODB_URI=mongodb://user:pass@sparksglee.dental:8000/tgadmin

# Redis (Local)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auth
SESSION_SECRET=...
MAGIC_LINK_SECRET=...

# Email
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...

# Telegram
TELEGRAM_BOT_TOKEN=...

# Storage (External S3)
S3_ENDPOINT=https://s3.sparksglee.dental
S3_BUCKET=telegram-admin
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

### Seed Demo Model Script

#### Purpose
Creates a demo OnlyFans model ("Amanda Silva") with preview photos and 3 products for testing the Telegram purchase flow.

#### Usage
```bash
# Just create the model
bun scripts/seed-demo-model.ts

# Create model + send promotional message to registered groups
bun scripts/seed-demo-model.ts --promo
```

#### What It Creates
- **Model:** Amanda Silva (gold tier, Brazilian)
- **Preview Photos:** 4 Unsplash photos (gallery preview)
- **Products:**
  1. Pack Verao (R$29.90) - 15 photos, content type
  2. Pack Fitness (R$49.90) - 20 photos + 3 videos, PPV type
  3. Assinatura VIP (R$79.90) - subscription type
- **Promotional Message:** Sent to first active group (if --promo flag)

#### Key Features
- Idempotent (updates existing model if found)
- Uses real Unsplash URLs for realistic preview
- Generates deep link for group promotion
- Shows bot username dynamically
- Handles API errors gracefully

#### Output
```
✅ Demo model ready!
   Name: Amanda Silva
   Username: @amanda_exclusive
   ID: 507f1f77bcf86cd799439011
   Products: 3
   Tier: gold

📢 Sending promo to group: My Group
✅ Promotional message sent!
   Group: My Group
   Deep link: https://t.me/@botusername?start=model_507f1f77bcf86cd799439011

🎉 Done!
```

#### Deep Link Format
```
https://t.me/@botusername?start=model_<modelId>
```
Clicking this link starts the bot with the model profile showing directly.

#### Group Promotion
- Sends photo + caption with action button
- Button text: "🔥 Quero Ver Mais" (I Want to See More)
- Links directly to model profile via deep link
- Requires bot to be admin in group

### Gotchas
- Use bracket notation for env vars: `process.env['VARIABLE']`
- Redis connection uses singleton pattern
- Worker concurrency configurable via env
- Bot token stored in Settings model (single source)
- Gmail requires App Password (2FA must be enabled)
- MongoDB and S3 are EXTERNAL services (not in docker-compose)
- Run `bun run scripts/create-s3-bucket.ts` to create the S3 bucket
- Run `bun run scripts/test-connections.ts` to verify connectivity
- Run `bun scripts/seed-demo-model.ts` to prepare demo data for purchase testing
- Seed script updates existing model by username (idempotent)

## Worker Processors (2026-02-14)

### bot-tasks.processor.ts

**Purpose:** Handles all Telegram API operations asynchronously via BullMQ.

**Job Types Handled:**

1. **delete-message** - Delete single message
   - Input: `{ chatId, messageId }`
   - Deletes Telegram message and updates PostHistory

2. **delete-messages-bulk** - Delete specific message IDs
   - Input: `{ chatId, messageIds[], groupDbId? }`
   - Batch deletes with rate limiting (50ms between deletes)
   - Updates PostHistory records to `status: 'deleted'`
   - Handles Telegram rate limits with exponential backoff

3. **clear-all-messages** - Delete all messages from group
   - Input: `{ chatId, groupDbId, fromMessageId?, toMessageId?, olderThanDays? }`
   - Queries PostHistory to find matching message IDs
   - Applies filters: date range, age threshold, message ID range
   - Batch deletes with rate limiting
   - Updates PostHistory records to `status: 'deleted'`

4. **send-message** - Send message to group
   - Input: `{ chatId, text, parseMode?, replyToMessageId?, disableNotification?, bypassRateLimit? }`
   - Creates PostHistory record
   - Updates group's lastMessageId

5. **sync-groups** - Discover all groups
   - Syncs all groups bot is member of to database

6. **sync-single-group** - Sync specific group
   - Input: `{ telegramId? }`
   - Updates group stats and permissions

**Rate Limiting:**
- Telegram allows ~30 messages/second
- Processor uses 50ms delay (20 req/sec) for safety margin
- Implements exponential backoff on 429 (Too Many Requests)

**Error Handling:**

Classifies Telegram errors as:
- **Recoverable** (retry with backoff): Rate limits, server errors
- **Non-Recoverable** (skip): Permission denied, chat not found, bot kicked
- **Deactivation Required** (deactivate group): Bot blocked, chat deleted

On bot permission errors, automatically sets `group.settings.isActive = false`.

**Retry Logic:**
- BullMQ default: 3 retries with exponential backoff
- Max retry delay: 30 seconds
- Configurable per job via job options

**Files:**
- `services/worker/src/processors/bot-tasks.processor.ts`

### subscription.processor.ts

**Purpose:** Handles subscription lifecycle: expiration notifications and message cleanup.

**Processes:**
1. 7-day expiration warning notifications
2. 1-day final warning notifications
3. Expiration cleanup: delete messages, mark as expired

**Rate Limiting:**
- Processes 50 subscriptions per batch (configurable)
- Deletes messages with 50ms delay to respect Telegram API limits

**Files:**
- `services/worker/src/processors/subscription.processor.ts`

## Integration with Queue System (2026-02-14)

**New Job Types in Queue:**

```typescript
// common/queue/queues.ts
type BotTaskType =
  | 'send-message'
  | 'delete-message'
  | 'delete-messages-bulk'    // NEW
  | 'clear-all-messages'       // NEW
  | 'sync-groups'
  | 'sync-single-group'
  | 'get-chat-info'
  | 'check-permissions';
```

**Usage from API:**

```typescript
// src/server/trpc/routers/group.router.ts
bulkDeleteMessages: operatorProcedure
  .input(z.object({ groupDbId, messageIds }))
  .mutation(async ({ input }) => {
    await botTasksQueue.add('delete-messages-bulk', {
      chatId: input.chatId,
      messageIds: input.messageIds,
      groupDbId: input.groupDbId,
    });
    return { success: true };
  }),
```

**Monitoring:**
- Queue Monitor dashboard shows job status
- Failed jobs tracked with error messages
- Retry count visible in queue-monitor page
