# Domain: Authentication

## Last Update
- **Date:** 2026-01-27
- **Commit:** 066c8e5
- **Summary:** Added dev bypass for first admin user (joaovitor_rlima@hotmail.com)

## Files

### Services
- `common/services/auth.service.ts` - Core auth logic (magic link generation, verification)
- `common/services/email.service.ts` - Email sending for magic links

### Models
- `common/models/user.model.ts` - User schema with roles
- `common/models/session.model.ts` - Session storage
- `common/models/magic-link.model.ts` - Magic link tokens (15min TTL)

### API
- `src/server/trpc/routers/auth.router.ts` - Auth procedures (login, verify, logout, getSession)
- `src/server/trpc/middleware/auth.middleware.ts` - Session validation middleware

### Pages
- `src/app/(auth)/login/page.tsx` - Login form (email input)
- `src/app/(auth)/verify/page.tsx` - Token verification page

## Connections
- **api** - Auth router exposes login/logout/session endpoints
- **database** - User, Session, MagicLink models
- **pages** - Login and verify pages consume auth API

## Recent Commits
- `066c8e5` - feat: add dev bypass authentication for first admin user
- `c4cf62c` - feat: add all missing dashboard pages
- Initial auth implementation

## Attention Points

### Security Rules
- Tokens are NEVER stored in plain text (hashed with SHA-256)
- HTTP-only, Secure, SameSite=Strict cookies
- Session tokens hashed before database storage
- User ID ALWAYS comes from session context, NEVER from request

### Magic Link Flow
1. User enters email → POST /login
2. Generate 32-byte random token
3. Hash token, store in MagicLink (15min TTL)
4. Send email with verification link
5. User clicks → GET /verify?token=xxx
6. Validate token hash, create Session
7. Set HTTP-only cookie (7 days)
8. Redirect to /dashboard

### Dev Bypass Flow (for joaovitor_rlima@hotmail.com)
1. User enters dev bypass email → POST /login
2. AuthService.isDevBypassEmail() returns true
3. AuthService.devLogin() creates admin user if not exists
4. Session created directly (no magic link email)
5. HTTP-only cookie set immediately
6. Response includes `directLogin: true`
7. Frontend redirects to /groups immediately

### Gotchas
- verify/page.tsx uses useRef to prevent double verification on StrictMode
- Session middleware checks cookie on every protected route
- Logout clears both cookie and database session
- DEV_BYPASS_EMAIL in auth.service.ts allows direct login without email service
- Dev bypass auto-creates admin user if not exists in database
