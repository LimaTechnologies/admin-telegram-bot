# Domain: Database (MongoDB + Mongoose)

## Last Update
- **Date:** 2026-02-10
- **Commit:** (model purchase feature)
- **Summary:** Purchase, Transaction, TelegramUser models for PIX payment system. OFModel includes products array and preview photos.

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
- 72dd834 - docs: document model purchase PIX payment feature
- 2026-02-10 - feat: implement model purchase system with PIX payments (Arkama)
- `c4cf62c` - feat: add all missing dashboard pages
- Initial model implementation

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
  contentPhotos?: string[];   // NEW: Actual content delivered after purchase
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

### Gotchas
- MongoDB connection is lazy (connects on first query)
- Use `@common` alias to import models
- Settings model is singleton (findOne or create)
- AuditLog timestamps come from metadata.timestamp, not createdAt
- Product contentPhotos must be batched (max 10 per Telegram media group)
