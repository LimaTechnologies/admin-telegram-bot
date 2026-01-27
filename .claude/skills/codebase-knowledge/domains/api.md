# Domain: API (tRPC)

## Last Update
- **Date:** 2027-01-27
- **Commit:** 3972e6e
- **Summary:** Added scheduledPost router + CRUD mutations for campaign and creative routers

## Files

### Core
- `src/server/trpc/trpc.ts` - tRPC context, procedures (public, protected, admin)
- `src/server/trpc/routers/index.ts` - Router aggregation
- `src/app/api/trpc/[trpc]/route.ts` - Next.js API handler

### Routers (13 total)
- `auth.router.ts` - Authentication (login, verify, logout, getSession)
- `user.router.ts` - User CRUD (admin only)
- `group.router.ts` - Telegram group management + create mutation
- `campaign.router.ts` - Campaign CRUD with auditing + create mutation
- `creative.router.ts` - Creative assets management + create mutation
- `model.router.ts` - OnlyFans model management
- `casino.router.ts` - Casino brand management
- `deal.router.ts` - Revenue deals management
- `settings.router.ts` - Bot settings
- `audit.router.ts` - Audit log viewing (admin only)
- `analytics.router.ts` - Performance metrics
- `scheduledPost.router.ts` - NEW: Scheduled post CRUD (list, getById, create, update, delete, getStats)

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
- `3972e6e` - feat: add scheduledPost router + CRUD mutations for campaign/creative/group routers
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

### Scheduled Post Router (NEW)
- **File:** `src/server/trpc/routers/scheduledPost.router.ts`
- **Procedures:**
  - `list` - Paginated list with filters (status, groupId, campaignId, date range)
  - `getById` - Single post with populated references
  - `create` - Validates campaign/creative/group existence (operatorProcedure)
  - `update` - Updates scheduling details (operatorProcedure)
  - `delete` - Soft delete (operatorProcedure)
  - `getStats` - Today/week counts + pending approval + conflicts
- **Permissions:** All read operations are `protectedProcedure`, mutations are `operatorProcedure`
- **Audit:** All mutations tracked via `withAudit` middleware
- **Populate:** Uses `.populate()` for campaignId, creativeId, groupId references
- **Status enum:** `pending | queued | processing | sent | failed | cancelled`
- **Schedule types:** `fixed | smart | randomized`

### Active Queries Pattern (MANDATORY for Dropdowns)
All routers that appear in form dropdowns/selects must have `getActive` query:
```typescript
// group.router.ts
export const groupRouter = t.router({
  list: protectedProcedure
    .input(z.object({ /* filters */ }))
    .query(async ({ ctx, input }) => {
      return await Group.find({ /* query */ });
    }),

  getActive: protectedProcedure // NEW: Filter by status
    .query(async ({ ctx }) => {
      return await Group.find({
        userId: ctx.user.id,
        'settings.isActive': true
      });
    }),

  create: operatorProcedure
    .input(GroupCreateInput)
    .mutation(async ({ ctx, input }) => {
      // Creates with default settings.isActive: true
      return await Group.create(input);
    }),
});
```

**Key Points:**
- `getActive` filters by specific conditions (isActive, isCompliant, status, etc.)
- Used exclusively in form dropdowns (campaign creation, scheduling)
- Returns minimal data - just id, name, and key fields
- protectedProcedure (not admin) - operators need access

### Problems & Solutions

#### 2027-01-27 - Inconsistent List Query Usage in Forms

**Problem:** Forms used `list` queries (with pagination, filters) for dropdowns, making UI overcomplicated with thousands of results.

**Root Cause:** No dedicated query for "active items only" pattern.

**Solution:** Added `getActive` procedures to group and creative routers. These return ONLY active/compliant entities suitable for dropdown selection without pagination overhead.

**Prevention:** When designing routers, think about TWO separate use cases: (1) list for data tables with filters/pagination, (2) getActive for forms/dropdowns.

**Files Modified:**
- `src/server/trpc/routers/group.router.ts`
- `src/server/trpc/routers/creative.router.ts`

#### 2027-01-27 - Default Values in Mongoose Schemas

**Problem:** Pages assumed must explicitly set `isActive: true` when creating entities, but schema defaults handled it automatically.

**Root Cause:** Schema defaults not documented in API domain knowledge.

**Solution:** Documented that Group schema has `settings: { isActive: true }` as default. New groups created without explicit settings are automatically active and appear in getActive queries immediately.

**Prevention:** Always check model schema for default values before explicit assignment in routes.

**Files Modified:**
- Schema documentation in this domain
