# Domain: Database (MongoDB + Mongoose)

## Last Update
- **Date:** 2026-01-26
- **Commit:** ef480b4
- **Summary:** 14 Mongoose models for Telegram Ads Dashboard

## Files

### Connection
- `common/db/index.ts` - MongoDB connection singleton

### Models (14 total)
- `user.model.ts` - Admin users with roles (admin, operator)
- `session.model.ts` - HTTP-only session storage
- `magic-link.model.ts` - Login tokens (15min TTL)
- `telegram-group.model.ts` - Managed Telegram groups
- `campaign.model.ts` - OF/Casino campaigns with status
- `creative.model.ts` - Ad content (image/video/text)
- `scheduled-post.model.ts` - Queue entries for posting
- `post-history.model.ts` - Execution logs with metrics
- `model.model.ts` - OnlyFans creators
- `casino.model.ts` - Casino brands with risk levels
- `deal.model.ts` - Revenue agreements
- `settings.model.ts` - Bot configuration (single doc)
- `audit-log.model.ts` - All user actions logged

### Index Export
- `common/models/index.ts` - Re-exports all models

## Connections
- **api** - All routers import models from @common
- **authentication** - User, Session, MagicLink models
- **utilities** - Services use models for business logic

## Recent Commits
- `c4cf62c` - feat: add all missing dashboard pages
- Initial model implementation

## Attention Points

### Model Patterns
- All models use TypeScript interfaces for document types
- Schemas export both Model and Document types
- Use `.lean()` for read-only queries
- Use `.toObject()` when returning to client (handled by tRPC)

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

### Gotchas
- MongoDB connection is lazy (connects on first query)
- Use `@common` alias to import models
- Settings model is singleton (findOne or create)
- AuditLog timestamps come from metadata.timestamp, not createdAt
