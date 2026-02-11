# Domain: Bot Purchase Flow (Telegram Model Content)

## Last Update
- **Date:** 2026-02-11
- **Commit:** 25f97e0
- **Summary:** Completed subscription expiration system implementation with processor registration in worker service. Added scheduled jobs for 7-day warning, 1-day final warning, and automatic content deletion on expiry.

## Files

### Purchase Handler
- `services/bot/src/handlers/purchase.handler.ts` - Complete purchase flow (models list, profile, packs, checkout, payment verification)

### Bot Entry Point
- `services/bot/src/index.ts` - Bot setup with `/start` deep link support, command registration, and purchase handler integration

### Worker Processors
- `services/worker/src/index.ts` - Main worker service with subscription check job registration
- `services/worker/src/processors/subscription.processor.ts` - Expiration notifications and message deletion

### Payment Service
- `common/services/arkama.service.ts` - PIX payment integration with Arkama API and local fallback

### Seed/Demo
- `scripts/seed-demo-model.ts` - Demo model creation with 4 preview photos and 3 products (packs + subscription with contentPhotos)

### Webhook
- `src/app/api/webhooks/arkama/route.ts` - Arkama payment webhook handler (signature validation, auto content delivery)

## Connections
- **database** - OFModel (with contentPhotos), PurchaseModel, TransactionModel, TelegramUserModel
- **utilities** - ArkamaService for PIX payments
- **api** - Webhook endpoint for payment confirmations
- **infrastructure** - Seed scripts, Docker services

## Recent Commits
- (2026-02-11) - feat: implement subscription expiration system with automated notifications and content cleanup
- 72dd834 - docs: document model purchase PIX payment feature
- 2026-02-10 - feat: implement model purchase system with PIX payments (Arkama integration)

## Attention Points

### Purchase Flow Overview
```
1. /start command with deep link (model_123)
   ↓
2. Show model gallery (1-4 preview photos)
   ↓
3. Choose action: Packs OR Subscription OR OnlyFans link
   ↓
4. For Packs:
   - List all non-subscription products
   - Show pack details with preview image
   - Generate PIX code via Arkama
   ↓
5. For Subscription:
   - Show VIP benefits
   - Generate PIX code via Arkama
   ↓
6. Checkout:
   - Create Purchase record (pending status)
   - Create Transaction record
   - Call ArkamaService.createPixPayment()
   - Display PIX code + QR code
   - Show "Check Payment" button
   ↓
7. Payment Verification Loop:
   - User clicks "Ja transferi"
   - Call ArkamaService.checkPaymentStatus()
   - If paid: Mark purchase as paid, update user stats
   - If expired: Regenerate code
   - Otherwise: Keep waiting
```

### Key Features

#### Deep Links
- Bot supports `/start model_<modelId>` to jump directly to model profile
- Used in promotional messages with inline buttons
- Example: `https://t.me/@botusername?start=model_507f1f77bcf86cd799439011`

#### Model Gallery
- Supports 1-4 preview photos via `replyWithMediaGroup()`
- Falls back to single photo if group fails
- Falls back to text if no photos available
- Uses `StorageService.getPublicUrl()` for S3 URLs

#### Product Types
```typescript
type ProductType = 'content' | 'ppv' | 'subscription';

interface Product {
  _id: ObjectId;
  name: string;
  description?: string;
  type: ProductType;        // Determines display logic
  price: number;
  currency: 'BRL' | 'USD';
  previewImages?: string[];  // Optional preview for pack details
  isActive: boolean;
}
```

#### Models List
- Query: `OFModel.find({ isActive: true, 'products.0': { $exists: true } })`
- Shows tier emoji + name + minimum price
- Limited to 10 models for performance
- Sorted by tier (descending = platinum first)

#### Packs Menu vs Subscription
- **Packs** = type !== 'subscription' (&& isActive)
- **Subscription** = type === 'subscription' (&& isActive)
- Displayed as separate menus, not mixed

### Payment Processing

#### ArkamaService Integration
- **createPixPayment()** - Generates PIX code
  - Input: amount, description, externalId (Transaction ID)
  - Returns: pixCopyPaste, pixQrCode, expiresAt (30 min default)
  - Fallback: Local in-memory payment if API unavailable

- **checkPaymentStatus()** - Polls payment status
  - Input: paymentId (transaction externalId)
  - Returns: status (pending/processing/paid/failed/expired)
  - Auto-confirms after 10s for local fallback (demo only)

- **Local Fallback Mode**
  - Activated if ARKAMA_API_KEY not set or < 10 chars
  - Uses in-memory Map: `localPayments<string, PaymentData>`
  - Generates fake EMV-format PIX code
  - Auto-confirms after AUTO_PAY_DELAY_MS (10s) for testing
  - Manual confirm via `confirmPayment()` for admin testing

#### Models & Records
```typescript
// Purchase Record
{
  telegramUserId: number;
  telegramUsername?: string;
  modelId: ObjectId;
  productId: ObjectId;
  productSnapshot: { name, type, price, currency };
  amount: number;
  currency: 'BRL' | 'USD';
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired' | 'completed';
  transactionId?: ObjectId;
}

// Transaction Record
{
  purchaseId: ObjectId;
  paymentMethod: 'pix';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
  externalId?: string;     // Arkama order ID
  pixKey?: string;         // Reference key
  pixQrCode?: string;      // QR code URL
  pixCopyPaste?: string;   // EMV format (copia e cola)
  pixExpiresAt?: Date;     // When code expires
  paidAt?: Date;
  failureReason?: string;
}

// TelegramUser Stats
{
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  totalPurchases: number;
  totalSpent: number;
}
```

### Callback Handlers
All implemented via `bot.on('callback_query:data')`:

| Callback | Handler | Action |
|----------|---------|--------|
| `back_to_models` | showModelsList() | Show available models |
| `show_history` | showPurchaseHistory() | Show user's purchases |
| `model_<id>` | showModelProfile() | Show model gallery + options |
| `packs_<id>` | showPacksMenu() | List packs for model |
| `subscribe_<id>` | showSubscriptionOption() | Show VIP subscription |
| `pack_<modelId>_<productId>` | showPackDetails() | Show pack details + buy button |
| `buy_<modelId>_<productId>` | processCheckout() | Generate PIX + show code |
| `check_<purchaseId>` | checkPaymentStatus() | Poll and update status |
| `cancel` | cancelPurchase() | Abort and return to menu |

### HTML Escaping
All user-generated content escaped before sending:
- Model names, usernames, bios
- Product names, descriptions
- Use `escapeHtml()` helper before `<b>`, `<i>`, `<code>` tags

### Formatting Helpers
```typescript
getTierEmoji(tier: string) -> string;      // platinum/gold/silver/bronze -> emoji
formatPrice(price: number, currency: string) -> string;  // Uses Intl.NumberFormat (pt-BR)
escapeHtml(text: string) -> string;        // Replace &<> with entities
```

### Commands
- `/start [model_<id>]` - Welcome or direct to model
- `/models` - Show available models
- `/history` - Show purchase history
- `/help` - Show how to use
- `/status` - Bot status (admin only)

### Seed Script (seed-demo-model.ts)
- Creates demo model "Amanda Silva" with 4 preview photos
- Creates 3 products: Pack Verao (R$29.90), Pack Fitness (R$49.90), Assinatura VIP (R$79.90)
- Can optionally send promo message to registered groups
- Usage: `bun scripts/seed-demo-model.ts [--promo]`

### Gotchas & Common Issues

#### Issue 1: Gallery Send Fails
- `replyWithMediaGroup()` can fail if URLs are invalid
- Always try/catch and fall back to single photo
- Then fall back to text

#### Issue 2: Product Type Mismatch
- UI logic depends on exact type checking: `product.type !== 'subscription'`
- If adding new types (e.g., 'bundle'), update all filters
- Current types: 'content', 'ppv', 'subscription'

#### Issue 3: PIX Code Expiry
- Arkama defaults to 30 minutes
- Show expiry in UI: `Math.ceil((expiresAt - now) / 60000)` minutes
- Check status before expiry or code becomes unusable

#### Issue 4: Local Payment Auto-confirm
- Only for development/testing
- AUTO_PAY_DELAY_MS = 10 seconds
- Production uses real Arkama API with no auto-confirm

#### Issue 5: Payment Status Polling Loop
- User clicks "Ja transferi" multiple times before payment arrives
- Service responds "Aguardando..." if still pending
- Allows multiple check attempts without regenerating code

#### Issue 6: Storage Service Fallback
- If URL doesn't start with "http", use `StorageService.getPublicUrl()`
- Some URLs from Unsplash are direct URLs, some need S3 resolution
- Always handle both cases

### Testing Checklist

- [ ] Start bot with `/start` -> Shows welcome
- [ ] Click "Ver Conteudo" -> Shows model list (Amanda Silva)
- [ ] Click model -> Shows 4-photo gallery
- [ ] Click "Ver Packs" -> Lists Pack Verao and Pack Fitness
- [ ] Click pack -> Shows details + buy button
- [ ] Click "Liberar Acesso" -> Shows PIX code with 30-min timer
- [ ] Wait 10 seconds (local auto-pay) -> Click "Ja transferi" -> Payment succeeds
- [ ] Click "Ver outras modelos" -> Returns to list
- [ ] Click "Minhas Compras" -> Shows 1 purchase
- [ ] Deep link: `/start model_<id>` -> Jumps directly to gallery

### Recent Fixes (2026-02-10)

#### Fix 1: QR Code Display
**Problem:** `replyWithPhoto()` failed with base64 data URLs and external URLs (Google Charts QR codes).

**Solution:** Use `InputFile` from grammY for both base64 and URL sources:
```typescript
import { InputFile } from 'grammy';

// For base64
await ctx.replyWithPhoto(new InputFile(Buffer.from(base64, 'base64')));

// For URL
await ctx.replyWithPhoto(new InputFile({ url: qrCodeUrl }));
```

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

#### Fix 2: Unified Gallery with Action Buttons
**Problem:** Gallery photos sent as media group, then separate last photo with buttons → duplicate photo shown.

**Solution:** Send all but last photo as media group, then send last photo with inline keyboard:
```typescript
if (previewPhotos.length > 1) {
  // Media group for first N-1 photos
  await ctx.replyWithMediaGroup(previewPhotos.slice(0, -1).map(url => ({ type: 'photo', media: url })));
}
// Last photo with buttons
await ctx.replyWithPhoto(previewPhotos[previewPhotos.length - 1], {
  caption: message,
  reply_markup: { inline_keyboard: [...buttons] },
});
```

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

#### Fix 3: Content Delivery After Payment
**Problem:** No automatic content delivery after successful payment.

**Solution:** Implement `deliverContent()` function triggered by:
1. Webhook handler (`/api/webhooks/arkama`) on `payment.confirmed` event
2. Manual payment check callback handler

**Content Delivery Flow:**
```
1. Find Purchase by ID → verify status = 'paid'
2. Load Model + Product with contentPhotos
3. Send content in batches (max 10 photos per Telegram limit)
4. Mark Purchase as 'completed'
5. Notify user of successful delivery
```

**Implementation:**
```typescript
async function deliverContent(ctx, purchase) {
  const product = model.products.id(purchase.productId);
  const photos = product.contentPhotos || [];

  if (photos.length === 0) {
    // Fallback: send text notice
    return;
  }

  // Batch delivery (max 10 per group)
  const batches = chunkArray(photos, 10);
  for (const batch of batches) {
    if (batch.length === 1) {
      await ctx.api.sendPhoto(userId, batch[0]);
    } else {
      await ctx.api.sendMediaGroup(userId, batch.map(url => ({ type: 'photo', media: url })));
    }
  }

  purchase.status = 'completed';
  await purchase.save();
}
```

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

#### Fix 4: Arkama Webhook Handler
**Problem:** No webhook endpoint to receive payment confirmations from Arkama.

**Solution:** Created Next.js API route at `/api/webhooks/arkama/route.ts`:
- Validates HMAC-SHA256 signature from `X-Arkama-Signature` header
- Handles events: `payment.confirmed`, `payment.failed`, `payment.expired`
- Updates Purchase and Transaction status
- Auto-delivers content on payment confirmation
- Returns 200 OK to acknowledge webhook

**Webhook Signature Validation:**
```typescript
const signature = headers().get('x-arkama-signature');
const body = await request.text();
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
const expectedSignature = hmac.update(body).digest('hex');

if (signature !== expectedSignature) {
  return new Response('Invalid signature', { status: 401 });
}
```

**Files Created:**
- `src/app/api/webhooks/arkama/route.ts`

**Environment Variables:**
- `ARKAMA_WEBHOOK_SECRET` - Secret for HMAC validation (must match Arkama dashboard config)

### Subscription Expiration System (NEW - 2026-02-11)

**Overview:**
Automated system that notifies users before subscriptions expire and deletes content when expired.

**Architecture:**
```
PurchaseModel (with accessExpiresAt, sentMessages, notification flags)
    ↓
BullMQ subscriptionCheckQueue
    ↓
Worker service (subscription.processor.ts)
    ↓
Three scheduled jobs:
  1. Daily 9 AM: Check 7-day expirations → send notification
  2. Daily 9 AM: Check 1-day expirations → send final warning
  3. Every hour: Check expired → delete messages + update status
```

**Worker Jobs:**

1. **check-expiring-7days** (Cron: `0 9 * * *` - daily at 9 AM)
```typescript
// Find: status='completed' AND type='subscription' AND accessExpiresAt in 7 days
// Action: Send Telegram message, mark expirationNotified7Days=true
// Rate limit: 100ms between messages
```

2. **check-expiring-1day** (Cron: `0 9 * * *` - daily at 9 AM)
```typescript
// Find: status='completed' AND type='subscription' AND accessExpiresAt in 24h
// Action: Send final renewal warning, mark expirationNotified1Day=true
// Rate limit: 100ms between messages
```

3. **process-expired** (Cron: `0 * * * *` - every hour)
```typescript
// Find: status='completed' AND type='subscription' AND accessExpiresAt <= now
// Action:
//   1. Delete all messages in sentMessages array from Telegram
//   2. Update purchase status to 'expired'
//   3. Clear sentMessages array for privacy
// Rate limit: 50ms between deletes
```

**Message Deletion Flow:**

```typescript
// When content delivered to user
purchase.sentMessages = [
  { chatId: 123456789, messageIds: [1, 2, 3, 4] },  // Media group batch 1
  { chatId: 123456789, messageIds: [5, 6] },        // Media group batch 2
];
await purchase.save();

// On expiration
for (const { chatId, messageIds } of purchase.sentMessages) {
  for (const messageId of messageIds) {
    try {
      await api.deleteMessage(chatId, messageId);
    } catch (err) {
      // Message may already be deleted or chat deleted
      logger.debug('Could not delete message', { chatId, messageId });
    }
  }
}
purchase.status = 'expired';
purchase.sentMessages = [];  // Clear for privacy
await purchase.save();
```

**Database Indexes for Performance:**
```typescript
purchaseSchema.index({ status: 1, accessExpiresAt: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified7Days: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified1Day: 1 });
```

**Rate Limiting Rationale:**
- Message sends: 100ms between messages (Telegram's recommended limit)
- Message deletes: 50ms between deletes (faster, less sensitive)
- Prevents hitting Telegram API rate limits when processing many users

**Testing Subscription Expiration:**

1. Create subscription purchase with `accessExpiresAt` set to 8 days from now
2. Run `process-expired` job → should find and log (not expired yet)
3. Run `checkExpiringIn7Days` job → should send notification
4. Verify `expirationNotified7Days: true` in database
5. Change `accessExpiresAt` to 1 day from now
6. Run `checkExpiringIn1Day` job → should send final warning
7. Change `accessExpiresAt` to past date
8. Run `process-expired` job → should delete messages, update status to 'expired'

**Error Handling:**
- Notification failures logged, job continues (doesn't block other users)
- Message deletion failures logged but ignored (message may already be deleted)
- Worker retries job 3 times with exponential backoff if it throws

### Known Limitations

1. **Subscription Renewal** - Subscriptions don't auto-renew. Manual handling needed.
2. **Batch Purchasing** - Can only buy one product per purchase flow. Multiple purchases require multiple flows.
3. **Refunds** - Not implemented. ArkamaService doesn't have refund support yet.
4. **Content Batch Size** - Telegram limits media groups to 10 items. Large packs split across multiple messages.
5. **Message Persistence** - sentMessages only stored while subscription active. Cleared on expiration for privacy (can't view deletion history).

## Problems & Solutions

### 2026-02-11 - Subscription Processor Not Registered in Worker

**Problem:** Subscription processor was defined in `subscription.processor.ts` but worker was throwing error "No processor found for queue subscription-check" when scheduled jobs triggered.

**Root Cause:** Worker service (`services/worker/src/index.ts`) was missing the processor registration. The queue was configured in `common/queue/queues.ts` but no worker was listening to it.

**Solution:** Added processor registration in worker index:
```typescript
import { processSubscriptionCheck } from './processors/subscription.processor';

// Register subscription processor
subscriptionCheckWorker = new Worker(
  QUEUE_NAMES.SUBSCRIPTION_CHECK,
  processSubscriptionCheck,
  workerOptions
);

// Add repeatable jobs
await subscriptionCheckQueue.add(
  'check-expiring-7days',
  { type: 'check-expiring-7days' },
  { repeat: { pattern: '0 9 * * *' } }
);
// ... other jobs
```

**Prevention:** When creating new queues:
1. Add queue to `common/queue/queues.ts`
2. Create processor in `services/worker/src/processors/[name].processor.ts`
3. MUST register processor in `services/worker/src/index.ts` with `new Worker()`
4. Add repeatable jobs AFTER worker registration
5. Test with manual job trigger before relying on cron schedule

**Files Modified:**
- `services/worker/src/index.ts`
- `services/worker/src/processors/subscription.processor.ts`

### 2026-02-11 - Worker Jobs Need Job Type Discriminator

**Problem:** Single processor handling multiple job types (check-expiring-7days, check-expiring-1day, process-expired) needed way to route to correct handler function.

**Root Cause:** BullMQ worker processors receive `Job<TData>` but the job name is only metadata, not part of job data.

**Solution:** Used job data type discriminator pattern:
```typescript
interface SubscriptionJobData {
  type: 'check-expiring-7days' | 'check-expiring-1day' | 'process-expired';
}

export async function processSubscriptionCheck(job: Job<SubscriptionJobData>) {
  const { type } = job.data;
  switch (type) {
    case 'check-expiring-7days':
      await checkExpiringIn7Days();
      break;
    // ... other cases
  }
}
```

**Prevention:** For workers with multiple job types, always include `type` field in job data for routing. Job names are for BullMQ UI/logs, not for code logic.

**Files Modified:**
- `services/worker/src/processors/subscription.processor.ts`
