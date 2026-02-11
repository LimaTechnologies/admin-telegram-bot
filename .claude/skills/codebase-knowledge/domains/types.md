# Domain: TypeScript Type Definitions

## Last Update
- **Date:** 2026-02-11
- **Commit:** (subscription expiration system)
- **Summary:** Added ISentMessage interface for tracking sent subscription content messages for deletion on expiration.

## Files

### Purchase Types
- `types/purchase.ts` - Purchase, Transaction, TelegramUser interfaces and input types

## Connections
- **database** - Mongoose models implement these interfaces
- **api** - tRPC routers use these types for input validation and responses
- **bot-purchase** - Bot handlers use these types for purchase flow

## Recent Commits
- (2026-02-11) - feat: add ISentMessage interface for subscription content tracking
- 2026-02-10 - feat: add purchase, transaction, telegram user types for PIX payment system
- Initial type definitions

## Type Definitions (2026-02-11)

### ISentMessage (NEW)

```typescript
export interface ISentMessage {
  chatId: number;           // Telegram chat/user ID
  messageIds: number[];     // Array of message IDs sent to user
}
```

**Purpose:** Tracks Telegram messages sent to user during subscription content delivery. Used for cleanup when subscription expires.

**Usage:**
```typescript
// When delivering content to user
const sentMessages: ISentMessage[] = [];

// Send each photo/content batch
for (const batch of photoChunks) {
  const result = await ctx.api.sendMediaGroup(chatId, batch);
  sentMessages.push({
    chatId,
    messageIds: result.map(m => m.message_id),
  });
}

// Save to purchase record
purchase.sentMessages = sentMessages;
await purchase.save();

// Later, when subscription expires
for (const { chatId, messageIds } of purchase.sentMessages) {
  for (const messageId of messageIds) {
    try {
      await api.deleteMessage(chatId, messageId);
    } catch (err) {
      // Message may already be deleted
    }
  }
}
```

**Key Points:**
- Stores multiple message IDs per sent batch
- Supports Telegram media group responses (multiple messages per batch)
- Allows cleanup of all content when subscription expires
- Cleared after deletion for privacy

### IPurchase Updates (2026-02-11)

Added subscription-related fields:

```typescript
export interface IPurchase {
  // ... existing fields ...

  // Delivery & Expiration
  deliveredAt?: Date;               // When content was first delivered
  accessExpiresAt?: Date;           // Subscription expiration date

  // Message Tracking
  sentMessages?: ISentMessage[];    // Content messages for deletion

  // Notification Flags
  expirationNotified7Days?: boolean;  // 7-day warning sent
  expirationNotified1Day?: boolean;   // 1-day final warning sent
}
```

**Subscription Lifecycle:**
1. User purchases subscription (e.g., 30-day)
2. `accessExpiresAt` set to current time + subscription duration
3. `deliveredAt` set when content photos/videos sent
4. `sentMessages` populated with message IDs
5. Worker job 7 days before: sets `expirationNotified7Days: true`
6. Worker job 1 day before: sets `expirationNotified1Day: true`
7. Worker job on expiration: deletes messages in `sentMessages`, sets `status: 'expired'`

### Transaction Types

```typescript
export interface ITransaction {
  purchaseId: Types.ObjectId;
  paymentMethod: PaymentMethod;  // 'pix' | 'credit_card' | 'bank_transfer'
  amount: number;
  currency: 'BRL' | 'USD';
  status: TransactionStatus;  // 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'expired'

  // PIX specific
  pixKey?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;

  // Processing
  paidAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}
```

### PurchaseStatus Enum

```typescript
export type PurchaseStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'refunded' | 'expired';
```

**Status Meanings:**
- **pending** - Created, awaiting payment
- **paid** - Payment received, content being delivered
- **completed** - Content delivered successfully
- **failed** - Payment failed/rejected
- **refunded** - Payment refunded to user
- **expired** - Subscription expired, content deleted

### TransactionStatus Enum

```typescript
export type TransactionStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'expired';
```

**Status Meanings:**
- **pending** - Created, awaiting payment processing
- **processing** - Payment being processed by provider
- **paid** - Payment confirmed
- **failed** - Payment rejected
- **refunded** - Payment refunded
- **expired** - PIX code expired (30 min default)

## Attention Points

### ISentMessage Field Design
- Stores array of messages per chat to handle media group responses
- Each `sendMediaGroup()` call returns multiple message objects
- Simplifies cleanup: iterate chatId/messageIds pairs

### Status Transitions

**Purchase Status Flow:**
```
pending → paid → completed
           ↓
        failed

completed → expired (when accessExpiresAt <= now)
```

**Transaction Status Flow:**
```
pending → processing → paid
                     ↓
                  failed/expired
```

### Type Safety Notes
- All status fields are enums (not strings) for compile-time safety
- ObjectId imports from mongoose.Types
- Date fields for timestamps (Mongoose auto-converts)
- Optional fields with `?` for conditional data

### Files That Reference These Types
- `common/models/purchase.model.ts` - Implements IPurchase
- `common/models/transaction.model.ts` - Implements ITransaction
- `src/server/trpc/routers/purchase.router.ts` - Input/output validation
- `services/bot/src/handlers/purchase.handler.ts` - Uses all types
- `services/worker/src/processors/subscription.processor.ts` - Processes IPurchase
