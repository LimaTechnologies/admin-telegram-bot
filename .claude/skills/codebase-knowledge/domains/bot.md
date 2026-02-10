# Domain: Telegram Bot (grammY)

## Last Update
- **Date:** 2026-02-07
- **Commit:** 5216399
- **Summary:** Implemented complete purchase flow with deep linking, galleries, PIX payments

## Files

### Bot Entry Point
- `services/bot/src/index.ts` - Bot initialization, command registration, deep link support

### Handlers
- `services/bot/src/handlers/purchase.handler.ts` - Complete purchase flow (models → gallery → packs/subscribe → checkout → payment)

## Connections
- **database** - Uses Purchase, Transaction, TelegramUser, OFModel models
- **utilities** - Uses ArkamaService for PIX payments, StorageService for S3 URLs

## Recent Commits
- `5216399` - feat: implement model purchase system with PIX payments
- Initial bot implementation with status/start commands

## Purchase Flow Architecture

### Flow Stages

```
1. Entry → /models or /start modelId=xxx (deep link)
2. Models List → Grid of models with tier + min price
3. Model Profile → Photo gallery (1-4 images) + action buttons
4. Decision Fork:
   - Packs → Grid of one-time purchase packs
   - Subscribe → Subscription details
5. Pack/Subscription Details → Preview image + description + price
6. Checkout → Generate PIX payment code
7. Payment Verification → Check payment status with Arkama
8. Completion → Access granted message
```

### Commands

| Command | Description | Handler |
|---------|-------------|---------|
| `/models` | List all active models | `showModelsList()` |
| `/history` | Show purchase history | `showPurchaseHistory()` |
| `/start modelId=xxx` | Deep link to specific model | `showModelProfile()` |

### Callback Query Patterns

| Pattern | Action | Function |
|---------|--------|----------|
| `back_to_models` | Return to models list | `showModelsList()` |
| `show_history` | Show purchase history | `showPurchaseHistory()` |
| `model_{id}` | Show model profile | `showModelProfile()` |
| `packs_{id}` | Show packs menu | `showPacksMenu()` |
| `subscribe_{id}` | Show subscription option | `showSubscriptionOption()` |
| `pack_{modelId}_{productId}` | Pack details | `showPackDetails()` |
| `buy_{modelId}_{productId}` | Initiate checkout | `processCheckout()` |
| `check_{purchaseId}` | Check payment status | `checkPaymentStatus()` |
| `cancel` | Cancel purchase | `cancelPurchase()` |

## Key Patterns

### Photo Galleries (Media Groups)

```typescript
// Send 1-4 photos as album
const mediaGroup = model.previewPhotos.slice(0, 4).map((photo, idx) => ({
  type: 'photo' as const,
  media: StorageService.getPublicUrl(photo),
  caption: idx === 0 ? caption : undefined,
  parse_mode: idx === 0 ? ('HTML' as const) : undefined,
}));

await ctx.replyWithMediaGroup(mediaGroup);
// Follow with action buttons in separate message
await ctx.reply('Choose an option:', { reply_markup: keyboard });
```

### Deep Linking

```typescript
// Bot index.ts
bot.command('start', async (ctx) => {
  const params = ctx.match; // "modelId=64abc123..."
  if (params?.startsWith('modelId=')) {
    const modelId = params.replace('modelId=', '');
    await showModelProfile(ctx, modelId);
    return;
  }
  // Regular start flow
});
```

### HTML Parse Mode (NOT Markdown)

```typescript
// ALWAYS use HTML to avoid emoji conflicts
await ctx.reply(
  `<b>Title</b>\n\n` +
  `${escapeHtml(userInput)}\n\n` +
  `<i>Description</i>`,
  { parse_mode: 'HTML' }
);

// Helper function
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

### Inline Keyboards

```typescript
const keyboard = new InlineKeyboard()
  .text('📦 Packs', `packs_${modelId}`) // Same row
  .text('⭐ Subscribe', `subscribe_${modelId}`)
  .row() // New row
  .url('💋 OnlyFans', model.onlyfansUrl)
  .row()
  .text('⬅️ Back', 'back_to_models');
```

### Purchase Creation Flow

```typescript
// 1. Upsert TelegramUser
await TelegramUserModel.findOneAndUpdate(
  { telegramId: userId },
  { telegramId: userId, username, firstName, lastName },
  { upsert: true }
);

// 2. Create Purchase
const purchase = await PurchaseModel.create({
  telegramUserId: userId,
  modelId, productId,
  productSnapshot: { name, type, price, currency },
  status: 'pending',
});

// 3. Create Transaction
const transaction = await TransactionModel.create({
  purchaseId: purchase._id,
  paymentMethod: 'pix',
  status: 'pending',
});

// 4. Generate PIX code
const pixResponse = await ArkamaService.createPixPayment({...});

// 5. Update transaction with PIX data
transaction.externalId = pixResponse.data.id;
transaction.pixCopyPaste = pixResponse.data.pixCopyPaste;
transaction.status = 'processing';
await transaction.save();

// 6. Link transaction to purchase
purchase.transactionId = transaction._id;
await purchase.save();
```

### Payment Status Check

```typescript
const statusResponse = await ArkamaService.checkPaymentStatus({
  paymentId: transaction.externalId,
});

if (statusResponse.data.status === 'paid') {
  transaction.status = 'paid';
  transaction.paidAt = new Date();
  await transaction.save();

  purchase.status = 'paid';
  await purchase.save();

  // Update user stats
  await TelegramUserModel.findOneAndUpdate(
    { telegramId: purchase.telegramUserId },
    { $inc: { totalPurchases: 1, totalSpent: purchase.amount } }
  );

  // Send access granted message
}
```

## Problems & Solutions

### 2026-02-07 - Markdown vs HTML Parse Mode

**Problem:** Telegram API rejected messages with emojis like 🔥 when using Markdown parse_mode, throwing "Can't parse entities" error.

**Root Cause:** Markdown parser treats emojis and special characters as potential formatting, causing conflicts.

**Solution:** Switch to HTML parse_mode for ALL messages. HTML parser handles emojis natively. Use `escapeHtml()` helper for user input to prevent injection.

**Prevention:** ALWAYS use `parse_mode: 'HTML'` in Telegram bots. Only escape user-provided content, not static strings.

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

### 2026-02-07 - Gallery + Buttons Layout

**Problem:** Inline keyboards cannot be attached to media groups (albums), causing buttons to not appear with galleries.

**Root Cause:** Telegram API limitation - reply_markup only works with single messages, not media groups.

**Solution:** Send media group first with caption on first photo, then send separate message with buttons immediately after.

**Prevention:** For galleries with actions: `ctx.replyWithMediaGroup(photos)` followed by `ctx.reply('Choose:', { reply_markup })`.

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

### 2026-02-07 - Pack vs Subscription UX

**Problem:** Users were confused when seeing both packs and subscriptions mixed together.

**Root Cause:** No clear separation in UI between one-time purchases and recurring subscriptions.

**Solution:** Split into two separate menus:
- "📦 Ver Packs" button → Shows grid of one-time packs
- "⭐ Assinar" button → Shows single subscription offer with benefits

**Prevention:** Separate product types in UX. Use different emoji and wording (Ver Packs vs Assinar).

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

### 2026-02-07 - Payment Details Timing

**Problem:** Showing full PIX payment details (QR code, expiry) too early in flow cluttered the UI.

**Root Cause:** Initial design showed payment info in pack details screen.

**Solution:** Only show payment details at checkout stage (after user clicks "Buy" button). Pack details just show preview + description + "Unlock Access" button.

**Prevention:** Progressive disclosure - show payment info only when user commits to purchase.

**Files Modified:**
- `services/bot/src/handlers/purchase.handler.ts`

## Attention Points

### grammY Patterns
- Use `bot.command()` for slash commands
- Use `bot.on('callback_query:data')` for inline button clicks
- ALWAYS call `ctx.answerCallbackQuery()` after handling callback
- Use InlineKeyboard for action buttons
- Use ReplyKeyboard for permanent menu (not implemented yet)

### Error Handling
```typescript
try {
  // Handler logic
  await ctx.answerCallbackQuery();
} catch (error) {
  logger.error('Handler error', { error });
  await ctx.answerCallbackQuery({ text: 'Erro, tente novamente' });
}
```

### S3 URL Pattern
```typescript
// Check if URL or S3 key
const photoUrl = photo.startsWith('http')
  ? photo
  : StorageService.getPublicUrl(photo);
```

### Populate Pattern
```typescript
// Always populate references before displaying
const purchases = await PurchaseModel.find({...})
  .populate('modelId', 'name')
  .sort({ createdAt: -1 });

// Type cast when accessing populated field
const model = purchase.modelId as unknown as { name: string };
```

### Currency Formatting
```typescript
function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(price);
}
// Result: "R$ 29,90"
```

## Future Enhancements

- [ ] Add conversation handlers for complex flows
- [ ] Implement content delivery after payment
- [ ] Add refund/support commands
- [ ] Implement subscription renewal reminders
- [ ] Add admin commands for manual payment confirmation
