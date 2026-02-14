# Domain: Database (MongoDB + Mongoose)

## Last Update
- **Date:** 2026-02-14
- **Commit:** a923cae
- **Summary:** Bulk message deletion system added - new job data types and audit actions for managing Telegram group message cleanup

## Files

### Connection
- `common/db/index.ts` - MongoDB connection singleton

### Models (17 total)
- `user.model.ts` - Admin users with roles (admin, operator)
- `session.model.ts` - HTTP-only session storage
- `magic-link.model.ts` - Login tokens (15min TTL)
- `telegram-group.model.ts` - Managed Telegram groups
- `campaign.model.ts` - OF/Casino campaigns with status
- `creative.model.ts` - Ad content (image/video/text)
- `scheduled-post.model.ts` - Queue entries for posting
- `post-history.model.ts` - Execution logs with metrics
- `model.model.ts` - OnlyFans creators with products array
- `casino.model.ts` - Casino brands with risk levels
- `deal.model.ts` - Revenue agreements
- `settings.model.ts` - Bot configuration (single doc)
- `audit-log.model.ts` - All user actions logged
- `purchase.model.ts` - NEW: Bot purchase records (telegramUserId, modelId, productId, status)
- `transaction.model.ts` - NEW: Payment transactions (purchaseId, paymentMethod, PIX data, status)
- `telegram-user.model.ts` - NEW: Bot users with purchase stats

### Index Export
- `common/models/index.ts` - Re-exports all models

## Connections
- **api** - All routers import models from @common
- **authentication** - User, Session, MagicLink models
- **utilities** - Services use models for business logic

## Recent Commits
- a923cae - feat: add subscription expiration system and image cropper
- 25f97e0 - feat: add clickable model name to open detail page
- 4c4a76b - docs: update CLAUDE.md with model detail pages changes
- 48ae98e - feat: migrate model editing from modals to dedicated pages
- 72dd834 - docs: document model purchase PIX payment feature

## Purchase Models (NEW - 2026-02-10)

### Purchase Model
```typescript
{
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  modelId: ObjectId;          // Reference to OFModel
  productId: ObjectId;        // Reference to OFModel.products[i]._id
  productSnapshot: {
    name: string;
    type: 'content' | 'ppv' | 'subscription';
    price: number;
    currency: string;
  };
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired' | 'completed';
  transactionId?: ObjectId;   // Reference to Transaction
  createdAt: Date;
  updatedAt: Date;
}
```

### Transaction Model
```typescript
{
  purchaseId: ObjectId;       // Reference to Purchase
  paymentMethod: 'pix';       // Future: 'credit_card', 'boleto'
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired';
  externalId?: string;        // Arkama order ID (reconciliation)
  pixKey?: string;            // Reference key
  pixQrCode?: string;         // QR code URL
  pixCopyPaste?: string;      // EMV format (copia e cola)
  pixExpiresAt?: Date;        // Code expiry (30 min)
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### TelegramUser Model
```typescript
{
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  totalPurchases: number;     // Counter for analytics
  totalSpent: number;         // Total amount spent (BRL)
  lastPurchaseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### OFModel Updates
```typescript
// Added fields:
previewPhotos?: string[];     // 1-4 gallery photos
products: [{
  _id: ObjectId;
  name: string;
  description?: string;
  type: 'content' | 'ppv' | 'subscription';
  price: number;
  currency: 'BRL' | 'USD';
  previewImages?: string[];   // Pack preview images
  contentPhotos?: string[];   // Actual content delivered after purchase
  isActive: boolean;
}];
```

## Attention Points

### Model Patterns
- All models use TypeScript interfaces for document types
- Schemas export both Model and Document types
- Use `.lean()` for read-only queries
- Use `.toObject()` when returning to client (handled by tRPC)

### Schema Default Values (IMPORTANT)
Many schemas have automatic defaults that affect immediate query results:
- **Group**: `settings: { isActive: true }` - New groups are active by default
- **Creative**: `settings: { isCompliant: true }` - New creatives are compliant by default
- **Campaign**: `status: 'draft'` - New campaigns start in draft
- These defaults are returned immediately in getActive queries after creation
- No need to explicitly set if creating with standard create mutation

### 2027-01-27 Session Learnings

#### Test Data Chain
When testing campaign features, create data in this exact order:
```
Model → Group → Creative → Campaign → ScheduledPost
```
Each entity links to the previous, so:
1. Create Model first (OnlyFans or Casino)
2. Create Group next (links to Model via modelId)
3. Create Creative next (links to Group via groupId)
4. Create Campaign (links to Model + multiple Groups)
5. Create ScheduledPost (links to Campaign + Creative + Group)

#### Default Values Matter
When debugging why entities appear/disappear in `getActive` queries:
- Check schema defaults - they apply immediately
- Example: Group created without `settings` will have `isActive: true` automatically
- This affects `getActive` query results immediately after creation (no refetch needed)

### Key Schemas

#### Campaign
```typescript
{
  name, type (onlyfans|casino), status, priority,
  targetGroups[], creatives[], schedule,
  limits: { daily, weekly },
  performance: { views, clicks, ctr, revenue }
}
```

#### PostHistory
```typescript
{
  campaignId, groupId, creativeId, messageId,
  sentAt, metrics: { views, clicks, reactions, replies },
  revenue, status (sent|failed|deleted)
}
```

#### AuditLog
```typescript
{
  userId, action, entityType, entityId,
  changes: { before, after },
  metadata: { ipAddress, userAgent, route, timestamp, duration, success }
}
```

### Subscription Expiration System (2026-02-11)

**Fields Added to PurchaseModel:**
```typescript
{
  accessExpiresAt: Date;                    // When subscription expires
  sentMessages: [{ chatId, messageIds }];   // Track delivered content messages
  expirationNotified7Days: boolean;         // 7-day warning sent flag
  expirationNotified1Day: boolean;          // 1-day warning sent flag
}
```

**Purpose:** Supports subscription lifecycle with automated notifications and content cleanup.

**Indexes Added:**
```typescript
purchaseSchema.index({ status: 1, accessExpiresAt: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified7Days: 1 });
purchaseSchema.index({ status: 1, accessExpiresAt: 1, expirationNotified1Day: 1 });
```

**Subscription Workflow:**
1. User purchases subscription product (monthly/yearly, e.g., 30 days)
2. `accessExpiresAt` set to purchase date + duration
3. Worker job daily checks for subscriptions expiring in 7 days → sends notification, marks `expirationNotified7Days: true`
4. Worker job daily checks for subscriptions expiring in 1 day → sends notification, marks `expirationNotified1Day: true`
5. Worker job hourly checks for expired subscriptions (accessExpiresAt <= now):
   - Deletes all messages in `sentMessages` (using Telegram API)
   - Sets `status: 'expired'`
   - Clears `sentMessages` for privacy

**Key Points:**
- Notifications tracked to avoid duplicate sends
- Messages deleted automatically on expiration (content revoked)
- sentMessages array populated when content delivered to user
- Rate-limited message deletion (50ms between deletes) to avoid Telegram API throttling

### Product Content Photos (2026-02-10)

**Field:** `contentPhotos?: string[]` in `OFModel.products[]`

**Purpose:** Stores actual content URLs delivered to user AFTER successful payment (separate from previewImages shown before purchase).

**Usage:**
```typescript
// In seed script
product.contentPhotos = [
  'https://example.com/content/photo1.jpg',
  'https://example.com/content/photo2.jpg',
  // ... up to 50+ photos
];

// In bot delivery
const product = model.products.id(purchase.productId);
const photos = product.contentPhotos || [];

// Send in batches (Telegram limit: 10 per media group)
for (const batch of chunkArray(photos, 10)) {
  await ctx.api.sendMediaGroup(userId, batch.map(url => ({ type: 'photo', media: url })));
}
```

**Key Points:**
- Optional field (fallback to text message if empty)
- No limit on array size (Telegram will batch automatically)
- Uses public URLs (S3, Unsplash, etc.)
- Delivered only when purchase.status === 'paid'

### Bulk Message Deletion Data Types (2026-02-14)

**DeleteMessagesBulkJobData:**
```typescript
{
  chatId: string;           // Telegram chat ID
  messageIds: number[];     // Array of message IDs to delete
  groupDbId?: string;       // MongoDB _id for updating PostHistory
}
```

**ClearAllMessagesJobData:**
```typescript
{
  chatId: string;              // Telegram chat ID
  groupDbId: string;           // MongoDB _id for querying PostHistory
  fromMessageId?: number;      // Start from this message ID (for range deletion)
  toMessageId?: number;        // End at this message ID
  olderThanDays?: number;      // Delete messages older than X days
}
```

**Deletion Flow:**
1. Dashboard calls `group.bulkDeleteMessages` or `group.clearAllMessages`
2. tRPC route enqueues job via BullMQ
3. Worker processor handles deletion:
   - Fetches message IDs from PostHistory (if using clearAllMessages)
   - Deletes messages via Telegram API with rate limiting (50ms between calls)
   - Updates PostHistory records: `status: 'deleted'`
   - Handles rate limits and permission errors
4. Audit log records: `group.bulkDeleteMessages` or `group.clearAllMessages`

**Attention:**
- Messages are only deleted if bot has `canDeleteMessages` permission
- Failed deletes due to permission/rate-limit are retried via BullMQ
- PostHistory records kept with `status: 'deleted'` for audit trail (not removed)
- Single message deletion uses `delete-message` job type (different from bulk)

### Gotchas
- MongoDB connection is lazy (connects on first query)
- Use `@common` alias to import models
- Settings model is singleton (findOne or create)
- AuditLog timestamps come from metadata.timestamp, not createdAt
- Product contentPhotos must be batched (max 10 per Telegram media group)
- Bulk deletion requires PostHistory records linking to group (via `group.getMessages`)
