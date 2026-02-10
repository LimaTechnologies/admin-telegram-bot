# Model Purchase System - Setup Guide

## Overview

This document describes how to set up and configure the model purchase system that allows Telegram users to buy content packs and subscriptions from models via PIX payments (Arkama gateway).

## Architecture

```
User clicks deep link → Telegram Bot → Model Profile (gallery)
                                            ↓
                               Ver Packs | Assinar
                                    ↓           ↓
                              Pack List    Subscription Details
                                    ↓           ↓
                              Pack Details → Checkout (PIX code)
                                                  ↓
                               Payment Confirmed → Content Delivered
```

## Components

### 1. Telegram Bot Handler

**File:** `services/bot/src/handlers/purchase.handler.ts`

Handles the entire purchase flow:
- Model listing (`/models` command)
- Model profile with photo gallery
- Pack menu and details
- Subscription option
- Checkout with QR code
- Payment verification
- Content delivery

### 2. Arkama Service

**File:** `common/services/arkama.service.ts`

Integrates with Arkama PIX payment gateway:
- `createPixPayment()` - Generates PIX code and QR
- `checkPaymentStatus()` - Polls payment status
- Local fallback mode for development

### 3. Webhook Endpoint

**File:** `src/app/api/webhooks/arkama/route.ts`

Receives payment confirmations from Arkama:
- Validates webhook signature
- Updates transaction/purchase status
- Triggers content delivery

### 4. Dashboard Management

**File:** `src/app/(dashboard)/models/page.tsx`

Admin interface for managing:
- Model profiles (name, tier, bio)
- Preview photos (4 free photos)
- Products (packs and subscriptions)
- Content photos per pack

---

## Environment Variables

Add these to your `.env` file:

```bash
# Arkama PIX Payment Gateway
ARKAMA_API_URL=https://sandbox.arkama.com.br/api/v1
ARKAMA_API_KEY=your_api_key_here
ARKAMA_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Database Models

### OFModel (Model)

```typescript
{
  name: string;
  username: string;
  onlyfansUrl: string;
  profileImageUrl?: string;
  previewPhotos: string[];      // Free preview photos (up to 4)
  products: ModelProduct[];      // Packs and subscriptions
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  bio?: string;
  referralLink?: string;
  isActive: boolean;
}
```

### ModelProduct

```typescript
{
  name: string;
  description?: string;
  type: 'content' | 'ppv' | 'subscription' | 'custom';
  price: number;
  currency: 'BRL' | 'USD';
  previewImages: string[];       // Preview before purchase
  contentPhotos: string[];       // Delivered after purchase
  isActive: boolean;
}
```

### Purchase

```typescript
{
  telegramUserId: number;
  modelId: ObjectId;
  productId: ObjectId;
  productSnapshot: {
    name: string;
    type: string;
    price: number;
    currency: string;
  };
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'completed' | 'failed' | 'refunded' | 'expired';
  transactionId?: ObjectId;
}
```

### Transaction

```typescript
{
  purchaseId: ObjectId;
  paymentMethod: 'pix';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired' | 'refunded';
  externalId?: string;           // Arkama payment ID
  pixKey?: string;
  pixQrCode?: string;            // Base64 or URL
  pixCopyPaste?: string;         // PIX copy-paste code
  pixExpiresAt?: Date;
  paidAt?: Date;
}
```

---

## Setup Steps

### 1. Configure Arkama

1. Create an account at [Arkama](https://arkama.com.br)
2. Get your API key from the dashboard
3. Configure the webhook URL: `https://yourdomain.com/api/webhooks/arkama`
4. Copy the webhook secret for signature validation

### 2. Seed Demo Data

```bash
# Create demo model with sample products
bun scripts/seed-demo-model.ts

# Send promotional message to a group (optional)
bun scripts/seed-demo-model.ts --promo
```

### 3. Start Services

```bash
# Start all services
docker compose up -d

# Or start individually
docker compose up -d mongodb redis
docker compose up -d bot
bun run dev  # Dashboard
```

### 4. Test the Flow

1. Add bot to a Telegram group as admin
2. Run the seed script with `--promo` flag
3. Click the promotional message button
4. Navigate through the purchase flow
5. Use the test PIX code to complete payment

---

## Webhook Configuration

### URL Format
```
POST https://yourdomain.com/api/webhooks/arkama
```

### Expected Payload
```json
{
  "event": "payment.confirmed",
  "payment": {
    "id": "pix_abc123",
    "externalId": "transaction_id",
    "status": "paid",
    "amount": 29.90,
    "paidAt": "2025-01-20T12:00:00Z"
  }
}
```

### Events
- `payment.confirmed` - Payment was successful
- `payment.failed` - Payment failed
- `payment.expired` - PIX code expired

### Signature Validation
The webhook includes a `x-arkama-signature` header with HMAC-SHA256 signature.

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start model_<id>` | Deep link to model profile |
| `/models` | List available models |
| `/history` | Show user's purchase history |
| `/help` | Help and support info |

---

## Dashboard Features

### Models Page (`/models`)

- List all models with tier and stats
- Create/edit model profiles
- Manage preview photos
- Manage products (packs/subscriptions)

### Model Detail Dialog

Tabs:
1. **Details** - Name, username, tier, bio, referral link
2. **Photos** - Upload/manage preview photos
3. **Products** - Create/edit packs and subscriptions

### Reports Page (`/reports`)

Generate reports including:
- Telegram Purchases - Bot purchase history, revenue, user stats

---

## Content Delivery

After payment confirmation:

1. Purchase status updated to `paid`
2. Bot sends success message to user
3. All `contentPhotos` from the product are sent as media group
4. Confirmation message with "Ver mais conteudo" button

---

## Local Development

The Arkama service includes a local fallback mode:

- Generates mock PIX codes when API key is missing
- Auto-confirms payments after 10 seconds
- Useful for testing without real payments

To enable:
```bash
# Remove or comment out ARKAMA_API_KEY
# ARKAMA_API_KEY=
```

---

## Troubleshooting

### QR Code not displaying
- Check if `pixQrCode` is a valid base64 or URL
- Verify Arkama API response format

### Content not delivered
- Check webhook logs for errors
- Verify `contentPhotos` array is populated
- Check Telegram rate limits

### Payment stuck as pending
- Webhook may not be configured correctly
- Check Arkama dashboard for payment status
- Manually trigger status check via dashboard

---

## Security Considerations

1. **Webhook signature validation** - Always validate the HMAC signature
2. **User authentication** - Purchases are linked to Telegram user ID
3. **Content access control** - Content only delivered after payment confirmed
4. **Rate limiting** - Implement rate limits on checkout endpoint
5. **Audit logging** - All purchase operations are logged
