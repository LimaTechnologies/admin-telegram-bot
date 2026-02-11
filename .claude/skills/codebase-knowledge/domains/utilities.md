# Domain: Utilities (Shared Services & Helpers)

## Last Update
- **Date:** 2026-02-11
- **Commit:** 25f97e0
- **Summary:** Completed subscriptionCheckQueue configuration and worker registration. Queue handles 3 repeatable jobs: 7-day warning, 1-day warning, and hourly expiration processing.

## Files

### Queue Configuration
- `common/queue/queues.ts` - BullMQ queue setup (audit, analytics, campaign, bot tasks, subscription)

### Payment Services
- `common/services/arkama.service.ts` - PIX payment integration (Arkama API + local fallback)

### Authentication Services
- `common/services/auth.service.ts` - Auth logic (magic link, password verification, dev bypass)
- `common/services/email.service.ts` - Email sending for magic links

### Core Utilities
- `common/services/logger.ts` - Winston logger with levels (info, warn, error)
- `common/services/storage.service.ts` - S3/MinIO file operations (presigned URLs, public URLs, delete)
- `common/index.ts` - Main export (connects DB, exports models and services)

### Index Export
- `common/models/index.ts` - Re-exports all Mongoose models

## Connections
- **database** - Services use Mongoose models
- **api** - tRPC routers import services
- **bot-purchase** - ArkamaService for payment processing
- **pages** - Dashboard pages use storage service

## Recent Commits
- 25f97e0 - feat: add clickable model name to open detail page
- 4c4a76b - docs: update CLAUDE.md with model detail pages changes
- (2026-02-11) - feat: add subscription check queue for expiration processing
- (2026-02-11) - feat: register subscription processor in worker service
- 2026-02-10 - feat: add arkama service for pix payments with local fallback

### Queue Configuration (2026-02-11)

**Subscription Check Queue** - `common/queue/queues.ts`

```typescript
export const subscriptionCheckQueue = new Queue(QUEUE_NAMES.SUBSCRIPTION_CHECK, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});
```

**Purpose:** Handles scheduled subscription expiration checks and cleanup.

**Three Repeatable Jobs:**

1. **check-expiring-7days** (daily at 9:00 AM)
   - Finds subscriptions expiring within 7 days
   - Sends Telegram notification to user
   - Marks `expirationNotified7Days: true`
   - Pattern: `0 9 * * *` (cron format)

2. **check-expiring-1day** (daily at 9:00 AM)
   - Finds subscriptions expiring within 1 day
   - Sends final renewal warning to user
   - Marks `expirationNotified1Day: true`
   - Pattern: `0 9 * * *`

3. **process-expired** (every hour)
   - Finds completely expired subscriptions (accessExpiresAt <= now)
   - Deletes all content messages from `sentMessages` array
   - Updates purchase status to 'expired'
   - Clears sentMessages for privacy
   - Pattern: `0 * * * *` (hourly)

**Queue Options:**
- Concurrency: 2 (low to avoid Telegram rate limits)
- Retry attempts: 3 with exponential backoff (5s initial)
- Auto-cleanup: Remove completed jobs after 1000 count

**Related Files:**
- `services/worker/src/index.ts` - Worker registration
- `services/worker/src/processors/subscription.processor.ts` - Processor logic

## Attention Points

### ArkamaService (NEW)

#### Purpose
Handles PIX payment creation and status checking via Arkama API.
Supports local in-memory fallback for testing/development.

#### Configuration
```typescript
ARKAMA_API_URL = process.env['ARKAMA_API_URL'] || 'https://sandbox.arkama.com.br/api/v1'
ARKAMA_API_KEY = process.env['ARKAMA_API_KEY'] || ''

// Fallback activated if:
// - ARKAMA_API_KEY not set
// - ARKAMA_API_KEY length < 10 chars
```

#### Methods

##### createPixPayment(input: CreatePixPaymentInput) -> Promise<PixPaymentResponse>
Creates a new PIX payment order.

```typescript
input: {
  amount: number;              // In real currency (BRL)
  currency: 'BRL' | 'USD';
  description: string;         // "ModelName - PackName"
  externalId: string;          // Transaction ID (for reconciliation)
  customer?: {
    name?: string;
    email?: string;
    document?: string;         // CPF
  }
}

response: {
  success: boolean;
  data?: {
    id: string;               // Arkama transaction ID
    pixKey: string;           // Reference key
    pixQrCode: string;        // QR code URL
    pixCopyPaste: string;     // EMV format (copia e cola)
    expiresAt: Date;          // 30 minutes from now
    amount: number;
    currency: string;
  };
  error?: string;
}
```

**Behavior:**
- If API configured: Calls Arkama, generates real PIX code
- If API not configured: Uses local fallback
- If API fails: Logs error, falls back to local
- Local fallback: Auto-confirms payment after 10 seconds (for demo)

##### checkPaymentStatus(input: CheckPaymentStatusInput) -> Promise<PaymentStatusResponse>
Checks payment status by transaction ID.

```typescript
input: {
  paymentId: string;        // Arkama transaction ID or local payment ID
}

response: {
  success: boolean;
  data?: {
    id: string;
    status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
    paidAt?: Date;
    amount: number;
  };
  error?: string;
}
```

**Behavior:**
- Checks local payments first (faster)
- Falls back to Arkama API
- Auto-expires pending local payments after 30 minutes
- Auto-confirms local payments after AUTO_PAY_DELAY_MS (10s)

##### confirmPayment(paymentId: string) -> Promise<boolean>
Manually mark payment as paid (testing/admin only).

```typescript
// Marks local payment as paid immediately
const confirmed = ArkamaService.confirmPayment(paymentId);
```

##### getPendingPayments() -> Array<PaymentData>
Returns all pending local payments (debugging/admin).

```typescript
const pending = ArkamaService.getPendingPayments();
// Returns: [{ id, amount, status, createdAt }, ...]
```

#### Local Fallback Behavior

**When Used:**
- ARKAMA_API_KEY not configured
- Arkama API temporarily unavailable
- Network/timeout errors

**Features:**
- In-memory storage (not persisted)
- Generates fake EMV-format PIX code
- Auto-confirms after 10 seconds (AUTO_PAY_DELAY_MS)
- 30-minute expiry (like real PIX)
- Useful for local development and demos

**Example EMV Code:**
```
00020126580014br.gov.bcb.pix0136local_xxxxx5204000053039865406029.905802BR5913TelegramAdmin6008SaoPaulo62070503***6304
```

#### Error Handling
- Logs all API errors to logger
- Gracefully falls back to local on errors
- Returns `{ success: false, error: "..." }` on failure
- No exceptions thrown (all handled)

#### Type Definitions
```typescript
export interface CreatePixPaymentInput { /* ... */ }
export interface PixPaymentResponse { /* ... */ }
export interface CheckPaymentStatusInput { /* ... */ }
export interface PaymentStatusResponse { /* ... */ }
```

### AuthService

#### Methods
- `generateMagicLink(email: string)` - Creates 15-min token
- `verifyToken(token: string)` - Validates and hashes
- `isDevBypassEmail(email: string)` - Checks dev bypass
- `devLogin(email: string)` - Creates admin user for dev
- `verifyPassword(password: string, hash: string)` - Compare hashes

#### Dev Bypass
- Email: `joaovitor_rlima@hotmail.com` (hardcoded in service)
- Skips email verification
- Auto-creates admin user if not exists
- Used in development only

### StorageService

#### Methods
- `getPresignedUploadUrl(filename, mimeType, folder)` - Browser upload URL
- `getPublicUrl(s3Key)` - Display/embed URL
- `deleteFile(s3Key)` - Remove from S3/MinIO

#### Integration Points
- Used in creative upload flows
- Used in model gallery display
- Falls back to direct HTTP URLs if needed

### Logger Service

#### Levels
- `logger.info()` - Normal operations
- `logger.warn()` - Potential issues
- `logger.error()` - Failures
- `logger.debug()` - Detailed diagnostics

#### Format
- Timestamp
- Level badge
- Message
- Context object (if provided)

#### Common Tags
- `[Arkama]` - Payment-related logs
- `[Storage]` - File operations
- `[Auth]` - Authentication flows

### Common Patterns

#### Service Singleton
```typescript
export class ServiceName {
  private static instance: ServiceName | null = null;

  private static getInstance(): ServiceName {
    if (!this.instance) {
      this.instance = new ServiceName();
    }
    return this.instance;
  }
}
```

#### Error Logging Pattern
```typescript
try {
  // operation
} catch (error) {
  logger.error('Context message', { error, contextData });
  // handle gracefully
}
```

#### Fallback Pattern
```typescript
if (!isConfigured()) {
  logger.warn('Using fallback');
  return fallbackImplementation();
}
```

### Known Limitations

1. **Local Payments Not Persisted** - In-memory only. Lost on restart.
2. **No Webhook Support** - Payment status checked via polling, not webhooks.
3. **No Refund Support** - ArkamaService doesn't implement refunds yet.
4. **Single Instance** - Services use static methods, not true DI.
5. **No Retry Logic** - API calls fail immediately, no exponential backoff.

### Testing Notes

#### Arkama Sandbox
- API URL: `https://sandbox.arkama.com.br/api/v1`
- Get test key from: https://arkama.readme.io/reference/intro
- Real QR codes in sandbox (testable)

#### Local Testing
- No API key needed
- Auto-confirms after 10 seconds
- Useful for quick iterations
- Not suitable for real payments

#### Development Setup
```bash
# Use local fallback (no key)
# OR
# Add real sandbox key
export ARKAMA_API_KEY='your-sandbox-key'
export ARKAMA_API_URL='https://sandbox.arkama.com.br/api/v1'
```

### Gotchas

1. **Amount Format** - Arkama expects cents (multiply by 100). Service handles this.
2. **Currency Mapping** - Only BRL/USD supported. Others will fail.
3. **QR Code Format** - Some Arkama responses use `qrCodeUrl`, others use embedded QR data.
4. **Email Service** - Not documented in this file (separate domain).
5. **Logger Levels** - Info is default, errors show context automatically.

## Problems & Solutions

### 2026-02-11 - Worker Registration for New Queue

**Problem:** Created subscription check queue in `common/queue/queues.ts` but worker was not processing jobs.

**Root Cause:** Queue configuration alone is not enough. Worker service must explicitly register a processor for the queue.

**Solution:** Three-step worker setup:
1. **Queue configuration** in `common/queue/queues.ts`:
```typescript
export const subscriptionCheckQueue = new Queue(QUEUE_NAMES.SUBSCRIPTION_CHECK, {
  ...defaultQueueOptions,
});
```

2. **Processor function** in `services/worker/src/processors/subscription.processor.ts`:
```typescript
export async function processSubscriptionCheck(job: Job<SubscriptionJobData>) {
  // Handler logic
}
```

3. **Worker registration** in `services/worker/src/index.ts`:
```typescript
subscriptionCheckWorker = new Worker(
  QUEUE_NAMES.SUBSCRIPTION_CHECK,
  processSubscriptionCheck,
  workerOptions
);

// Add repeatable jobs AFTER worker registration
await subscriptionCheckQueue.add('check-expiring-7days', { type: 'check-expiring-7days' }, {
  repeat: { pattern: '0 9 * * *' },
});
```

**Prevention:** When creating new BullMQ queues:
- Define queue in common/queue/queues.ts
- Create processor file in services/worker/src/processors/
- Register worker in services/worker/src/index.ts
- Add repeatable jobs after worker is registered
- Test manually before relying on cron schedule

**Files Modified:**
- `common/queue/queues.ts`
- `services/worker/src/index.ts`
- `services/worker/src/processors/subscription.processor.ts`

### 2026-02-11 - Rate Limiting Telegram API Calls

**Problem:** Worker processing many subscriptions could hit Telegram API rate limits when sending notifications or deleting messages.

**Root Cause:** Telegram bot API has rate limits: ~30 messages/second to different chats, ~20 messages/second to same chat.

**Solution:** Added rate limiting delays between operations:
```typescript
// Between notification sends (100ms delay)
for (const purchase of expiringPurchases) {
  await api.sendMessage(purchase.telegramUserId, message);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

// Between message deletes (50ms delay, less sensitive)
for (const messageId of messageIds) {
  await api.deleteMessage(chatId, messageId);
  await new Promise((resolve) => setTimeout(resolve, 50));
}
```

**Prevention:**
- For sends: 100ms between messages (safe for most use cases)
- For deletes: 50ms between deletes (faster, less rate-limited)
- For bulk operations (>100 users): Consider batching jobs or increasing delay
- Monitor logs for "429 Too Many Requests" errors

**Files Modified:**
- `services/worker/src/processors/subscription.processor.ts`
