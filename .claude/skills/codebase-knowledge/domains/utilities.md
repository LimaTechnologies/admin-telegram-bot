# Domain: Utilities (Shared Services & Helpers)

## Last Update
- **Date:** 2026-02-10
- **Commit:** (model purchase feature)
- **Summary:** Added ArkamaService for PIX payment API integration with local fallback for testing.

## Files

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
- 2026-02-10 - feat: add arkama service for pix payments with local fallback
- (Previous) - auth, email, storage services

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
