# Domain: API (tRPC)

## Last Update
- **Date:** 2026-01-26
- **Commit:** ef480b4
- **Summary:** Complete tRPC API with 12 routers and audit middleware

## Files

### Core
- `src/server/trpc/trpc.ts` - tRPC context, procedures (public, protected, admin)
- `src/server/trpc/routers/index.ts` - Router aggregation
- `src/app/api/trpc/[trpc]/route.ts` - Next.js API handler

### Routers (12 total)
- `auth.router.ts` - Authentication (login, verify, logout, getSession)
- `user.router.ts` - User CRUD (admin only)
- `group.router.ts` - Telegram group management
- `campaign.router.ts` - Campaign CRUD with auditing
- `creative.router.ts` - Creative assets management
- `model.router.ts` - OnlyFans model management
- `casino.router.ts` - Casino brand management
- `deal.router.ts` - Revenue deals management
- `settings.router.ts` - Bot settings
- `audit.router.ts` - Audit log viewing (admin only)
- `analytics.router.ts` - Performance metrics

### Middleware
- `src/server/trpc/middleware/audit.middleware.ts` - Auto-logs all mutations

### Client
- `src/lib/trpc/client.ts` - React Query client
- `src/lib/trpc/provider.tsx` - tRPC provider wrapper

## Connections
- **authentication** - Auth router, protected/admin procedures
- **database** - All routers use Mongoose models
- **pages** - All dashboard pages consume tRPC queries/mutations

## Recent Commits
- `c4cf62c` - feat: add all missing dashboard pages
- Initial API implementation with all routers

## Attention Points

### Procedure Types
- `publicProcedure` - No auth required (login, verify)
- `protectedProcedure` - Requires valid session
- `adminProcedure` - Requires admin role

### Audit Middleware Pattern
```typescript
.meta({
  audit: {
    action: 'campaign.create',
    entityType: 'campaign',
    getBefore: async (input) => { /* get state before */ },
    getAfter: (_, result) => result,
  }
})
```

### Router Naming
- Router files: `*.router.ts`
- Export name: `{entity}Router`
- Aggregated in index.ts as `{entity}: {entity}Router`

### Gotchas
- All mutations should have audit metadata
- getBefore/getAfter must return documents directly (not .toObject())
- Admin procedures require `adminProcedure` base
