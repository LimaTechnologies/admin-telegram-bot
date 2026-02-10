# Domain: Services (Common Utilities)

## Last Update
- **Date:** 2026-02-07
- **Commit:** 5216399
- **Summary:** Added ArkamaService for PIX payment processing with local fallback

## Files

### Payment Services
- `common/services/arkama.service.ts` - PIX payment integration with Arkama API

### Storage Services
- `common/services/storage.service.ts` - S3/MinIO file upload and URL generation

### Other Services
- `common/services/logger.ts` - Winston logging
- `common/services/auth.service.ts` - Password hashing, session management
- `common/services/email.service.ts` - Email sending (magic links)
- `common/services/audit.service.ts` - Audit log creation
- `common/services/telegram.service.ts` - Bot singleton access

## Connections
- **database** - Services use Mongoose models
- **api** - Routers call services for business logic
- **bot** - Bot handlers use services for payments, storage

## Recent Commits
- 72dd834 - docs: document model purchase PIX payment feature (webhook added)
- `5216399` - feat: implement model purchase system with PIX payments
- Initial service implementations

## ArkamaService (PIX Payments)

### Configuration
```typescript
const ARKAMA_API_URL = process.env['ARKAMA_API_URL'] || 'https://sandbox.arkama.com.br/api/v1';
const ARKAMA_API_KEY = process.env['ARKAMA_API_KEY'] || '';
```

### Methods

#### createPixPayment()
```typescript
const response = await ArkamaService.createPixPayment({
  amount: 29.90,
  currency: 'BRL',
  description: 'Model Name - Pack Name',
  externalId: transaction._id.toString(),
  customer: { // Optional
    name: 'John Doe',
    email: 'user@example.com',
    document: '12345678900', // CPF
  },
});

// Returns
{
  success: true,
  data: {
    id: string,                // Arkama transaction ID
    pixKey: string,            // Reference key
    pixQrCode: string,         // QR code URL
    pixCopyPaste: string,      // EMV format (copia e cola)
    expiresAt: Date,           // 30 minutes from now
    amount: number,
    currency: string,
  }
}
```

#### checkPaymentStatus()
```typescript
const response = await ArkamaService.checkPaymentStatus({
  paymentId: transaction.externalId,
});

// Returns
{
  success: true,
  data: {
    id: string,
    status: 'pending' | 'processing' | 'paid' | 'failed' | 'expired',
    paidAt?: Date,
    amount: number,
  }
}
```

### Local Fallback Mode

When `ARKAMA_API_KEY` is not configured or API is unavailable, service automatically falls back to local simulation:

```typescript
// Creates local payment with auto-confirmation after 10 seconds
const paymentId = `local_${randomBytes(12).toString('hex')}`;

// Stores in memory with auto-pay timer
setTimeout(() => {
  payment.status = 'paid';
  payment.paidAt = new Date();
}, 10000);
```

**Purpose:** Allows testing payment flow without real payment gateway integration.

### Arkama API Integration

#### Order Creation Payload
```typescript
{
  value: amount * 100,           // Cents
  paymentMethod: 'pix',
  externalId: transaction._id,   // Our reference
  items: [{ name, value, quantity: 1 }],
  customer: { name, email, document, ip },
}
```

#### Status Mapping
```typescript
const statusMap = {
  'PENDING': 'pending',
  'PROCESSING': 'processing',
  'PAID': 'paid',
  'FAILED': 'failed',
  'EXPIRED': 'expired',
  'REFUNDED': 'failed',
};
```

### QR Code Generation
```typescript
// Uses Google Charts API for QR code generation
private static generateQrCodeUrl(data: string): string {
  const encodedData = encodeURIComponent(data);
  return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodedData}`;
}
```

## StorageService (S3/MinIO)

### Methods

#### getPresignedUploadUrl()
```typescript
const { uploadUrl, s3Key } = await StorageService.getPresignedUploadUrl(
  'photo.jpg',
  'image/jpeg',
  'creatives' // Folder
);

// Browser uploads directly to uploadUrl
// Save s3Key to database
```

#### getPublicUrl()
```typescript
const publicUrl = StorageService.getPublicUrl(s3Key);
// Returns: https://s3.amazonaws.com/bucket/creatives/abc123.jpg
```

#### deleteFile()
```typescript
await StorageService.deleteFile(s3Key);
```

## Problems & Solutions

### 2026-02-07 - API Fallback Pattern

**Problem:** How to test payment flow without real payment gateway API key during development.

**Root Cause:** Payment gateways require production credentials that shouldn't be in development environment.

**Solution:** Implement dual-mode service:
1. If API key configured → Use real Arkama API
2. If API key missing → Use local in-memory simulation with auto-pay after 10s

**Prevention:** For all external service integrations, implement local fallback mode that simulates the API behavior for development/testing.

**Files Modified:**
- `common/services/arkama.service.ts`

### 2026-02-07 - Axios Instance Configuration

**Problem:** Need to configure axios with auth headers and error logging for Arkama API.

**Root Cause:** Raw axios calls don't include authentication or centralized error handling.

**Solution:** Create singleton axios instance with:
- Authorization header from env var
- Response interceptor for logging
- Error interceptor for structured error logging

**Prevention:** Always create configured axios instance for external APIs. Use interceptors for cross-cutting concerns (auth, logging, retries).

**Files Modified:**
- `common/services/arkama.service.ts`

### 2026-02-07 - PIX Code Format

**Problem:** Need to generate valid PIX "copia e cola" code format for local fallback.

**Root Cause:** Local mode needs to provide realistic PIX code that users can copy.

**Solution:** Generate simplified EMV format:
```typescript
const amountStr = amount.toFixed(2).padStart(10, '0');
return `00020126580014br.gov.bcb.pix0136${txId}5204000053039865406${amountStr}5802BR...`;
```

**Prevention:** For payment integrations, research actual format specs to provide realistic test data.

**Files Modified:**
- `common/services/arkama.service.ts`

## Attention Points

### ArkamaService Patterns

#### Check API Configuration
```typescript
private static isApiConfigured(): boolean {
  return !!ARKAMA_API_KEY && ARKAMA_API_KEY.length > 10;
}
```

#### Automatic Fallback
```typescript
if (!this.isApiConfigured()) {
  logger.warn('[Arkama] Using local fallback');
  return this.createLocalPayment(input);
}
```

#### Axios Error Handling
```typescript
try {
  const response = await api.post('/orders', payload);
  return { success: true, data: response.data };
} catch (error) {
  if (axios.isAxiosError(error)) {
    return this.createLocalPayment(input); // Fallback on API error
  }
  return { success: false, error: error.message };
}
```

### Local Payment Simulation

```typescript
// In-memory store
const localPayments = new Map<string, PaymentData>();

// Auto-pay after delay
const AUTO_PAY_DELAY_MS = 10000;

setTimeout(() => {
  const payment = localPayments.get(paymentId);
  if (payment?.status === 'pending') {
    payment.status = 'paid';
    payment.paidAt = new Date();
  }
}, AUTO_PAY_DELAY_MS);
```

### Debug Methods

```typescript
// Manual payment confirmation (testing only)
await ArkamaService.confirmPayment(paymentId);

// Get pending payments (admin debug)
const pending = ArkamaService.getPendingPayments();
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ARKAMA_API_URL` | Arkama API endpoint | `https://sandbox.arkama.com.br/api/v1` |
| `ARKAMA_API_KEY` | Arkama auth token | `''` (triggers fallback) |

## Integration Examples

### Bot Purchase Handler
```typescript
import { ArkamaService } from '@common/services/arkama.service';

// Generate PIX code
const pixResponse = await ArkamaService.createPixPayment({
  amount: product.price,
  currency: product.currency,
  description: `${model.name} - ${product.name}`,
  externalId: transaction._id.toString(),
});

// Store PIX data in transaction
transaction.externalId = pixResponse.data.id;
transaction.pixCopyPaste = pixResponse.data.pixCopyPaste;
transaction.pixExpiresAt = pixResponse.data.expiresAt;
await transaction.save();
```

### Dashboard Router
```typescript
import { StorageService } from '@common';

// Generate upload URL
getPhotoUploadUrl: protectedProcedure
  .input(z.object({ filename: z.string(), contentType: z.string() }))
  .mutation(async ({ input }) => {
    const result = await StorageService.getPresignedUploadUrl(
      input.filename,
      input.contentType,
      'models'
    );
    return result;
  }),
```

## Webhook Integration (2026-02-10)

### Arkama Webhook Handler

**Endpoint:** `POST /api/webhooks/arkama`

**Purpose:** Receive payment status updates from Arkama instead of polling.

**Authentication:** HMAC-SHA256 signature in `X-Arkama-Signature` header.

**Events Handled:**
- `payment.confirmed` - Auto-deliver content, mark purchase as paid
- `payment.failed` - Mark purchase/transaction as failed
- `payment.expired` - Mark as expired, notify user

**Signature Validation:**
```typescript
const signature = headers().get('x-arkama-signature');
const body = await request.text();
const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
const expectedSignature = hmac.update(body).digest('hex');

if (signature !== expectedSignature) {
  return new Response('Invalid signature', { status: 401 });
}
```

**Webhook Configuration:**
- Set webhook URL in Arkama dashboard: `https://your-domain.com/api/webhooks/arkama`
- Configure secret: `ARKAMA_WEBHOOK_SECRET` (same in both systems)
- Enable events: `payment.confirmed`, `payment.failed`, `payment.expired`

**Files:**
- `src/app/api/webhooks/arkama/route.ts`

**Environment Variables:**
- `ARKAMA_WEBHOOK_SECRET` - HMAC secret for signature validation

## Future Enhancements

- [x] ~~Add webhook handler for Arkama payment notifications~~ (DONE 2026-02-10)
- [ ] Implement payment retry logic
- [ ] Add payment analytics aggregation
- [ ] Support multiple payment methods (credit card, boleto)
- [ ] Add refund processing
