# Domain: Infrastructure

## Last Update
- **Date:** 2026-01-26
- **Commit:** ef480b4
- **Summary:** Docker Compose multi-service setup

## Files

### Docker
- `docker-compose.yml` - Service orchestration
- `docker/dashboard/Dockerfile` - Next.js dashboard
- `docker/bot/Dockerfile` - Telegram bot service
- `docker/worker/Dockerfile` - BullMQ workers

### Configuration
- `.env.example` - Environment variables template
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration

### Services
- `services/bot/` - grammY Telegram bot
- `services/worker/` - BullMQ job processors

### Queue System
- `common/queue/connection.ts` - Redis connection
- `common/queue/queues.ts` - Queue definitions

## Connections
- **database** - All services connect to MongoDB
- **api** - Dashboard exposes tRPC API
- **authentication** - Bot and workers share auth context

## Recent Commits
- Initial Docker and infrastructure setup

## Attention Points

### Docker Services
```yaml
services:
  dashboard:  # Next.js on :3000
  bot:        # grammY bot (webhook mode)
  worker:     # BullMQ processors (scalable)
  redis:      # Queue backend on :6379
  mongodb:    # Database on :27017
  minio:      # S3-compatible storage on :9000
```

### Queue Architecture
```
Per-Group Queues (Rate Limited)
├── post:group:{groupId} → 1 msg per cooldown

Per-Bot Queues (API Limited)
├── post:bot:{botId} → 30 msgs/second

System Queues
├── audit:log → Async audit logging
├── analytics:aggregate → Hourly aggregation
└── campaign:check → Status checks
```

### Environment Variables
```env
# Database
MONGODB_URI=mongodb://...

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Auth
SESSION_SECRET=...
MAGIC_LINK_SECRET=...

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASSWORD=... # App password, not regular

# Telegram
TELEGRAM_BOT_TOKEN=...

# Storage
S3_ENDPOINT=http://minio:9000
S3_BUCKET=creatives
```

### Gotchas
- Use bracket notation for env vars: `process.env['VARIABLE']`
- Redis connection uses singleton pattern
- Worker concurrency configurable via env
- Bot token stored in Settings model (single source)
- Gmail requires App Password (2FA must be enabled)
