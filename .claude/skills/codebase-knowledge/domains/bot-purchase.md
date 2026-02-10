# Domain: Bot Purchase Flow (Telegram Model Content)

## Last Update
- **Date:** 2026-02-10
- **Commit:** [latest model purchase feature]
- **Summary:** Implemented complete PIX payment system for model content purchases via Telegram bot with deep link support, gallery preview, and pack/subscription separation.

## Files

### Purchase Handler
- `services/bot/src/handlers/purchase.handler.ts` - Complete purchase flow (models list, profile, packs, checkout, payment verification)

### Bot Entry Point
- `services/bot/src/index.ts` - Bot setup with `/start` deep link support, command registration, and purchase handler integration

### Payment Service
- `common/services/arkama.service.ts` - PIX payment integration with Arkama API and local fallback

### Seed/Demo
- `scripts/seed-demo-model.ts` - Demo model creation with 4 preview photos and 3 products (packs + subscription)

## Connections
- **database** - OFModel, PurchaseModel, TransactionModel, TelegramUserModel
- **utilities** - ArkamaService for PIX payments
- **infrastructure** - Seed scripts, Docker services

## Recent Commits
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

### Known Limitations

1. **Payment Webhook** - Not implemented yet. Status checks are polling-based, not webhook-based.
2. **Subscription Renewal** - Subscriptions don't auto-renew. Manual handling needed.
3. **Batch Purchasing** - Can only buy one product per purchase flow. Multiple purchases require multiple flows.
4. **Refunds** - Not implemented. ArkamaService doesn't have refund support yet.
